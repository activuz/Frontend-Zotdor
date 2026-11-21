from __future__ import annotations

from typing import Any

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from reference.models import AnimalClass, AnimalType, Breed, Direction, District, Region


class DistrictSerializer(serializers.ModelSerializer[District]):
    class Meta:
        model = District
        fields = ["id", "name"]


class RegionSerializer(serializers.ModelSerializer[Region]):
    districts = DistrictSerializer(many=True, read_only=True)

    class Meta:
        model = Region
        fields = ["id", "name", "districts"]


class DirectionSerializer(serializers.ModelSerializer[Direction]):
    class Meta:
        model = Direction
        fields = ["id", "slug", "name"]


class AnimalClassSerializer(serializers.ModelSerializer[AnimalClass]):
    class Meta:
        model = AnimalClass
        fields = ["id", "name", "sex", "age_hint"]


class BreedSerializer(serializers.ModelSerializer[Breed]):
    class Meta:
        model = Breed
        fields = ["id", "name"]


class AnimalTypeSerializer(serializers.ModelSerializer[AnimalType]):
    direction_ids = serializers.SerializerMethodField()
    classes = serializers.SerializerMethodField()
    breeds = serializers.SerializerMethodField()

    class Meta:
        model = AnimalType
        fields = ["id", "slug", "name", "direction_ids", "classes", "breeds"]

    def get_direction_ids(self, obj: AnimalType) -> list[int]:
        return [d.id for d in obj.directions.all() if d.is_active]

    @extend_schema_field(AnimalClassSerializer(many=True))
    def get_classes(self, obj: AnimalType) -> list[dict[str, object]]:
        active = [c for c in obj.classes.all() if c.is_active]
        return AnimalClassSerializer(active, many=True).data  # type: ignore[return-value]

    @extend_schema_field(BreedSerializer(many=True))
    def get_breeds(self, obj: AnimalType) -> list[dict[str, object]]:
        active = [b for b in obj.breeds.all() if b.is_active]
        return BreedSerializer(active, many=True).data  # type: ignore[return-value]


class TaxonomySerializer(serializers.Serializer[dict[str, Any]]):
    directions = DirectionSerializer(many=True)
    animal_types = AnimalTypeSerializer(many=True)
