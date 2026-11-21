from __future__ import annotations

from typing import Any

from rest_framework import serializers

from accounts.models import User
from reference.models import District, Region


class LoginStartSerializer(serializers.Serializer[None]):
    phone = serializers.CharField(max_length=32)


class LoginStartResponseSerializer(serializers.Serializer[None]):
    request_id = serializers.UUIDField()
    deep_link = serializers.URLField()
    expires_at = serializers.DateTimeField()


class PlaceSerializer(serializers.Serializer[None]):
    id = serializers.IntegerField()
    name = serializers.CharField()


class MeSerializer(serializers.ModelSerializer[User]):
    region = PlaceSerializer(read_only=True, allow_null=True)
    district = PlaceSerializer(read_only=True, allow_null=True)
    needs_profile = serializers.BooleanField(read_only=True)

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
            "created_at",
        ]
        read_only_fields = fields


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
