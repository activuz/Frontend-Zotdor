from __future__ import annotations

import secrets
from typing import Any

from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from telegram_bot.client import send_message
from telegram_bot.handlers import process_update


def _secret_ok(value: str | None) -> bool:
    expected = settings.TELEGRAM_WEBHOOK_SECRET
    return bool(expected) and value is not None and secrets.compare_digest(value, expected)


@extend_schema(exclude=True)
class TelegramWebhookView(APIView):
    """Receives bot updates. Both the URL secret and Telegram's secret header must match."""

    permission_classes = [AllowAny]
    authentication_classes: list[type] = []

    def post(self, request: Request, secret: str) -> Response:
        header = request.META.get("HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN")
        if not (_secret_ok(secret) and _secret_ok(header)):
            return Response(status=404)
        update: Any = request.data
        if isinstance(update, dict):
            for reply in process_update(update):
                send_message(reply.chat_id, reply.text, reply.reply_markup)
        # Always 200 for valid callers, otherwise Telegram retries the same update.
        return Response({"ok": True})
