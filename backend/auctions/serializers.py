from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.conf import settings
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from accounts.models import User
from auctions import media as media_store
from auctions import services
from auctions.models import Auction, AuctionCheck, AuctionMedia
from reference.models import AnimalClass, AnimalType, Breed, Direction, District


class RefSerializer(serializers.Serializer[Any]):
    id = serializers.IntegerField()
    name = serializers.CharField()


def display_name(user: User) -> str:
    """BR-24/33: first name + surname initial for public places."""
    last = f" {user.last_name[:1]}." if user.last_name else ""
    return f"{user.first_name or 'Foydalanuvchi'}{last}"


class PublicUserSerializer(serializers.ModelSerializer[User]):
    display_name = serializers.SerializerMethodField()
    member_since = serializers.DateTimeField(source="created_at")
    rating_avg = serializers.FloatField(allow_null=True)
    region = RefSerializer(allow_null=True)

    class Meta:
        model = User
        fields = ["id", "display_name", "rating_avg", "rating_count", "deals_count", "member_since", "region"]

    def get_display_name(self, obj: User) -> str:
        return display_name(obj)


class MediaSerializer(serializers.ModelSerializer[AuctionMedia]):
    url = serializers.SerializerMethodField()
    thumb_url = serializers.SerializerMethodField()

    class Meta:
        model = AuctionMedia
        fields = ["id", "kind", "status", "error", "url", "thumb_url", "width", "height", "duration_ms"]

    def get_url(self, obj: AuctionMedia) -> str:
        return media_store.url(obj.file_path)

    def get_thumb_url(self, obj: AuctionMedia) -> str:
        return media_store.url(obj.thumb_path)


def _cover(obj: Auction) -> dict[str, Any] | None:
    for m in obj.media.all():
        if m.kind == AuctionMedia.Kind.PHOTO and m.status == AuctionMedia.MediaStatus.READY:
            return {"thumb_url": media_store.url(m.thumb_path), "url": media_store.url(m.file_path)}
    return None


class CoverSerializer(serializers.Serializer[Any]):
    url = serializers.CharField()
    thumb_url = serializers.CharField()


def _preview_video(obj: Auction) -> dict[str, Any] | None:
    """First processed video: cards play it on hover. Uses the prefetched media, no extra query."""
    for m in obj.media.all():
        if m.kind == AuctionMedia.Kind.VIDEO and m.status == AuctionMedia.MediaStatus.READY and m.file_path:
            return {"url": media_store.url(m.file_path), "poster_url": media_store.url(m.thumb_path)}
    return None


class PreviewVideoSerializer(serializers.Serializer[Any]):
    url = serializers.CharField()
    poster_url = serializers.CharField()


class AuctionListSerializer(serializers.ModelSerializer[Auction]):
    cover = serializers.SerializerMethodField()
    preview_video = serializers.SerializerMethodField()
    region = RefSerializer(allow_null=True)
    district = RefSerializer(allow_null=True)
    animal_type = RefSerializer(allow_null=True)
    animal_class = RefSerializer(allow_null=True)
    distance_km = serializers.SerializerMethodField()
    is_watched = serializers.SerializerMethodField()
    age_label = serializers.SerializerMethodField()

    class Meta:
        model = Auction
        fields = [
            "id",
            "title",
            "status",
            "cover",
            "preview_video",
            "asking_price",
            "top_bid_amount",
            "bidders_count",
            "active_bids_count",
            "starts_at",
            "ends_at",
            "region",
            "district",
            "distance_km",
            "animal_type",
            "animal_class",
            "age_label",
            "weight_kg",
            "weight_is_estimated",
            "is_watched",
        ]

    @extend_schema_field(CoverSerializer(allow_null=True))
    def get_cover(self, obj: Auction) -> dict[str, Any] | None:
        return _cover(obj)

    @extend_schema_field(PreviewVideoSerializer(allow_null=True))
    def get_preview_video(self, obj: Auction) -> dict[str, Any] | None:
        return _preview_video(obj)

    def get_distance_km(self, obj: Auction) -> float | None:
        value = getattr(obj, "distance_km", None)
        return round(float(value), 1) if value is not None else None

    def get_is_watched(self, obj: Auction) -> bool:
        return bool(getattr(obj, "is_watched", False))

    def get_age_label(self, obj: Auction) -> str:
        return services.format_age(obj.age_months)


class CheckSerializer(serializers.ModelSerializer[AuctionCheck]):
    class Meta:
        model = AuctionCheck
        fields = ["check_name", "result", "message"]


class MyBidSerializer(serializers.Serializer[Any]):
    amount = serializers.IntegerField()
    rank = serializers.IntegerField()
    tier = serializers.CharField()


class PointSerializer(serializers.Serializer[Any]):
    lat = serializers.FloatField()
    lng = serializers.FloatField()


class AreaSerializer(PointSerializer):
    radius_m = serializers.IntegerField()


# BR-33a: strangers see the pin only as the centre of a ~1 km grid cell with a radius that
# always covers the real point (cell half-diagonal is < 800 m in Uzbekistan).
AREA_STEP = Decimal("0.01")
AREA_RADIUS_M = 1500


def pinned_point(obj: Auction) -> dict[str, float] | None:
    if not obj.location_pinned or obj.lat is None or obj.lng is None:
        return None
    return {"lat": float(obj.lat), "lng": float(obj.lng)}


def approximate_area(obj: Auction) -> dict[str, Any] | None:
    if not obj.location_pinned or obj.lat is None or obj.lng is None:
        return None
    return {
        "lat": float(obj.lat.quantize(AREA_STEP)),
        "lng": float(obj.lng.quantize(AREA_STEP)),
        "radius_m": AREA_RADIUS_M,
    }


class OwnerInfoSerializer(serializers.Serializer[Any]):
    hold_amount = serializers.IntegerField(allow_null=True)
    decision_deadline = serializers.DateTimeField(allow_null=True)
    can_cancel = serializers.BooleanField()
    can_accept_now = serializers.BooleanField()
    early_accept_from = serializers.DateTimeField(allow_null=True)
    rejection_reason = serializers.CharField()
    checks = CheckSerializer(many=True)
    pin = PointSerializer(allow_null=True)


class AuctionDetailSerializer(AuctionListSerializer):
    media = MediaSerializer(many=True)
    direction = RefSerializer(allow_null=True)
    breed = RefSerializer(allow_null=True)
    seller = PublicUserSerializer()
    my_bid = serializers.SerializerMethodField()
    owner = serializers.SerializerMethodField()
    deal_id = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()
    area = serializers.SerializerMethodField()

    class Meta(AuctionListSerializer.Meta):
        fields = [
            *AuctionListSerializer.Meta.fields,
            "media",
            "description",
            "direction",
            "breed",
            "breed_other",
            "age_months",
            "min_bid",
            "max_bid",
            "seller",
            "my_bid",
            "owner",
            "deal_id",
            "is_owner",
            "start_now",
            "duration_minutes",
            "decision_deadline",
            "published_at",
            "area",
        ]

    @extend_schema_field(AreaSerializer(allow_null=True))
    def get_area(self, obj: Auction) -> dict[str, Any] | None:
        return approximate_area(obj)

    def _viewer(self) -> User | None:
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return user if user is not None and user.is_authenticated else None

    def get_is_owner(self, obj: Auction) -> bool:
        viewer = self._viewer()
        return viewer is not None and viewer.id == obj.seller_id

    @extend_schema_field(MyBidSerializer(allow_null=True))
    def get_my_bid(self, obj: Auction) -> dict[str, Any] | None:
        viewer = self._viewer()
        if viewer is None:
            return None
        for r in services.ranked_bids(obj):
            if r.bid.bidder_id == viewer.id:
                return {"amount": r.bid.amount, "rank": r.rank, "tier": r.tier}
        return None

    @extend_schema_field(OwnerInfoSerializer(allow_null=True))
    def get_owner(self, obj: Auction) -> dict[str, Any] | None:
        if not self.get_is_owner(obj):
            return None
        allowed, early_from = services.can_accept_now(obj)
        last_run = obj.checks.order_by("-created_at").values_list("run_id", flat=True).first()
        checks = obj.checks.filter(run_id=last_run) if last_run else obj.checks.none()
        has_bids = obj.active_bids_count > 0
        return {
            "hold_amount": obj.hold_amount,
            "decision_deadline": obj.decision_deadline,
            "can_cancel": obj.status in ("pending_review", "scheduled")
            or (obj.status == "live" and not has_bids),
            "can_accept_now": allowed and has_bids,
            "early_accept_from": early_from,
            "rejection_reason": obj.rejection_reason,
            "checks": CheckSerializer(checks, many=True).data,
            "pin": pinned_point(obj),
        }

    def get_deal_id(self, obj: Auction) -> str | None:
        viewer = self._viewer()
        deal = getattr(obj, "deal", None) if obj.status == "sold" else None
        if deal is not None and viewer is not None and viewer.id in (deal.seller_id, deal.buyer_id):
            return str(deal.id)
        return None


class DraftSerializer(serializers.Serializer[Any]):
    direction_id = serializers.PrimaryKeyRelatedField(
        queryset=Direction.objects.filter(is_active=True), source="direction", required=False, allow_null=True
    )
    animal_type_id = serializers.PrimaryKeyRelatedField(
        queryset=AnimalType.objects.filter(is_active=True),
        source="animal_type",
        required=False,
        allow_null=True,
    )
    animal_class_id = serializers.PrimaryKeyRelatedField(
        queryset=AnimalClass.objects.filter(is_active=True),
        source="animal_class",
        required=False,
        allow_null=True,
    )
    breed_id = serializers.PrimaryKeyRelatedField(
        queryset=Breed.objects.filter(is_active=True), source="breed", required=False, allow_null=True
    )
    breed_other = serializers.CharField(max_length=64, required=False, allow_blank=True)
    age_months = serializers.IntegerField(min_value=0, max_value=480, required=False, allow_null=True)
    weight_kg = serializers.IntegerField(min_value=0, max_value=3000, required=False, allow_null=True)
    weight_is_estimated = serializers.BooleanField(required=False)
    description = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    asking_price = serializers.IntegerField(
        min_value=1000, max_value=10_000_000_000, required=False, allow_null=True
    )
    district_id = serializers.PrimaryKeyRelatedField(
        queryset=District.objects.all(), source="district", required=False, allow_null=True
    )
    start_now = serializers.BooleanField(required=False)
    starts_at = serializers.DateTimeField(required=False, allow_null=True)
    duration_minutes = serializers.IntegerField(min_value=1, max_value=1440, required=False, allow_null=True)
    # Optional map pin (BR-11a). Send both, or both null to remove it.
    lat = serializers.FloatField(required=False, allow_null=True)
    lng = serializers.FloatField(required=False, allow_null=True)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if ("lat" in attrs) != ("lng" in attrs) or (attrs.get("lat") is None) != (attrs.get("lng") is None):
            raise serializers.ValidationError({"lat": "Kenglik va uzunlik birga yuboriladi."})
        return attrs


class MediaOrderSerializer(serializers.Serializer[Any]):
    ids = serializers.ListField(child=serializers.UUIDField(), max_length=50)


class SubmitResultSerializer(serializers.Serializer[Any]):
    outcome = serializers.ChoiceField(["published", "pending_review", "rejected"])
    checks = CheckSerializer(many=True)
    auction = AuctionDetailSerializer()


class PublicBidSerializer(serializers.Serializer[Any]):
    rank = serializers.IntegerField()
    tier = serializers.CharField()
    pseudonym = serializers.CharField()
    amount = serializers.IntegerField()
    created_at = serializers.DateTimeField()
    is_mine = serializers.BooleanField()


class DecisionBidSerializer(serializers.Serializer[Any]):
    bid_id = serializers.UUIDField()
    rank = serializers.IntegerField()
    tier = serializers.CharField()
    pseudonym = serializers.CharField()
    amount = serializers.IntegerField()
    distance_km = serializers.FloatField(allow_null=True)
    rating_avg = serializers.FloatField(allow_null=True)
    rating_count = serializers.IntegerField()
    deals_count = serializers.IntegerField()
    tags = serializers.ListField(child=serializers.CharField())


class DecisionSerializer(serializers.Serializer[Any]):
    deadline = serializers.DateTimeField(allow_null=True)
    can_accept_now = serializers.BooleanField()
    early_accept_from = serializers.DateTimeField(allow_null=True)
    commission_rate_bp = serializers.IntegerField()
    recommended = DecisionBidSerializer(many=True)
    bids = DecisionBidSerializer(many=True)


class MyBidRowSerializer(serializers.Serializer[Any]):
    auction = AuctionListSerializer()
    amount = serializers.IntegerField()
    rank = serializers.IntegerField(allow_null=True)
    tier = serializers.CharField(allow_null=True)
    state = serializers.ChoiceField(["active", "won", "lost"])
    deal_id = serializers.UUIDField(allow_null=True)


def media_settings() -> dict[str, Any]:
    return {"photo_max_bytes": settings.PHOTO_MAX_BYTES, "video_max_bytes": settings.VIDEO_MAX_BYTES}
