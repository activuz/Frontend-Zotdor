from __future__ import annotations

from typing import Any

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from accounts.models import User
from reference.models import District, Region


class LoginStartSerializer(serializers.Serializer[None]):
    phone = serializers.CharField(max_length=32)
    client = serializers.ChoiceField(["web", "app"], required=False, default="web")


class LoginStartResponseSerializer(serializers.Serializer[None]):
    request_id = serializers.UUIDField()
    deep_link = serializers.URLField()
    expires_at = serializers.DateTimeField()


class PlaceSerializer(serializers.Serializer[None]):
    id = serializers.IntegerField()
    name = serializers.CharField()


class SavedPointSerializer(serializers.Serializer[None]):
    lat = serializers.FloatField()
    lng = serializers.FloatField()


class MeSerializer(serializers.ModelSerializer[User]):
    region = PlaceSerializer(read_only=True, allow_null=True)
    district = PlaceSerializer(read_only=True, allow_null=True)
    needs_profile = serializers.BooleanField(read_only=True)
    has_location = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "phone",
            "first_name",
            "last_name",
            "telegram_username",
            "role",
            "region",
            "district",
            "needs_profile",
            "has_location",
            "location",
            "created_at",
        ]
        read_only_fields = fields

    def get_has_location(self, obj: User) -> bool:
        return obj.lat is not None and obj.lng is not None

    # Only ever serialized for the user themself (`/me`), so the map can show their saved point.
    @extend_schema_field(SavedPointSerializer(allow_null=True))
    def get_location(self, obj: User) -> dict[str, float] | None:
        if obj.lat is None or obj.lng is None:
            return None
        return {"lat": float(obj.lat), "lng": float(obj.lng)}


class LoginStatusSerializer(serializers.Serializer[None]):
    status = serializers.ChoiceField(["pending", "verified", "failed", "expired"])
    fail_reason = serializers.CharField(required=False)
    message = serializers.CharField(required=False)
    user = MeSerializer(required=False)


class ProfileUpdateSerializer(serializers.Serializer[None]):
    first_name = serializers.CharField(max_length=64, required=False)
    last_name = serializers.CharField(max_length=64, required=False, allow_blank=True)
    region_id = serializers.PrimaryKeyRelatedField(
        queryset=Region.objects.all(), source="region", required=False
    )
    district_id = serializers.PrimaryKeyRelatedField(
        queryset=District.objects.all(), source="district", required=False
    )

    def validate_first_name(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Ismingizni kiriting.")
        return value

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        user: User = self.context["user"]
        region = attrs.get("region", user.region)
        district = attrs.get("district", user.district)
        if district is not None and (region is None or district.region_id != region.id):
            raise serializers.ValidationError({"district_id": ["Tuman tanlangan viloyatga tegishli emas."]})
        if "region" in attrs and "district" not in attrs and user.district_id:
            # Changing the region without a district would leave a district from another region.
            raise serializers.ValidationError({"district_id": ["Yangi viloyat uchun tumanni tanlang."]})
        return attrs
