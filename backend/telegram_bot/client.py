"""Minimal Telegram Bot API client (stdlib only; the bot needs just a few methods)."""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)


class TelegramError(Exception):
    pass


def call(method: str, payload: dict[str, Any] | None = None, timeout: float = 15) -> Any:
    if not settings.TELEGRAM_BOT_TOKEN:
        raise TelegramError("TELEGRAM_BOT_TOKEN is not configured")
    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/{method}"
    data = json.dumps(payload or {}).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 (fixed https host)
            body = json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        body = json.loads(exc.read() or b"{}")
    except (urllib.error.URLError, TimeoutError) as exc:
        # Never include the URL: it contains the bot token.
        raise TelegramError(f"{method}: network error ({type(exc).__name__})") from None
    if not body.get("ok"):
        raise TelegramError(f"{method}: {body.get('description', 'unknown error')}")
    return body["result"]


def send_message(chat_id: int, text: str, reply_markup: dict[str, Any] | None = None) -> None:
    payload: dict[str, Any] = {"chat_id": chat_id, "text": text}
    if reply_markup is not None:
        payload["reply_markup"] = reply_markup
    try:
        call("sendMessage", payload)
    except TelegramError:
        logger.exception("telegram sendMessage failed for chat %s", chat_id)
