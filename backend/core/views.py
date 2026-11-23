from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.db import DatabaseError, connection
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import WorkerHeartbeat


class HealthView(APIView):
    """Liveness for monitoring: 503 if the database is unreachable."""

    permission_classes = [AllowAny]
    authentication_classes: list[type] = []

    @extend_schema(
        responses=inline_serializer(
            "Health",
            {
                "status": serializers.ChoiceField(["ok", "degraded", "down"]),
                "db": serializers.ChoiceField(["ok", "down"]),
                "worker": serializers.ChoiceField(["ok", "stale", "unknown"]),
            },
        )
    )
    def get(self, request: Request) -> Response:
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
        except DatabaseError:
            return Response({"status": "down", "db": "down", "worker": "unknown"}, status=503)

        beat = WorkerHeartbeat.objects.filter(id=1).values_list("beat_at", flat=True).first()
        if beat is None:
            worker = "unknown"
        elif timezone.now() - beat > timedelta(seconds=settings.WORKER_HEARTBEAT_STALE_SECONDS):
            worker = "stale"
        else:
            worker = "ok"
        overall = "ok" if worker == "ok" else "degraded"
        return Response({"status": overall, "db": "ok", "worker": worker})


class PublicConfigView(APIView):
    """Business limits the client needs to explain rules before submit (FR-03, BR-41)."""

    permission_classes = [AllowAny]

    @extend_schema(
        responses=inline_serializer(
            "PublicConfig",
            {
                "commission_rate_bp": serializers.IntegerField(),
                "min_duration_min": serializers.IntegerField(),
                "max_duration_min": serializers.IntegerField(),
                "max_schedule_ahead_days": serializers.IntegerField(),
                "photos_min": serializers.IntegerField(),
                "photos_max": serializers.IntegerField(),
                "videos_min": serializers.IntegerField(),
                "videos_max": serializers.IntegerField(),
                "video_max_s": serializers.IntegerField(),
                "min_bid_pct": serializers.IntegerField(),
                "max_bid_pct": serializers.IntegerField(),
                "topup_min": serializers.IntegerField(),
                "topup_max": serializers.IntegerField(),
            },
        )
    )
    def get(self, request: Request) -> Response:
        from core.models import PlatformSettings

        s = PlatformSettings.load()
        return Response(
            {
                "commission_rate_bp": s.commission_rate_bp,
                "min_duration_min": s.min_duration_min,
                "max_duration_min": s.max_duration_min,
                "max_schedule_ahead_days": s.max_schedule_ahead_days,
                "photos_min": s.photos_min,
                "photos_max": s.photos_max,
                "videos_min": s.videos_min,
                "videos_max": s.videos_max,
                "video_max_s": s.video_max_s,
                "min_bid_pct": s.min_bid_pct,
                "max_bid_pct": s.max_bid_pct,
                "topup_min": settings.TOPUP_MIN,
                "topup_max": settings.TOPUP_MAX,
            }
        )
