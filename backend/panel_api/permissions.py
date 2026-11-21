from __future__ import annotations

from typing import Any

from rest_framework.permissions import BasePermission
from rest_framework.request import Request


class IsModerator(BasePermission):
    message = "Bu boʻlim faqat moderator va administratorlar uchun."

    def has_permission(self, request: Request, view: Any) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, "role", "") in ("moderator", "admin"))


class IsAdmin(BasePermission):
    message = "Bu amal faqat administrator uchun."

    def has_permission(self, request: Request, view: Any) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, "role", "") == "admin")
