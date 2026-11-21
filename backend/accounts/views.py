from __future__ import annotations

import uuid

from django.conf import settings
from django.contrib.auth import login, logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts import services
from accounts.models import User
from accounts.serializers import (
    LoginStartResponseSerializer,
    LoginStartSerializer,
    LoginStatusSerializer,
    MeSerializer,
    ProfileUpdateSerializer,
)

POLL_COOKIE = "zd_login"
POLL_COOKIE_PATH = "/api/v1/auth/"


def _client_ip(request: Request) -> str | None:
    # Behind nginx the real address arrives in X-Real-IP (set by our proxy config, phase 10).
    return request.META.get("HTTP_X_REAL_IP") or request.META.get("REMOTE_ADDR")


@method_decorator(ensure_csrf_cookie, name="get")
class CsrfView(APIView):
    """Sets the csrftoken cookie; the frontend calls it once on startup."""

    permission_classes = [AllowAny]

    @extend_schema(responses={204: None})
    def get(self, request: Request) -> Response:
        return Response(status=status.HTTP_204_NO_CONTENT)


class LoginStartView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(request=LoginStartSerializer, responses={201: LoginStartResponseSerializer})
    def post(self, request: Request) -> Response:
        payload = LoginStartSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        started = services.start_login(payload.validated_data["phone"], _client_ip(request))
        response = Response(
            {
                "request_id": started.request.id,
                "deep_link": started.deep_link,
                "expires_at": started.request.expires_at,
            },
            status=status.HTTP_201_CREATED,
        )
        response.set_cookie(
            POLL_COOKIE,
            started.poll_secret,
            max_age=settings.LOGIN_REQUEST_TTL_SECONDS,
            path=POLL_COOKIE_PATH,
            httponly=True,
            secure=not settings.DEBUG,
            samesite="Lax",
        )
        return response


class LoginStatusView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(responses=LoginStatusSerializer)
    def get(self, request: Request, request_id: uuid.UUID) -> Response:
        result = services.complete_login(request_id, request.COOKIES.get(POLL_COOKIE))
        body: dict[str, object] = {"status": result.status}
        if result.fail_reason:
            body["fail_reason"] = result.fail_reason
            body["message"] = result.fail_message
        response = Response(body)
        if result.user is not None:
            login(request._request, result.user, backend="django.contrib.auth.backends.ModelBackend")
            body["user"] = MeSerializer(result.user).data
            response = Response(body)
        if result.status != "pending":
            response.delete_cookie(POLL_COOKIE, path=POLL_COOKIE_PATH)
        return response


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={204: None})
    def post(self, request: Request) -> Response:
        logout(request._request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=MeSerializer)
    def get(self, request: Request) -> Response:
        user: User = request.user  # type: ignore[assignment]  # IsAuthenticated guarantees User
        return Response(MeSerializer(user).data)

    @extend_schema(request=ProfileUpdateSerializer, responses=MeSerializer)
    def patch(self, request: Request) -> Response:
        user: User = request.user  # type: ignore[assignment]
        payload = ProfileUpdateSerializer(data=request.data, context={"user": user}, partial=True)
        payload.is_valid(raise_exception=True)
        for field, value in payload.validated_data.items():
            setattr(user, field, value)
        user.save()
        return Response(MeSerializer(user).data)
