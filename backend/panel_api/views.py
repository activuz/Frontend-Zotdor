"""Staff panel API (/api/panel, FR-16). Every mutation is written to the audit log (BR-62)."""

from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Any

from django.db import transaction
from django.db.models import Count, Q, QuerySet, Sum
from django.forms.models import model_to_dict
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.pagination import LimitOffsetPagination
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from auctions import services as auction_services
from auctions.models import Auction, Status
from auctions.serializers import AuctionDetailSerializer, AuctionListSerializer
from auctions.views import base_queryset
from core import audit
from core.errors import DomainError
from core.http import data_of
from core.models import PlatformSettings, StaffAuditLog
from deals import services as deal_services
from deals.models import Deal, DealClaim
from moderation.models import Report
from panel_api.permissions import IsAdmin, IsModerator
from payments import services as payment_services
from payments.models import RefundRequest
from reference.models import AnimalClass, AnimalType, Breed, Direction, District
from wallet import services as wallet
from wallet.models import Bucket, WalletEntry
from wallet.serializers import WalletEntrySerializer, WalletSerializer


def _ip(request: Request) -> str | None:
    return request.META.get("HTTP_X_REAL_IP") or request.META.get("REMOTE_ADDR")


def _staff(request: Request) -> User:
    return request.user  # type: ignore[return-value]


def _text(request: Request, key: str) -> str:
    return str(data_of(request).get(key, "") or "").strip()


class PanelPagination(LimitOffsetPagination):
    default_limit = 50
    max_limit = 200


def _page(request: Request, view: APIView, qs: QuerySet[Any], serialize: Any) -> Response:
    paginator = PanelPagination()
    page = paginator.paginate_queryset(qs, request, view=view)
    return paginator.get_paginated_response([serialize(x) for x in page or []])


class ModView(APIView):
    permission_classes = [IsModerator]


class AdminView(APIView):
    permission_classes = [IsAdmin]


# --- stats ---------------------------------------------------------------------------------


class StatsView(ModView):
    @extend_schema(responses=inline_serializer("PanelStats", {"data": serializers.DictField()}))
    def get(self, request: Request) -> Response:
        week = timezone.now() - timedelta(days=7)
        by_status = dict(
            Auction.objects.values_list("status").annotate(n=Count("id")).values_list("status", "n")
        )
        return Response(
            {
                "auctions_by_status": by_status,
                "queues": {
                    "pending_review": by_status.get(Status.PENDING_REVIEW, 0),
                    "reports": Report.objects.filter(status=Report.ReportStatus.OPEN).count(),
                    "claims": DealClaim.objects.filter(status=DealClaim.ClaimStatus.OPEN).count(),
                    "refunds": RefundRequest.objects.filter(status=RefundRequest.RefundStatus.OPEN).count(),
                },
                "deals_7d": Deal.objects.filter(created_at__gte=week).count(),
                "commission_7d": -(
                    WalletEntry.objects.filter(
                        type="commission", created_at__gte=week, bucket=Bucket.MAIN
                    ).aggregate(s=Sum("amount"))["s"]
                    or 0
                ),
                "new_users_7d": User.objects.filter(created_at__gte=week).count(),
            }
        )


# --- auctions ------------------------------------------------------------------------------


class AuctionQueueView(ModView):
    @extend_schema(responses=AuctionListSerializer(many=True))
    def get(self, request: Request) -> Response:
        qs = base_queryset(request).select_related("seller")
        st = request.query_params.get("status", Status.PENDING_REVIEW)
        if st != "all":
            qs = qs.filter(status=st)
        if q := request.query_params.get("q", "").strip():
            qs = qs.filter(Q(title__icontains=q) | Q(seller__phone__icontains=q))
        qs = qs.order_by("created_at" if st == Status.PENDING_REVIEW else "-created_at")

        def row(a: Auction) -> dict[str, Any]:
            data = dict(AuctionListSerializer(a, context={"request": request}).data)
            data["seller_phone"] = a.seller.phone
            data["seller_id"] = str(a.seller_id)
            return data

        return _page(request, self, qs, row)


class AuctionPanelDetailView(ModView):
    @extend_schema(responses=AuctionDetailSerializer)
    def get(self, request: Request, auction_id: uuid.UUID) -> Response:
        a = (
            base_queryset(request)
            .select_related("seller", "direction", "breed")
            .filter(id=auction_id)
            .first()
        )
        if a is None:
            raise DomainError("not_found", "Auksion topilmadi.", status.HTTP_404_NOT_FOUND)
        data = dict(AuctionDetailSerializer(a, context={"request": request}).data)
        last_run = a.checks.order_by("-created_at").values_list("run_id", flat=True).first()
        data["checks"] = list(
            (a.checks.filter(run_id=last_run) if last_run else a.checks.none()).values(
                "check_name", "result", "message", "details"
            )
        )
        data["events"] = list(
            a.events.values("from_status", "to_status", "reason", "created_at", "actor__phone")
        )
        data["seller_phone"] = a.seller.phone
        data["seller_history"] = {
            "auctions": Auction.objects.filter(seller=a.seller).count(),
            "blocked": Auction.objects.filter(seller=a.seller, status=Status.BLOCKED).count(),
            "reports": Report.objects.filter(target_type="user", target_id=a.seller_id).count(),
        }
        return Response(data)


class AuctionActionView(ModView):
    @extend_schema(
        request=inline_serializer("PanelAction", {"reason": serializers.CharField(required=False)}),
        responses={200: None},
    )
    def post(self, request: Request, auction_id: uuid.UUID, action: str) -> Response:
        staff, reason = _staff(request), _text(request, "reason")
        with transaction.atomic():
            if action == "approve":
                a = auction_services.approve(auction_id, staff, reason)
            elif action == "reject":
                a = auction_services.reject(auction_id, staff, reason)
            elif action == "block":
                a = auction_services.block(auction_id, staff, reason)
            else:
                raise DomainError("not_found", "Nomaʼlum amal.", status.HTTP_404_NOT_FOUND)
            audit.log(
                staff,
                f"auction.{action}",
                "auction",
                a.id,
                after={"status": a.status, "reason": reason},
                ip=_ip(request),
            )
        return Response({"status": a.status})


# --- reports -------------------------------------------------------------------------------


def _report_row(r: Report) -> dict[str, Any]:
    return {
        "id": r.id,
        "target_type": r.target_type,
        "target_id": r.target_id,
        "reason": r.reason,
        "reason_label": r.get_reason_display(),
        "comment": r.comment,
        "status": r.status,
        "reporter_phone": r.reporter.phone,
        "created_at": r.created_at,
        "handled_note": r.handled_note,
    }


class ReportListView(ModView):
    @extend_schema(responses={200: None})
    def get(self, request: Request) -> Response:
        st = request.query_params.get("status", Report.ReportStatus.OPEN)
        qs = Report.objects.select_related("reporter").order_by("created_at")
        if st != "all":
            qs = qs.filter(status=st)
        return _page(request, self, qs, _report_row)


class ReportResolveView(ModView):
    @extend_schema(
        request=inline_serializer(
            "ReportResolve",
            {
                "outcome": serializers.ChoiceField(["resolved", "dismissed"]),
                "note": serializers.CharField(required=False),
            },
        ),
        responses={200: None},
    )
    def post(self, request: Request, report_id: uuid.UUID) -> Response:
        outcome = _text(request, "outcome")
        if outcome not in ("resolved", "dismissed"):
            raise DomainError("invalid", "Natijani tanlang.")
        with transaction.atomic():
            r = Report.objects.select_for_update().filter(id=report_id).first()
            if r is None:
                raise DomainError("not_found", "Shikoyat topilmadi.", status.HTTP_404_NOT_FOUND)
            r.status, r.handled_by, r.handled_note, r.handled_at = (
                outcome,
                _staff(request),
                _text(request, "note"),
                timezone.now(),
            )
            r.save()
            audit.log(
                _staff(request),
                f"report.{outcome}",
                "report",
                r.id,
                after={"note": r.handled_note},
                ip=_ip(request),
            )
        return Response(_report_row(r))


# --- claims --------------------------------------------------------------------------------


def _claim_row(c: DealClaim) -> dict[str, Any]:
    d = c.deal
    return {
        "id": c.id,
        "deal_id": d.id,
        "auction_id": d.auction_id,
        "auction_title": d.auction.title,
        "price": d.price,
        "commission_amount": d.commission_amount,
        "seller_phone": d.seller.phone,
        "buyer_phone": d.buyer.phone,
        "reason": c.reason,
        "status": c.status,
        "resolution_note": c.resolution_note,
        "created_at": c.created_at,
    }


class ClaimListView(ModView):
    @extend_schema(responses={200: None})
    def get(self, request: Request) -> Response:
        st = request.query_params.get("status", DealClaim.ClaimStatus.OPEN)
        qs = DealClaim.objects.select_related("deal__auction", "deal__seller", "deal__buyer").order_by(
            "created_at"
        )
        if st != "all":
            qs = qs.filter(status=st)
        return _page(request, self, qs, _claim_row)


class ClaimResolveView(ModView):
    @extend_schema(
        request=inline_serializer(
            "ClaimResolve",
            {"approve": serializers.BooleanField(), "note": serializers.CharField(required=False)},
        ),
        responses={200: None},
    )
    def post(self, request: Request, claim_id: uuid.UUID) -> Response:
        approve = bool(data_of(request).get("approve"))
        with transaction.atomic():
            c = deal_services.resolve_claim(claim_id, _staff(request), approve, _text(request, "note"))
            audit.log(
                _staff(request),
                "claim.approve" if approve else "claim.reject",
                "claim",
                c.id,
                after={"note": c.resolution_note},
                ip=_ip(request),
            )
        c = DealClaim.objects.select_related("deal__auction", "deal__seller", "deal__buyer").get(id=c.id)
        return Response(_claim_row(c))


# --- refund requests -------------------------------------------------------------------------


def _refund_row(r: RefundRequest) -> dict[str, Any]:
    return {
        "id": r.id,
        "user_id": r.user_id,
        "user_phone": r.user.phone,
        "amount": r.amount,
        "click_reference": r.click_reference,
        "reason": r.reason,
        "status": r.status,
        "note": r.note,
        "created_at": r.created_at,
        "main_balance": wallet.get_wallet(r.user).main_balance,
    }


class RefundListView(ModView):
    @extend_schema(responses={200: None})
    def get(self, request: Request) -> Response:
        st = request.query_params.get("status", RefundRequest.RefundStatus.OPEN)
        qs = RefundRequest.objects.select_related("user").order_by("created_at")
        if st != "all":
            qs = qs.filter(status=st)
        return _page(request, self, qs, _refund_row)


class RefundResolveView(ModView):
    @extend_schema(
        request=inline_serializer(
            "RefundResolve",
            {"done": serializers.BooleanField(), "note": serializers.CharField(required=False)},
        ),
        responses={200: None},
    )
    def post(self, request: Request, refund_id: uuid.UUID) -> Response:
        done = bool(data_of(request).get("done"))
        with transaction.atomic():
            r = payment_services.resolve_refund(refund_id, _staff(request), done, _text(request, "note"))
            audit.log(
                _staff(request),
                "refund.done" if done else "refund.reject",
                "refund_request",
                r.id,
                after={"amount": r.amount, "note": r.note},
                ip=_ip(request),
            )
        return Response(_refund_row(r))


# --- users ----------------------------------------------------------------------------------


def _user_row(u: User) -> dict[str, Any]:
    return {
        "id": u.id,
        "phone": u.phone,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "role": u.role,
        "is_blocked": u.is_blocked,
        "blocked_reason": u.blocked_reason,
        "region": u.region.name if u.region else "",
        "district": u.district.name if u.district else "",
        "rating_avg": float(u.rating_avg) if u.rating_avg is not None else None,
        "rating_count": u.rating_count,
        "deals_count": u.deals_count,
        "created_at": u.created_at,
    }


class UserListView(ModView):
    @extend_schema(operation_id="panel_users_list", responses={200: None})
    def get(self, request: Request) -> Response:
        qs = User.objects.select_related("region", "district").order_by("-created_at")
        if q := request.query_params.get("q", "").strip():
            qs = qs.filter(
                Q(phone__icontains=q.replace(" ", ""))
                | Q(first_name__icontains=q)
                | Q(last_name__icontains=q)
            )
        if role := request.query_params.get("role"):
            qs = qs.filter(role=role)
        if request.query_params.get("blocked") == "1":
            qs = qs.filter(is_blocked=True)
        return _page(request, self, qs, _user_row)


class UserDetailView(ModView):
    @extend_schema(responses={200: None})
    def get(self, request: Request, user_id: uuid.UUID) -> Response:
        u = User.objects.select_related("region", "district").filter(id=user_id).first()
        if u is None:
            raise DomainError("not_found", "Foydalanuvchi topilmadi.", status.HTTP_404_NOT_FOUND)
        entries = WalletEntry.objects.filter(user=u).order_by("-id")[:50]
        return Response(
            {
                "user": _user_row(u),
                "wallet": WalletSerializer(wallet.get_wallet(u)).data,
                "entries": WalletEntrySerializer(entries, many=True).data,
                "auctions": AuctionListSerializer(
                    base_queryset(request).filter(seller=u).order_by("-created_at")[:50],
                    many=True,
                    context={"request": request},
                ).data,
                "reports_against": Report.objects.filter(target_type="user", target_id=u.id).count(),
                "audit": list(
                    StaffAuditLog.objects.filter(target_type="user", target_id=str(u.id))
                    .order_by("-created_at")
                    .values("action", "after", "created_at", "actor__phone")[:50]
                ),
            }
        )


class UserBlockView(ModView):
    @extend_schema(
        request=inline_serializer(
            "UserBlock",
            {"blocked": serializers.BooleanField(), "reason": serializers.CharField(required=False)},
        ),
        responses={200: None},
    )
    def post(self, request: Request, user_id: uuid.UUID) -> Response:
        blocked, reason = bool(data_of(request).get("blocked")), _text(request, "reason")
        if blocked and not reason:
            raise DomainError("reason_required", "Bloklash sababini yozing.")
        with transaction.atomic():
            u = User.objects.select_for_update().filter(id=user_id).first()
            if u is None:
                raise DomainError("not_found", "Foydalanuvchi topilmadi.", status.HTTP_404_NOT_FOUND)
            if u.role == User.Role.ADMIN and blocked:
                raise DomainError(
                    "forbidden", "Administratorni bloklab boʻlmaydi.", status.HTTP_403_FORBIDDEN
                )
            before = {"is_blocked": u.is_blocked}
            u.is_blocked, u.blocked_reason = blocked, reason if blocked else ""
            u.save(update_fields=["is_blocked", "blocked_reason"])
            audit.log(
                _staff(request),
                "user.block" if blocked else "user.unblock",
                "user",
                u.id,
                before=before,
                after={"is_blocked": blocked, "reason": reason},
                ip=_ip(request),
            )
        return Response(_user_row(u))


class UserRoleView(AdminView):
    @extend_schema(
        request=inline_serializer("UserRole", {"role": serializers.ChoiceField(User.Role.choices)}),
        responses={200: None},
    )
    def post(self, request: Request, user_id: uuid.UUID) -> Response:
        role = _text(request, "role")
        if role not in User.Role.values:
            raise DomainError("invalid", "Rolni tanlang.")
        with transaction.atomic():
            u = User.objects.select_for_update().filter(id=user_id).first()
            if u is None:
                raise DomainError("not_found", "Foydalanuvchi topilmadi.", status.HTTP_404_NOT_FOUND)
            if u.id == _staff(request).id:
                raise DomainError(
                    "forbidden", "Oʻz rolingizni oʻzgartira olmaysiz.", status.HTTP_403_FORBIDDEN
                )
            before = {"role": u.role}
            u.role = role
            u.save(update_fields=["role"])
            audit.log(
                _staff(request),
                "user.role",
                "user",
                u.id,
                before=before,
                after={"role": role},
                ip=_ip(request),
            )
        return Response(_user_row(u))


class WalletAdjustView(AdminView):
    @extend_schema(
        request=inline_serializer(
            "WalletAdjust",
            {
                "bucket": serializers.ChoiceField(["main", "bonus"]),
                "amount": serializers.IntegerField(),
                "note": serializers.CharField(),
            },
        ),
        responses={200: None},
    )
    def post(self, request: Request, user_id: uuid.UUID) -> Response:
        bucket = _text(request, "bucket")
        if bucket not in (Bucket.MAIN, Bucket.BONUS):
            raise DomainError("invalid", "Balans turini tanlang.")
        try:
            amount = int(data_of(request).get("amount", ""))
        except (TypeError, ValueError) as exc:
            raise DomainError("invalid_amount", "Summani kiriting.") from exc
        if amount == 0:
            raise DomainError("invalid_amount", "Summa 0 boʻlmasin.")
        u = User.objects.filter(id=user_id).first()
        if u is None:
            raise DomainError("not_found", "Foydalanuvchi topilmadi.", status.HTTP_404_NOT_FOUND)
        with transaction.atomic():
            entry = wallet.adjust(
                u, Bucket(bucket), amount, actor=_staff(request), note=_text(request, "note")
            )
            audit.log(
                _staff(request),
                "wallet.adjust",
                "user",
                u.id,
                after={"bucket": bucket, "amount": amount, "note": entry.note},
                ip=_ip(request),
            )
        return Response(WalletSerializer(wallet.get_wallet(u)).data)


# --- settings ----------------------------------------------------------------------------------


class SettingsSerializer(serializers.ModelSerializer[PlatformSettings]):
    class Meta:
        model = PlatformSettings
        exclude = ["id"]
        read_only_fields = ["updated_at"]

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        rate = attrs.get("commission_rate_bp")
        if rate is not None and rate > 1000:
            raise serializers.ValidationError({"commission_rate_bp": ["Stavka 10% dan oshmasin."]})
        return attrs


class SettingsView(APIView):
    def get_permissions(self) -> list[Any]:
        return [IsModerator()] if self.request.method == "GET" else [IsAdmin()]

    @extend_schema(responses=SettingsSerializer)
    def get(self, request: Request) -> Response:
        return Response(SettingsSerializer(PlatformSettings.load()).data)

    @extend_schema(request=SettingsSerializer, responses=SettingsSerializer)
    def patch(self, request: Request) -> Response:
        obj = PlatformSettings.load()
        before = model_to_dict(obj)
        payload = SettingsSerializer(obj, data=request.data, partial=True)
        payload.is_valid(raise_exception=True)
        with transaction.atomic():
            payload.save()
            after = model_to_dict(obj)
            changed = {k: v for k, v in after.items() if before.get(k) != v}
            audit.log(
                _staff(request),
                "settings.update",
                "settings",
                1,
                before={k: before[k] for k in changed},
                after=changed,
                ip=_ip(request),
            )
        return Response(SettingsSerializer(obj).data)


# --- taxonomy (admin) ----------------------------------------------------------------------


class _Audited(
    viewsets.GenericViewSet[Any], mixins.ListModelMixin, mixins.CreateModelMixin, mixins.UpdateModelMixin
):
    permission_classes = [IsAdmin]
    pagination_class = None
    target = ""

    def perform_create(self, serializer: Any) -> None:
        obj = serializer.save()
        audit.log(
            _staff(self.request),
            f"{self.target}.create",
            self.target,
            obj.pk,
            after=serializer.data,
            ip=_ip(self.request),
        )

    def perform_update(self, serializer: Any) -> None:
        before = model_to_dict(serializer.instance)
        obj = serializer.save()
        audit.log(
            _staff(self.request),
            f"{self.target}.update",
            self.target,
            obj.pk,
            before={k: str(v) for k, v in before.items()},
            after=serializer.data,
            ip=_ip(self.request),
        )


class DirectionPanelSerializer(serializers.ModelSerializer[Direction]):
    class Meta:
        model = Direction
        fields = ["id", "slug", "name", "sort", "is_active"]


class AnimalTypePanelSerializer(serializers.ModelSerializer[AnimalType]):
    class Meta:
        model = AnimalType
        fields = ["id", "slug", "name", "sort", "is_active", "directions"]


class AnimalClassPanelSerializer(serializers.ModelSerializer[AnimalClass]):
    class Meta:
        model = AnimalClass
        fields = ["id", "animal_type", "name", "sex", "age_hint", "sort", "is_active"]


class BreedPanelSerializer(serializers.ModelSerializer[Breed]):
    class Meta:
        model = Breed
        fields = ["id", "animal_type", "name", "sort", "is_active"]


class DistrictPanelSerializer(serializers.ModelSerializer[District]):
    class Meta:
        model = District
        fields = ["id", "region", "name", "lat", "lng"]


class DirectionViewSet(_Audited):
    queryset = Direction.objects.all()
    serializer_class = DirectionPanelSerializer
    target = "direction"


class AnimalTypeViewSet(_Audited):
    queryset = AnimalType.objects.prefetch_related("directions")
    serializer_class = AnimalTypePanelSerializer
    target = "animal_type"


class AnimalClassViewSet(_Audited):
    queryset = AnimalClass.objects.select_related("animal_type")
    serializer_class = AnimalClassPanelSerializer
    target = "animal_class"


class BreedViewSet(_Audited):
    queryset = Breed.objects.select_related("animal_type")
    serializer_class = BreedPanelSerializer
    target = "breed"


class DistrictViewSet(_Audited):
    queryset = District.objects.select_related("region")
    serializer_class = DistrictPanelSerializer
    target = "district"


# --- audit log ----------------------------------------------------------------------------------


class AuditLogView(AdminView):
    @extend_schema(responses={200: None})
    def get(self, request: Request) -> Response:
        qs = StaffAuditLog.objects.select_related("actor").order_by("-created_at")
        if action := request.query_params.get("action"):
            qs = qs.filter(action__startswith=action)
        return _page(
            request,
            self,
            qs,
            lambda e: {
                "id": e.id,
                "actor_phone": e.actor.phone,
                "action": e.action,
                "target_type": e.target_type,
                "target_id": e.target_id,
                "before": e.before,
                "after": e.after,
                "ip": e.ip,
                "created_at": e.created_at,
            },
        )
