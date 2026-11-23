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


def notify(
    user: User,
    type: str,
    title: str,
    body: str = "",
    link: str = "",
    *,
    telegram: bool = True,
    in_app: bool = True,
) -> None:
    if in_app:
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
                call(
                    "sendMessage",
                    {"chat_id": msg.chat_id, "text": msg.text, "disable_web_page_preview": True},
                )
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


# --- reminders (F3, F4, F5, F8) ---------------------------------------------------------------

DIGEST_EVERY = timedelta(minutes=30)
ENDING_SOON = timedelta(minutes=10)
BONUS_WARNING = timedelta(days=7)


def _once(key: str) -> bool:
    """True the first time a key is seen; reminders are sent only then."""
    from django.db import IntegrityError

    from notifications.models import SentReminder

    try:
        with transaction.atomic():
            SentReminder.objects.create(key=key)
    except IntegrityError:
        return False
    return True


def send_reminders() -> dict[str, int]:
    """Time-based notifications. Idempotent: run every minute."""
    from accounts.models import User
    from auctions.models import Auction, Bid, Status, Watch
    from core.models import PlatformSettings
    from deals.models import Deal, Rating
    from wallet.models import Wallet

    now = timezone.now()
    counts = {"ending": 0, "decision": 0, "digest": 0, "rating": 0, "bonus": 0}

    # Last 10 minutes: watchers and bidders, Telegram only (F8).
    for a in Auction.objects.filter(status=Status.LIVE, ends_at__gt=now, ends_at__lte=now + ENDING_SOON):
        bidder_ids = set(Bid.objects.filter(auction=a).values_list("bidder_id", flat=True))
        watcher_ids = set(Watch.objects.filter(auction=a).values_list("user_id", flat=True))
        for user_id in (bidder_ids | watcher_ids) - {a.seller_id}:
            if _once(f"ending:{a.id}:{user_id}"):
                notify(
                    User.objects.get(id=user_id),
                    "ending_soon",
                    "Auksion tugashiga 10 daqiqa qoldi",
                    a.title,
                    f"/a/{a.id}",
                    in_app=False,
                )
                counts["ending"] += 1

    # Decision deadline: 24 h and 2 h before (F4).
    for a in Auction.objects.filter(status=Status.ENDED, decision_deadline__gt=now).select_related("seller"):
        if a.decision_deadline is None:
            continue
        left = a.decision_deadline - now
        for hours in (2, 24):  # the closest window wins; each is sent once
            if left > timedelta(hours=hours):
                continue
            if _once(f"decision{hours}:{a.id}"):
                notify(
                    a.seller,
                    "decision_reminder",
                    f"Xaridorni tanlashga {hours} soatdan kam vaqt qoldi",
                    "Muddat tugasa, auksion sotilmagan boʻlib yopiladi.",
                    f"/a/{a.id}/decision",
                )
                counts["decision"] += 1
            break

    # Seller digest: at most one message per 30 minutes after the first bid (F3).
    for a in Auction.objects.filter(status=Status.LIVE, active_bids_count__gt=0).select_related("seller"):
        link = f"/a/{a.id}"
        last = (
            Notification.objects.filter(user=a.seller, link=link, type__in=("first_bid", "bid_digest"))
            .order_by("-created_at")
            .values_list("created_at", flat=True)
            .first()
        )
        if last is None or now - last < DIGEST_EVERY:
            continue
        new = Bid.objects.filter(auction=a, created_at__gt=last).count()
        if new:
            top = f"{a.top_bid_amount:,}".replace(",", " ") if a.top_bid_amount else "—"
            notify(a.seller, "bid_digest", f"{new} ta yangi taklif", f"Eng yuqori taklif: {top} soʻm", link)
            counts["digest"] += 1

    # Rating reminder 24 h after the deal, while the rating window is open (F5).
    s = PlatformSettings.load()
    for d in (
        Deal.objects.filter(
            created_at__lte=now - timedelta(hours=24),
            created_at__gt=now - timedelta(days=s.rating_window_days),
        )
        .exclude(status=Deal.DealStatus.FAILED)
        .select_related("seller", "buyer", "auction")
    ):
        rated = set(Rating.objects.filter(deal=d).values_list("author_id", flat=True))
        for user in (d.seller, d.buyer):
            if user.id not in rated and _once(f"rate:{d.id}:{user.id}"):
                notify(user, "rating_reminder", "Bitimni baholang", d.auction.title, f"/deals/{d.id}")
                counts["rating"] += 1

    # Bonus burns in 7 days (F8).
    for w in Wallet.objects.filter(
        bonus_balance__gt=0, bonus_expires_at__gt=now, bonus_expires_at__lte=now + BONUS_WARNING
    ).select_related("user"):
        if w.bonus_expires_at is None:
            continue
        if _once(f"bonus7:{w.user_id}:{w.bonus_expires_at.date()}"):
            amount = f"{w.bonus_balance:,}".replace(",", " ")
            notify(
                w.user,
                "bonus_expiring",
                "Bonusingiz 7 kundan keyin yonadi",
                f"{amount} soʻm bonusni auksion komissiyasiga ishlatishingiz mumkin.",
                "/wallet",
            )
            counts["bonus"] += 1
    return counts
