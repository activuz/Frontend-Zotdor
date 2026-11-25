from __future__ import annotations

import uuid
from typing import Any

from django.db.models import Q
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from auctions import media as media_store
from auctions.serializers import PointSerializer, display_name, pinned_point
from core.http import data_of, me
from deals import services
from deals.models import Deal, DealClaim, Rating


class CounterpartySerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    name = serializers.CharField()
    phone = serializers.CharField()
    telegram_username = serializers.CharField()
    rating_avg = serializers.FloatField(allow_null=True)
    rating_count = serializers.IntegerField()


class DealSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField()
    auction_id = serializers.UUIDField()
    title = serializers.CharField()
    cover_url = serializers.CharField()
    price = serializers.IntegerField()
    commission_amount = serializers.IntegerField(allow_null=True)
    status = serializers.CharField()
    role = serializers.ChoiceField(["seller", "buyer"])
    created_at = serializers.DateTimeField()
    counterparty = CounterpartySerializer()
    my_rating = serializers.IntegerField(allow_null=True)
    can_rate = serializers.BooleanField()
    can_claim = serializers.BooleanField()
    claim_status = serializers.CharField(allow_null=True)
    # BR-33a: the seller's exact pin, if any, opens together with the contacts.
    location = PointSerializer(allow_null=True)


def serialize(deal: Deal, viewer: User) -> dict[str, Any]:
    seller_side = viewer.id == deal.seller_id
    other = deal.buyer if seller_side else deal.seller
    cover = next((m for m in deal.auction.media.all() if m.kind == "photo" and m.status == "ready"), None)
    claim = deal.claims.order_by("-created_at").first()
    rating = Rating.objects.filter(deal=deal, author=viewer).first()
    return {
        "id": deal.id,
        "auction_id": deal.auction_id,
        "title": deal.auction.title,
        "cover_url": media_store.url(cover.thumb_path) if cover else "",
        "price": deal.price,
        "commission_amount": deal.commission_amount if seller_side else None,
        "status": deal.status,
        "role": "seller" if seller_side else "buyer",
        "created_at": deal.created_at,
        # BR-33: contacts are revealed only to the two parties of an accepted deal.
        "counterparty": {
            "id": other.id,
            "name": f"{other.first_name} {other.last_name}".strip() or display_name(other),
            "phone": other.phone,
            "telegram_username": other.telegram_username,
            "rating_avg": float(other.rating_avg) if other.rating_avg is not None else None,
            "rating_count": other.rating_count,
        },
        "my_rating": rating.score if rating else None,
        "can_rate": services.can_rate(deal, viewer),
        "can_claim": services.can_claim(deal, viewer),
        "claim_status": claim.status if claim else None,
        "location": pinned_point(deal.auction),
    }


class MyDealsView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=DealSerializer(many=True))
    def get(self, request: Request) -> Response:
        user = me(request)
        deals = (
            Deal.objects.filter(Q(seller=user) | Q(buyer=user))
            .select_related("auction", "seller", "buyer")
            .prefetch_related("auction__media", "claims")
            .order_by("-created_at")[:200]
        )
        return Response([serialize(d, user) for d in deals])


class DealDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=DealSerializer)
    def get(self, request: Request, deal_id: uuid.UUID) -> Response:
        user = me(request)
        return Response(serialize(services.get_for_party(deal_id, user), user))


class RatingView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=inline_serializer(
            "RatingIn",
            {
                "score": serializers.IntegerField(min_value=1, max_value=5),
                "comment": serializers.CharField(required=False),
            },
        ),
        responses={201: DealSerializer},
    )
    def post(self, request: Request, deal_id: uuid.UUID) -> Response:
        user = me(request)
        try:
            score = int(data_of(request).get("score", ""))
        except (TypeError, ValueError):
            score = 0
        services.rate(deal_id, user, score, str(data_of(request).get("comment", ""))[:500])
        return Response(
            serialize(services.get_for_party(deal_id, user), user), status=status.HTTP_201_CREATED
        )


class ClaimView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=inline_serializer("ClaimIn", {"reason": serializers.CharField()}),
        responses={201: DealSerializer},
    )
    def post(self, request: Request, deal_id: uuid.UUID) -> Response:
        user = me(request)
        services.file_claim(deal_id, user, str(data_of(request).get("reason", ""))[:1000])
        return Response(
            serialize(services.get_for_party(deal_id, user), user), status=status.HTTP_201_CREATED
        )


_ = DealClaim  # referenced for schema readers
