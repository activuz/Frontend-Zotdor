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
