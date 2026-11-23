from __future__ import annotations

from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.http import data_of
from leads.models import Lead
from leads.services import create_lead


class LeadCreateView(APIView):
    """Public contact form on the landing page (FR-18). No session is used, so no CSRF check."""

    permission_classes = [AllowAny]
    authentication_classes: list[type] = []

    @extend_schema(
        request=inline_serializer(
            "LeadIn",
            {
                "name": serializers.CharField(),
                "phone": serializers.CharField(),
                "role": serializers.ChoiceField(Lead.Role.choices),
                "region": serializers.IntegerField(required=False, allow_null=True),
                "message": serializers.CharField(required=False, allow_blank=True),
                "utm": serializers.CharField(required=False, allow_blank=True),
            },
        ),
        responses={201: inline_serializer("LeadCreated", {"id": serializers.UUIDField()})},
    )
    def post(self, request: Request) -> Response:
        data = data_of(request)
        lead = create_lead(
            name=str(data.get("name", "") or ""),
            phone=str(data.get("phone", "") or ""),
            role=str(data.get("role", "") or ""),
            region_id=data.get("region"),
            message=str(data.get("message", "") or ""),
            source=str(data.get("utm", "") or ""),
            ip=request.META.get("HTTP_X_REAL_IP") or request.META.get("REMOTE_ADDR"),
        )
        return Response({"id": lead.id}, status=status.HTTP_201_CREATED)
