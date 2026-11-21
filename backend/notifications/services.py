"""notify(): one call creates the in-app notification and queues the Telegram copy.

Safe to call inside a transaction: rows are written in the caller's transaction, and the
sender task is deferred only after commit, so a rolled-back action never notifies anyone.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import TYPE_CHECKING

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from notifications.models import Notification, TelegramOutbox

if TYPE_CHECKING:
    from accounts.models import User

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 5


def notify(user: User, type: str, title: str, body: str = "", link: str = "", *, telegram: bool = True) -> None:
    Notification.objects.create(user=user, type=type, title=title, body=body, link=link)
    if telegram and user.telegram_user_id:
        text = title if not body else f"{title}\n\n{body}"
        if link and settings.FRONTEND_URL:
            text += f"\n\n{settings.FRONTEND_URL.rstrip('/')}{link}"
        TelegramOutbox.objects.create(chat_id=user.telegram_user_id, text=text)
        transaction.on_commit(_kick_sender)


def _kick_sender() -> None:
    from notifications.tasks import send_outbox

    try:
        send_outbox.defer()
    except Exception:  # the periodic run will pick it up
        logger.warning("could not defer send_outbox; periodic task will send it")


def send_pending(limit: int = 50) -> int:
    """Send due outbox messages. Returns how many were sent."""
    from telegram_bot.client import TelegramError, call

    sent = 0
    now = timezone.now()
    with transaction.atomic():
        batch = list(
            TelegramOutbox.objects.select_for_update(skip_locked=True)
            .filter(status=TelegramOutbox.Status.PENDING, next_attempt_at__lte=now)
            .order_by("id")[:limit]
        )
        for msg in batch:
            try:
                call("sendMessage", {"chat_id": msg.chat_id, "text": msg.text, "disable_web_page_preview": True})
            except TelegramError as exc:
                msg.attempts += 1
                msg.error = str(exc)[:500]
                if msg.attempts >= MAX_ATTEMPTS or "blocked" in str(exc).lower():
                    msg.status = TelegramOutbox.Status.FAILED
                else:
                    msg.next_attempt_at = now + timedelta(minutes=2**msg.attempts)
                msg.save(update_fields=["attempts", "error", "status", "next_attempt_at"])
                continue
            msg.status = TelegramOutbox.Status.SENT
            msg.sent_at = timezone.now()
            msg.save(update_fields=["status", "sent_at"])
            sent += 1
    return sent
