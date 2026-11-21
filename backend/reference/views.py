from __future__ import annotations

from django.db.models import Prefetch
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from reference.models import AnimalType, Direction, Region
from reference.serializers import RegionSerializer, TaxonomySerializer

# Reference data changes rarely; let browsers and proxies cache it briefly.
CACHE_HEADER = "public, max-age=300"


class RegionListView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(responses=RegionSerializer(many=True))
    def get(self, request: Request) -> Response:
        regions = Region.objects.prefetch_related("districts")
        response = Response(RegionSerializer(regions, many=True).data)
        response["Cache-Control"] = CACHE_HEADER
        return response


class TaxonomyView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(responses=TaxonomySerializer)
    def get(self, request: Request) -> Response:
        types = AnimalType.objects.filter(is_active=True).prefetch_related(
            "directions", Prefetch("classes"), Prefetch("breeds")
        )
        data = TaxonomySerializer(
            {"directions": Direction.objects.filter(is_active=True), "animal_types": types}
        ).data
        response = Response(data)
        response["Cache-Control"] = CACHE_HEADER
        return response
