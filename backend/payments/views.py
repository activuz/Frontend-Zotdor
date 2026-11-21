from __future__ import annotations

import uuid
from typing import Any

from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from core.errors import DomainError
from payments import services
from payments.models import Payment, RefundRequest


class PaymentSerializer(serializers.ModelSerializer[Payment]):
    class Meta:
        model = Payment
        fields = ["id", "provider", "amount", "status", "created_at", "completed_at"]
        read_only_fields = fields


class RefundRequestSerializer(serializers.ModelSerializer[RefundRequest]):
    class Meta:
        model = RefundRequest
        fields = ["id", "amount", "click_reference", "reason", "status", "note", "created_at", "handled_at"]
        read_only_fields = fields


class TopupView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=inline_serializer("TopupIn", {"amount": serializers.IntegerField()}),
        responses={
            201: inline_serializer(
                "TopupOut", {"payment_id": serializers.UUIDField(), "redirect_url": serializers.CharField()}
            )
        },
    )
    def post(self, request: Request) -> Response:
        try:
            amount = int(request.data.get("amount"))
        except (TypeError, ValueError) as exc:
            raise DomainError("invalid_amount", "Summani kiriting.") from exc
        payment, url = services.start_topup(request.user, amount)  # type: ignore[arg-type]
        return Response({"payment_id": payment.id, "redirect_url": url}, status=status.HTTP_201_CREATED)


class PaymentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=PaymentSerializer)
    def get(self, request: Request, payment_id: uuid.UUID) -> Response:
        return Response(PaymentSerializer(services.get_own(payment_id, request.user)).data)  # type: ignore[arg-type]


class FakeCompleteView(APIView):
    """Local development only; returns 404 unless DEBUG and PAYMENTS_PROVIDER=fake."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses=PaymentSerializer)
    def post(self, request: Request, payment_id: uuid.UUID) -> Response:
        return Response(PaymentSerializer(services.complete_fake(payment_id, request.user)).data)  # type: ignore[arg-type]


class _ClickBase(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list[type] = []
    parser_classes = [FormParser, MultiPartParser, JSONParser]

    def params(self, request: Request) -> dict[str, str]:
        return {k: str(v) for k, v in request.data.items()}


@extend_schema(exclude=True)
class ClickPrepareView(_ClickBase):
    def post(self, request: Request) -> Response:
        return Response(services.click_prepare(self.params(request)))


@extend_schema(exclude=True)
class ClickCompleteView(_ClickBase):
    def post(self, request: Request) -> Response:
        return Response(services.click_complete(self.params(request)))


class RefundRequestsView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=RefundRequestSerializer(many=True))
    def get(self, request: Request) -> Response:
        qs = RefundRequest.objects.filter(user=request.user).order_by("-created_at")[:50]  # type: ignore[misc]
        return Response(RefundRequestSerializer(qs, many=True).data)

    @extend_schema(
        request=inline_serializer(
            "RefundIn",
            {
                "amount": serializers.IntegerField(),
                "click_reference": serializers.CharField(),
                "reason": serializers.CharField(),
            },
        ),
        responses={201: RefundRequestSerializer},
    )
    def post(self, request: Request) -> Response:
        user: User = request.user  # type: ignore[assignment]
        data: Any = request.data
        try:
            amount = int(data.get("amount"))
        except (TypeError, ValueError) as exc:
            raise DomainError("invalid_amount", "Summani kiriting.") from exc
        req = services.create_refund_request(
            user, amount, str(data.get("click_reference", "")), str(data.get("reason", ""))[:1000]
        )
        return Response(RefundRequestSerializer(req).data, status=status.HTTP_201_CREATED)
