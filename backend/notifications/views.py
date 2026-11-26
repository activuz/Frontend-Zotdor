from __future__ import annotations

from django.conf import settings
from django.db.models import QuerySet
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.generics import ListAPIView
from rest_framework.pagination import CursorPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.http import data_of
from notifications import services
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
        request=inline_serializer(
            "MarkRead", {"ids": serializers.ListField(child=serializers.IntegerField(), required=False)}
        ),
        responses={204: None},
    )
    def post(self, request: Request) -> Response:
        qs = Notification.objects.filter(user=request.user, read_at__isnull=True)  # type: ignore[misc]
        ids = request.data.get("ids") if isinstance(request.data, dict) else None
        if isinstance(ids, list):
            qs = qs.filter(id__in=[i for i in ids if isinstance(i, int)])
        qs.update(read_at=timezone.now())
        return Response(status=204)


# --- Web Push (FR-20) ----------------------------------------------------------------------------


class PushPublicKeyView(APIView):
    """VAPID public key for `pushManager.subscribe`; null when push is not configured."""

    permission_classes = [AllowAny]
    authentication_classes: list[type] = []

    @extend_schema(
        responses=inline_serializer("PushPublicKey", {"public_key": serializers.CharField(allow_null=True)})
    )
    def get(self, request: Request) -> Response:
        return Response({"public_key": settings.VAPID_PUBLIC_KEY if services.push_enabled() else None})


class PushSubscriptionView(APIView):
    """This browser's push subscription, exactly as `PushSubscription.toJSON()` gives it."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=inline_serializer(
            "PushSubscriptionIn",
            {
                "endpoint": serializers.CharField(),
                "keys": inline_serializer(
                    "PushSubscriptionKeys",
                    {"p256dh": serializers.CharField(), "auth": serializers.CharField()},
                ),
            },
        ),
        responses={201: None},
    )
    def post(self, request: Request) -> Response:
        data = data_of(request)
        keys = data.get("keys")
        keys = keys if isinstance(keys, dict) else {}
        services.save_subscription(
            request.user,  # type: ignore[arg-type]
            str(data.get("endpoint", "") or ""),
            str(keys.get("p256dh", "") or ""),
            str(keys.get("auth", "") or ""),
            request.META.get("HTTP_USER_AGENT", ""),
        )
        return Response(status=201)

    @extend_schema(
        request=inline_serializer("PushUnsubscribeIn", {"endpoint": serializers.CharField()}),
        responses={204: None},
    )
    def delete(self, request: Request) -> Response:
        endpoint = str(data_of(request).get("endpoint", "") or "")
        services.delete_subscription(request.user, endpoint)  # type: ignore[arg-type]
        return Response(status=204)


class DeviceView(APIView):
    """The Android app's Firebase token (FR-21), sent by the site running inside the app."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=inline_serializer(
            "DeviceIn",
            {
                "token": serializers.CharField(),
                "platform": serializers.ChoiceField(["android"]),
                "app_version": serializers.CharField(required=False),
            },
        ),
        responses={201: None},
    )
    def post(self, request: Request) -> Response:
        data = data_of(request)
        services.save_device(
            request.user,  # type: ignore[arg-type]
            str(data.get("token", "") or ""),
            str(data.get("platform", "") or ""),
            str(data.get("app_version", "") or ""),
        )
        return Response(status=201)

    @extend_schema(
        request=inline_serializer("DeviceOut", {"token": serializers.CharField()}),
        responses={204: None},
    )
    def delete(self, request: Request) -> Response:
        services.delete_device(request.user, str(data_of(request).get("token", "") or ""))  # type: ignore[arg-type]
        return Response(status=204)
