from __future__ import annotations

import json
import uuid
from datetime import timedelta
from typing import Any

from django.db.models import Count, Exists, F, FloatField, OuterRef, Prefetch, Q, QuerySet, Value
from django.db.models.functions import ACos, Cos, Least, Radians, Sin
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.pagination import LimitOffsetPagination
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from auctions import services
from auctions.models import Auction, AuctionMedia, Bid, Status, Watch
from auctions.serializers import (
    AuctionDetailSerializer,
    AuctionListSerializer,
    DecisionSerializer,
    DraftSerializer,
    MediaSerializer,
    MyBidRowSerializer,
    PublicBidSerializer,
    SubmitResultSerializer,
)
from core.errors import DomainError
from core.http import data_of, me

SORTS = ("nearest", "ending_soon", "most_active", "newest", "price_asc", "price_desc")


def _user(request: Request) -> User | None:
    u = request.user
    return u if u is not None and u.is_authenticated else None


def _int(value: str | None) -> int | None:
    try:
        return int(value) if value not in (None, "") else None
    except ValueError:
        return None


def _point(request: Request) -> tuple[float, float] | None:
    try:
        lat, lng = request.query_params.get("lat"), request.query_params.get("lng")
        if lat and lng:
            return float(lat), float(lng)
    except ValueError:
        pass
    user = _user(request)
    if user is not None:
        return services.user_point(user)
    return None


def base_queryset(request: Request) -> QuerySet[Auction]:
    qs = Auction.objects.select_related("region", "district", "animal_type", "animal_class").prefetch_related(
        Prefetch("media", queryset=AuctionMedia.objects.order_by("position", "received_at"))
    )
    user = _user(request)
    if user is not None:
        qs = qs.annotate(is_watched=Exists(Watch.objects.filter(user=user, auction=OuterRef("pk"))))
    point = _point(request)
    if point is not None:
        lat, lng = point
        qs = qs.annotate(
            distance_km=Value(6371.0)
            * ACos(
                Least(
                    Value(1.0),
                    Cos(Radians(Value(lat)))
                    * Cos(Radians(F("lat")))
                    * Cos(Radians(F("lng")) - Radians(Value(lng)))
                    + Sin(Radians(Value(lat))) * Sin(Radians(F("lat"))),
                ),
                output_field=FloatField(),
            )
        )
    return qs


class FeedPagination(LimitOffsetPagination):
    default_limit = 20
    max_limit = 50


class AuctionListView(APIView):
    """GET: public feed and search (FR-06, FR-07). POST: create a draft (FR-03)."""

    def get_permissions(self) -> list[Any]:
        return [AllowAny()] if self.request.method == "GET" else [IsAuthenticated()]

    @extend_schema(
        parameters=[
            OpenApiParameter("status", str, enum=["live", "scheduled", "ended", "all_open"]),
            OpenApiParameter("sort", str, enum=list(SORTS)),
            *[
                OpenApiParameter(p, int)
                for p in (
                    "direction",
                    "animal_type",
                    "animal_class",
                    "breed",
                    "region",
                    "district",
                    "price_min",
                    "price_max",
                    "limit",
                    "offset",
                )
            ],
            OpenApiParameter("q", str),
            OpenApiParameter("seller", str),
            OpenApiParameter("lat", float),
            OpenApiParameter("lng", float),
        ],
        responses=inline_serializer(
            "PaginatedAuctionList",
            {
                "count": serializers.IntegerField(),
                "next": serializers.CharField(allow_null=True),
                "previous": serializers.CharField(allow_null=True),
                "results": AuctionListSerializer(many=True),
            },
        ),
    )
    def get(self, request: Request) -> Response:
        p = request.query_params
        qs = base_queryset(request)
        st = p.get("status", "all_open")
        statuses = {
            "live": [Status.LIVE],
            "scheduled": [Status.SCHEDULED],
            "ended": [Status.ENDED, Status.SOLD, Status.UNSOLD],
        }.get(st, [Status.LIVE, Status.SCHEDULED])
        qs = qs.filter(status__in=statuses)
        for param, field in (
            ("direction", "direction_id"),
            ("animal_type", "animal_type_id"),
            ("animal_class", "animal_class_id"),
            ("breed", "breed_id"),
            ("region", "region_id"),
            ("district", "district_id"),
        ):
            value = _int(p.get(param))
            if value is not None:
                qs = qs.filter(**{field: value})
        if (v := _int(p.get("price_min"))) is not None:
            qs = qs.filter(asking_price__gte=v)
        if (v := _int(p.get("price_max"))) is not None:
            qs = qs.filter(asking_price__lte=v)
        if seller := p.get("seller"):
            try:
                qs = qs.filter(seller_id=uuid.UUID(seller))
            except ValueError:
                qs = qs.none()
        if q := p.get("q", "").strip():
            for word in q.split()[:5]:
                qs = qs.filter(
                    Q(title__icontains=word) | Q(description__icontains=word) | Q(breed_other__icontains=word)
                )

        sort = p.get("sort", "ending_soon")
        if sort == "nearest":
            if _point(request) is None:
                raise DomainError(
                    "location_required", "Yaqin auksionlarni koʻrish uchun profilda tumanni tanlang."
                )
            qs = qs.order_by(F("distance_km").asc(nulls_last=True), "ends_at")
        elif sort == "most_active":
            since = timezone.now() - timedelta(minutes=60)
            qs = qs.annotate(recent=Count("bids", filter=Q(bids__created_at__gte=since))).order_by(
                "-recent", "-bidders_count", "ends_at"
            )
        elif sort == "newest":
            qs = qs.order_by("-published_at")
        elif sort == "price_asc":
            qs = qs.order_by("asking_price")
        elif sort == "price_desc":
            qs = qs.order_by("-asking_price")
        else:
            qs = (
                qs.order_by(F("ends_at").asc(nulls_last=True))
                if st != "scheduled"
                else qs.order_by("starts_at")
            )

        paginator = FeedPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        return paginator.get_paginated_response(
            AuctionListSerializer(page, many=True, context={"request": request}).data
        )

    @extend_schema(request=DraftSerializer, responses={201: AuctionDetailSerializer})
    def post(self, request: Request) -> Response:
        payload = DraftSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        auction = services.create_draft(me(request), dict(payload.validated_data))
        return Response(_detail(request, auction.id), status=status.HTTP_201_CREATED)


def _detail(request: Request, auction_id: uuid.UUID) -> dict[str, Any]:
    user = _user(request)
    qs = (
        base_queryset(request)
        .select_related("seller", "seller__region", "direction", "breed")
        .filter(services.visible_to(user))
    )
    auction = qs.filter(id=auction_id).first()
    if auction is None:
        raise DomainError("not_found", "Auksion topilmadi.", status.HTTP_404_NOT_FOUND)
    return AuctionDetailSerializer(auction, context={"request": request}).data


class AuctionDetailView(APIView):
    def get_permissions(self) -> list[Any]:
        return [AllowAny()] if self.request.method == "GET" else [IsAuthenticated()]

    @extend_schema(responses=AuctionDetailSerializer)
    def get(self, request: Request, auction_id: uuid.UUID) -> Response:
        return Response(_detail(request, auction_id))

    @extend_schema(request=DraftSerializer, responses=AuctionDetailSerializer)
    def patch(self, request: Request, auction_id: uuid.UUID) -> Response:
        payload = DraftSerializer(data=request.data, partial=True)
        payload.is_valid(raise_exception=True)
        services.update_draft(auction_id, me(request), dict(payload.validated_data))
        return Response(_detail(request, auction_id))

    @extend_schema(responses={204: None})
    def delete(self, request: Request, auction_id: uuid.UUID) -> Response:
        services.delete_draft(auction_id, me(request))
        return Response(status=status.HTTP_204_NO_CONTENT)


class SubmitView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses=SubmitResultSerializer)
    def post(self, request: Request, auction_id: uuid.UUID) -> Response:
        result = services.submit(auction_id, me(request))
        return Response(
            {
                "outcome": result.outcome,
                "checks": [
                    {"check_name": r.name, "result": r.result, "message": r.message} for r in result.results
                ],
                "auction": _detail(request, auction_id),
            }
        )


class CancelView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=inline_serializer("CancelIn", {"reason": serializers.CharField(required=False)}),
        responses=AuctionDetailSerializer,
    )
    def post(self, request: Request, auction_id: uuid.UUID) -> Response:
        services.cancel(auction_id, me(request), str(data_of(request).get("reason", "")))
        return Response(_detail(request, auction_id))


class CaptureSessionView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=inline_serializer("CaptureSessionIn", {"auction_id": serializers.UUIDField()}),
        responses=inline_serializer(
            "CaptureSessionOut",
            {
                "id": serializers.UUIDField(),
                "expires_at": serializers.DateTimeField(),
                "photos_min": serializers.IntegerField(),
                "photos_max": serializers.IntegerField(),
                "videos_min": serializers.IntegerField(),
                "videos_max": serializers.IntegerField(),
                "video_max_s": serializers.IntegerField(),
            },
        ),
    )
    def post(self, request: Request) -> Response:
        from core.models import PlatformSettings

        try:
            auction_id = uuid.UUID(str(data_of(request).get("auction_id")))
        except ValueError as exc:
            raise DomainError("invalid", "auction_id notoʻgʻri.") from exc
        session = services.open_capture_session(
            auction_id, me(request), request.META.get("HTTP_USER_AGENT", "")
        )
        s = PlatformSettings.load()
        return Response(
            {
                "id": session.id,
                "expires_at": session.expires_at,
                "photos_min": s.photos_min,
                "photos_max": s.photos_max,
                "videos_min": s.videos_min,
                "videos_max": s.videos_max,
                "video_max_s": s.video_max_s,
            },
            status=status.HTTP_201_CREATED,
        )


class MediaUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        request={
            "multipart/form-data": inline_serializer(
                "MediaUpload",
                {
                    "file": serializers.FileField(),
                    "kind": serializers.ChoiceField(["photo", "video"]),
                    "capture_session_id": serializers.UUIDField(),
                    "client_meta": serializers.CharField(required=False),
                },
            )
        },
        responses={201: MediaSerializer},
    )
    def post(self, request: Request, auction_id: uuid.UUID) -> Response:
        upload = request.FILES.get("file")
        if upload is None:
            raise DomainError("invalid", "Fayl yuborilmadi.")
        try:
            session_id = uuid.UUID(str(data_of(request).get("capture_session_id")))
        except ValueError as exc:
            raise DomainError("capture_session_expired", "Kamera seansi topilmadi.") from exc
        try:
            meta = json.loads(str(data_of(request).get("client_meta") or "{}"))
        except json.JSONDecodeError:
            meta = {}
        item = services.add_media(
            auction_id,
            me(request),
            upload,
            str(data_of(request).get("kind")),
            session_id,
            meta if isinstance(meta, dict) else {},
        )
        item.refresh_from_db()
        return Response(MediaSerializer(item).data, status=status.HTTP_201_CREATED)


class MediaDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={204: None})
    def delete(self, request: Request, auction_id: uuid.UUID, media_id: uuid.UUID) -> Response:
        services.delete_media(auction_id, media_id, me(request))
        return Response(status=status.HTTP_204_NO_CONTENT)


class BidsView(APIView):
    def get_permissions(self) -> list[Any]:
        return [AllowAny()] if self.request.method == "GET" else [IsAuthenticated()]

    @extend_schema(responses=PublicBidSerializer(many=True))
    def get(self, request: Request, auction_id: uuid.UUID) -> Response:
        user = _user(request)
        auction = Auction.objects.filter(services.visible_to(user), id=auction_id).first()
        if auction is None:
            raise DomainError("not_found", "Auksion topilmadi.", status.HTTP_404_NOT_FOUND)
        rows = [
            {
                "rank": r.rank,
                "tier": r.tier,
                "pseudonym": r.pseudonym,
                "amount": r.bid.amount,
                "created_at": r.bid.created_at,
                "is_mine": user is not None and r.bid.bidder_id == user.id,
            }
            for r in services.ranked_bids(auction)
        ]
        return Response(rows)

    @extend_schema(
        request=inline_serializer("BidIn", {"amount": serializers.IntegerField(min_value=1)}),
        responses={201: PublicBidSerializer(many=True)},
    )
    def post(self, request: Request, auction_id: uuid.UUID) -> Response:
        try:
            amount = int(data_of(request).get("amount", ""))
        except (TypeError, ValueError) as exc:
            raise DomainError("invalid", "Summani kiriting.") from exc
        services.place_bid(auction_id, me(request), amount)
        response = self.get(request, auction_id)
        response.status_code = status.HTTP_201_CREATED
        return response


class DecisionView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=DecisionSerializer)
    def get(self, request: Request, auction_id: uuid.UUID) -> Response:
        auction = Auction.objects.filter(id=auction_id, seller=me(request)).first()
        if auction is None:
            raise DomainError("not_found", "Auksion topilmadi.", status.HTTP_404_NOT_FOUND)
        allowed, early_from = services.can_accept_now(auction)
        rows, recommended = services.decision_rows(auction)
        sort = request.query_params.get("sort", "amount")
        if sort == "distance":
            rows = sorted(rows, key=lambda r: (r.distance_km is None, r.distance_km or 0))

        def out(row: services.DecisionRow) -> dict[str, Any]:
            b = row.ranked.bid.bidder
            return {
                "bid_id": row.ranked.bid.id,
                "rank": row.ranked.rank,
                "tier": row.ranked.tier,
                "pseudonym": row.ranked.pseudonym,
                "amount": row.ranked.bid.amount,
                "distance_km": row.distance_km,
                "rating_avg": float(b.rating_avg) if b.rating_avg is not None else None,
                "rating_count": b.rating_count,
                "deals_count": b.deals_count,
                "tags": row.tags,
            }

        return Response(
            {
                "deadline": auction.decision_deadline,
                "can_accept_now": allowed,
                "early_accept_from": early_from,
                "commission_rate_bp": auction.commission_rate_bp or 0,
                "recommended": [out(r) for r in recommended],
                "bids": [out(r) for r in rows],
            }
        )


class AcceptView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=inline_serializer("AcceptIn", {"bid_id": serializers.UUIDField()}),
        responses={201: inline_serializer("AcceptOut", {"deal_id": serializers.UUIDField()})},
    )
    def post(self, request: Request, auction_id: uuid.UUID) -> Response:
        try:
            bid_id = uuid.UUID(str(data_of(request).get("bid_id")))
        except ValueError as exc:
            raise DomainError("bid_not_active", "Taklif topilmadi.") from exc
        deal = services.accept_bid(auction_id, me(request), bid_id)
        return Response({"deal_id": deal.id}, status=status.HTTP_201_CREATED)


class RejectAllView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses=AuctionDetailSerializer)
    def post(self, request: Request, auction_id: uuid.UUID) -> Response:
        services.reject_all(auction_id, me(request), str(data_of(request).get("reason", "")))
        return Response(_detail(request, auction_id))


class WatchView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={204: None})
    def post(self, request: Request, auction_id: uuid.UUID) -> Response:
        services.watch(auction_id, me(request))
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(responses={204: None})
    def delete(self, request: Request, auction_id: uuid.UUID) -> Response:
        services.unwatch(auction_id, me(request))
        return Response(status=status.HTTP_204_NO_CONTENT)


class MyAuctionsView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(parameters=[OpenApiParameter("status", str)], responses=AuctionListSerializer(many=True))
    def get(self, request: Request) -> Response:
        qs = base_queryset(request).filter(seller=me(request)).order_by("-created_at")
        if st := request.query_params.get("status"):
            qs = qs.filter(status__in=st.split(","))
        return Response(AuctionListSerializer(qs[:200], many=True, context={"request": request}).data)


class WatchlistView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=AuctionListSerializer(many=True))
    def get(self, request: Request) -> Response:
        qs = (
            base_queryset(request)
            .filter(watchers__user=me(request))
            .filter(services.visible_to(_user(request)))
            .order_by(F("ends_at").asc(nulls_last=True))
        )
        return Response(AuctionListSerializer(qs[:200], many=True, context={"request": request}).data)


class MyBidsView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=MyBidRowSerializer(many=True))
    def get(self, request: Request) -> Response:
        user = me(request)
        auction_ids = list(
            Bid.objects.filter(bidder=user)
            .exclude(status=Bid.BidStatus.VOID)
            .values_list("auction_id", flat=True)
            .distinct()
        )
        auctions = (
            base_queryset(request).select_related("deal").filter(id__in=auction_ids).order_by("-updated_at")
        )
        rows = []
        for a in auctions:
            ranked = services.ranked_bids(a)
            mine = next((r for r in ranked if r.bid.bidder_id == user.id), None)
            last = Bid.objects.filter(auction=a, bidder=user).order_by("-created_at").first()
            deal = getattr(a, "deal", None) if a.status == Status.SOLD else None
            if deal is not None and deal.buyer_id == user.id:
                state, deal_id = "won", deal.id
            elif a.status in (Status.LIVE, Status.SCHEDULED, Status.ENDED):
                state, deal_id = "active", None
            else:
                state, deal_id = "lost", None
            rows.append(
                {
                    "auction": AuctionListSerializer(a, context={"request": request}).data,
                    "amount": mine.bid.amount if mine else (last.amount if last else 0),
                    "rank": mine.rank if mine else None,
                    "tier": mine.tier if mine else None,
                    "state": state,
                    "deal_id": deal_id,
                }
            )
        return Response(rows)
