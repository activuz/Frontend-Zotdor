from __future__ import annotations

import uuid
from typing import Any

from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from auctions.models import Auction
from auctions.serializers import PublicUserSerializer, display_name
from core.errors import DomainError
from core.http import data_of, me
from deals.models import Rating
from moderation.models import Report


class ReportView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=inline_serializer(
            "ReportIn",
            {
                "target_type": serializers.ChoiceField(Report.Target.choices),
                "target_id": serializers.UUIDField(),
                "reason": serializers.ChoiceField(Report.Reason.choices),
                "comment": serializers.CharField(required=False, allow_blank=True),
            },
        ),
        responses={201: None},
    )
    def post(self, request: Request) -> Response:
        data = data_of(request)
        target_type, reason = str(data.get("target_type")), str(data.get("reason"))
        if target_type not in Report.Target.values or reason not in Report.Reason.values:
            raise DomainError("invalid", "Shikoyat turini tanlang.")
        try:
            target_id = uuid.UUID(str(data.get("target_id")))
        except ValueError as exc:
            raise DomainError("invalid", "Notoʻgʻri obyekt.") from exc
        model = Auction if target_type == Report.Target.AUCTION else User
        if not model.objects.filter(id=target_id).exists():
            raise DomainError("not_found", "Topilmadi.", status.HTTP_404_NOT_FOUND)
        if Report.objects.filter(
            reporter=me(request),
            target_type=target_type,
            target_id=target_id,
            status=Report.ReportStatus.OPEN,
        ).exists():
            raise DomainError("already_reported", "Siz bu haqda allaqachon shikoyat qilgansiz.", 409)
        Report.objects.create(
            reporter=me(request),
            target_type=target_type,
            target_id=target_id,
            reason=reason,
            comment=str(data.get("comment", ""))[:1000],
        )
        return Response(status=status.HTTP_201_CREATED)


class PublicRatingSerializer(serializers.Serializer[Any]):
    score = serializers.IntegerField()
    comment = serializers.CharField()
    author = serializers.CharField()
    created_at = serializers.DateTimeField()


class PublicProfileView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        responses=inline_serializer(
            "PublicProfile",
            {"user": PublicUserSerializer(), "ratings": PublicRatingSerializer(many=True)},
        )
    )
    def get(self, request: Request, user_id: uuid.UUID) -> Response:
        user = User.objects.select_related("region").filter(id=user_id, is_blocked=False).first()
        if user is None:
            raise DomainError("not_found", "Foydalanuvchi topilmadi.", status.HTTP_404_NOT_FOUND)
        ratings = Rating.objects.filter(target=user).select_related("author").order_by("-created_at")[:20]
        return Response(
            {
                "user": PublicUserSerializer(user).data,
                "ratings": [
                    {
                        "score": r.score,
                        "comment": r.comment,
                        "author": display_name(r.author),
                        "created_at": r.created_at,
                    }
                    for r in ratings
                ],
            }
        )
