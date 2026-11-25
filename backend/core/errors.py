"""Uniform API error format (docs/API.md, "Xato formati").

Every error response looks like:
    {"error": {"code": "...", "message": "...", "fields": {...}}}
`message` is user-facing Uzbek text; `code` is for frontend logic.
"""

from __future__ import annotations

from typing import Any

from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


class DomainError(Exception):
    """Business-rule violation raised from services; mapped to a 4xx response."""

    def __init__(self, code: str, message: str, http_status: int = status.HTTP_400_BAD_REQUEST) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.http_status = http_status


_DEFAULT_MESSAGES: dict[int, tuple[str, str]] = {
    400: ("invalid", "Maʼlumotlar notoʻgʻri kiritilgan."),
    401: ("not_authenticated", "Davom etish uchun tizimga kiring."),
    403: ("permission_denied", "Bu amal uchun ruxsat yoʻq."),
    404: ("not_found", "Topilmadi."),
    405: ("method_not_allowed", "Bu amal qoʻllab-quvvatlanmaydi."),
    429: ("rate_limited", "Juda koʻp soʻrov. Birozdan keyin qayta urinib koʻring."),
}


def _body(code: str, message: str, fields: dict[str, Any] | None = None) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message}
    if fields:
        error["fields"] = fields
    return {"error": error}


def exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    if isinstance(exc, DomainError):
        return Response(_body(exc.code, exc.message), status=exc.http_status)

    response = drf_exception_handler(exc, context)
    if response is None:
        return None  # unhandled -> 500, logged by Django

    default_code, default_message = _DEFAULT_MESSAGES.get(
        response.status_code, ("error", "Xatolik yuz berdi.")
    )
    # DRF's SessionAuthentication reports a bad/missing CSRF token as PermissionDenied.
    # A distinct code lets the client refresh its token and retry once (e.g. after login,
    # when Django rotates the token).
    if isinstance(exc, exceptions.PermissionDenied) and str(exc.detail).startswith("CSRF Failed"):
        default_code, default_message = "csrf_failed", "Sahifani yangilab, qayta urinib koʻring."
    fields = None
    if isinstance(exc, exceptions.ValidationError) and isinstance(response.data, dict):
        fields = response.data
    response.data = _body(default_code, default_message, fields)
    return response
