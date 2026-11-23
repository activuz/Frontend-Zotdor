"""Small typed helpers for DRF views."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from rest_framework.request import Request

from core.errors import DomainError

if TYPE_CHECKING:
    from accounts.models import User


def data_of(request: Request) -> dict[str, Any]:
    """Request body as a mapping (JSON object or form). A JSON list body is treated as empty."""
    data = request.data
    return data if isinstance(data, dict) else {}


def me(request: Request) -> User:
    """The logged-in user. Only call from views guarded by IsAuthenticated (or stricter)."""
    user = request.user
    if not user or not user.is_authenticated:
        raise DomainError("not_authenticated", "Davom etish uchun tizimga kiring.", 401)
    return user
