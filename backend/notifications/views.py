from __future__ import annotations

from django.db.models import QuerySet
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.generics import ListAPIView
from rest_framework.pagination import CursorPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer[Notification]):
    class Meta:
        model = Notification
        fields = ["id", "type", "title", "body", "link", "read_at", "created_at"]
        read_only_fields = fields


class NotificationPagination(CursorPagination):
    ordering = "-id"
    page_size = 30


class NotificationListView(ListAPIView[Notification]):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer
    pagination_class = NotificationPagination

    def get_queryset(self) -> QuerySet[Notification]:
        return Notification.objects.filter(user=self.request.user)  # type: ignore[misc]


class UnreadCountView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=inline_serializer("UnreadCount", {"count": serializers.IntegerField()}))
    def get(self, request: Request) -> Response:
        count = Notification.objects.filter(user=request.user, read_at__isnull=True).count()  # type: ignore[misc]
        return Response({"count": count})


class MarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=inline_serializer("MarkRead", {"ids": serializers.ListField(child=serializers.IntegerField(), required=False)}),
        responses={204: None},
    )
    def post(self, request: Request) -> Response:
        qs = Notification.objects.filter(user=request.user, read_at__isnull=True)  # type: ignore[misc]
        ids = request.data.get("ids") if isinstance(request.data, dict) else None
        if isinstance(ids, list):
            qs = qs.filter(id__in=[i for i in ids if isinstance(i, int)])
        qs.update(read_at=timezone.now())
        return Response(status=204)
