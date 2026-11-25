from __future__ import annotations

from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from core.http import data_of
from feedback.services import create_report


class BugReportCreateView(APIView):
    """ "Xatolik haqida xabar berish" (FR-19). Guests too; a logged-in user is attached."""

    permission_classes = [AllowAny]

    @extend_schema(
        request=inline_serializer(
            "BugReportIn",
            {
                "message": serializers.CharField(),
                "contact": serializers.CharField(required=False, allow_blank=True),
                "page_url": serializers.CharField(required=False, allow_blank=True),
                "viewport": serializers.CharField(required=False, allow_blank=True),
                "error": serializers.CharField(required=False, allow_blank=True),
            },
        ),
        responses={201: inline_serializer("BugReportCreated", {"id": serializers.UUIDField()})},
    )
    def post(self, request: Request) -> Response:
        data = data_of(request)
        user = request.user if isinstance(request.user, User) else None
        report = create_report(
            user=user,
            message=str(data.get("message", "") or ""),
            contact=str(data.get("contact", "") or ""),
            page_url=str(data.get("page_url", "") or ""),
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
            viewport=str(data.get("viewport", "") or ""),
            error=str(data.get("error", "") or ""),
            ip=request.META.get("HTTP_X_REAL_IP") or request.META.get("REMOTE_ADDR"),
        )
        return Response({"id": report.id}, status=status.HTTP_201_CREATED)
