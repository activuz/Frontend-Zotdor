"""notify(): one call creates the in-app notification and queues the Telegram and Web Push copies.

Safe to call inside a transaction: rows are written in the caller's transaction, and the
sender tasks are deferred only after commit, so a rolled-back action never notifies anyone.
"""

from __future__ import annotations

import json
import logging
from datetime import timedelta
from typing import TYPE_CHECKING, Any

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from pywebpush import WebPushException, webpush

from core.errors import DomainError
from notifications.models import DeviceToken, Notification, PushSubscription, TelegramOutbox

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
        n = Notification.objects.create(user=user, type=type, title=title, body=body, link=link)
        web = push_enabled() and PushSubscription.objects.filter(user=user).exists()
        app = fcm_enabled() and DeviceToken.objects.filter(user=user).exists()
        if web or app:
            transaction.on_commit(lambda: _defer_push(n.id))
    if telegram and user.telegram_user_id:
        text = title if not body else f"{title}\n\n{body}"
        if link and settings.FRONTEND_URL:
            text += f"\n\n{settings.FRONTEND_URL.rstrip('/')}{link}"
        TelegramOutbox.objects.create(chat_id=user.telegram_user_id, text=text)
        transaction.on_commit(kick_sender)


def push_enabled() -> bool:
    return bool(settings.VAPID_PRIVATE_KEY and settings.VAPID_PUBLIC_KEY)


def _defer_push(notification_id: int) -> None:
    from notifications.tasks import send_push

    try:
        send_push.defer(notification_id=notification_id)
    except Exception:  # the in-app copy and Telegram still arrive
        logger.warning("could not defer send_push for notification %s", notification_id)


# --- Web Push (FR-20) ----------------------------------------------------------------------------

PUSH_BODY_MAX = 240
PUSH_TTL_S = 24 * 3600
PUSH_MAX_FAILURES = 10
GONE = (404, 410)
BAD_SUBSCRIPTION = "Bildirishnoma obunasini saqlab boʻlmadi. Sahifani yangilab, qayta urinib koʻring."


def save_subscription(
    user: User, endpoint: str, p256dh: str, auth: str, user_agent: str = ""
) -> PushSubscription:
    """Upsert by endpoint: a browser belongs to whoever logged in on it last."""
    endpoint, p256dh, auth = (endpoint or "").strip(), (p256dh or "").strip(), (auth or "").strip()
    if not endpoint.startswith("https://") or len(endpoint) > 1000:
        raise DomainError("invalid_subscription", BAD_SUBSCRIPTION)
    if not p256dh or not auth or len(p256dh) > 200 or len(auth) > 100:
        raise DomainError("invalid_subscription", BAD_SUBSCRIPTION)
    with transaction.atomic():
        sub, _ = PushSubscription.objects.update_or_create(
            endpoint=endpoint,
            defaults={
                "user": user,
                "p256dh": p256dh,
                "auth": auth,
                "user_agent": user_agent[:300],
                "failures": 0,
            },
        )
        # Keep the newest few devices; old browsers stop being targeted.
        mine = PushSubscription.objects.filter(user=user)
        keep = list(
            mine.order_by("-created_at", "-id").values_list("id", flat=True)[
                : settings.PUSH_SUBSCRIPTIONS_PER_USER
            ]
        )
        mine.exclude(id__in=keep).delete()
    return sub


def delete_subscription(user: User, endpoint: str) -> None:
    PushSubscription.objects.filter(user=user, endpoint=(endpoint or "").strip()).delete()


def _payload(n: Notification) -> str:
    body = n.body if len(n.body) <= PUSH_BODY_MAX else n.body[: PUSH_BODY_MAX - 1].rstrip() + "…"
    return json.dumps(
        {"title": n.title, "body": body, "url": n.link or "/notifications", "tag": f"n{n.id}"},
        ensure_ascii=False,
    )


def send_web_push(notification_id: int) -> int:
    """Worker task body: send one notification to every device of its user. Returns successes.

    Runs outside any request transaction (AGENTS.md). Subscriptions the push service reports as
    gone (404/410) are deleted; other failures are counted, and a subscription is dropped after
    PUSH_MAX_FAILURES in a row.
    """
    n = Notification.objects.filter(id=notification_id).first()
    if n is None or not push_enabled():
        return 0
    data = _payload(n)
    sent = 0
    for sub in PushSubscription.objects.filter(user_id=n.user_id):
        info: dict[str, Any] = {"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}}
        try:
            webpush(
                subscription_info=info,
                data=data,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": settings.VAPID_SUBJECT},
                ttl=PUSH_TTL_S,
                timeout=10,
            )
        except WebPushException as exc:
            code = getattr(exc.response, "status_code", None)
            if code in GONE:
                sub.delete()
                continue
            logger.warning("web push to subscription %s failed: %s", sub.id, code or exc)
            sub.failures += 1
            if sub.failures >= PUSH_MAX_FAILURES:
                sub.delete()
            else:
                sub.save(update_fields=["failures"])
            continue
        except Exception:
            logger.exception("web push to subscription %s crashed", sub.id)
            continue
        sub.failures = 0
        sub.last_used_at = timezone.now()
        sub.save(update_fields=["failures", "last_used_at"])
        sent += 1
    return sent


# --- Native app push through Firebase Cloud Messaging (FR-21) -----------------------------------

FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
FCM_GONE_CODES = {"UNREGISTERED", "INVALID_ARGUMENT", "SENDER_ID_MISMATCH"}
PLATFORMS = {DeviceToken.Platform.ANDROID.value}
BAD_DEVICE = "Ilova bildirishnomalarini ulab boʻlmadi. Ilovani qayta ochib koʻring."

# Notification type prefix → Android channel (the app creates these channels, MainActivity).
CHANNELS = (
    ("bid", "bids"),
    ("auction", "auctions"),
    ("decision", "auctions"),
    ("deal", "deals"),
    ("rating", "deals"),
    ("claim", "deals"),
    ("topup", "wallet"),
    ("refund", "wallet"),
    ("bonus", "wallet"),
    ("wallet", "wallet"),
    ("payment", "wallet"),
)


def fcm_channel(notification_type: str) -> str:
    for prefix, channel in CHANNELS:
        if notification_type.startswith(prefix):
            return channel
    return "general"


def _service_account() -> dict[str, Any] | None:
    """The server key: a JSON string in the env, or a file path (never in the repository)."""
    raw = settings.FIREBASE_SERVICE_ACCOUNT_JSON
    if not raw and settings.FIREBASE_SERVICE_ACCOUNT_FILE:
        try:
            with open(settings.FIREBASE_SERVICE_ACCOUNT_FILE, encoding="utf-8") as fh:
                raw = fh.read()
        except OSError:
            logger.warning("FIREBASE_SERVICE_ACCOUNT_FILE cannot be read")
            return None
    if not raw:
        return None
    try:
        info = json.loads(raw)
    except ValueError:
        logger.warning("Firebase service account is not valid JSON")
        return None
    return info if isinstance(info, dict) and info.get("project_id") else None


def fcm_enabled() -> bool:
    return _service_account() is not None


_session: Any = None


def reset_fcm_session() -> None:
    global _session
    _session = None


def _fcm_session() -> Any:
    """An authorized HTTP session; google-auth refreshes the OAuth token by itself."""
    global _session
    if _session is None:
        from google.auth.transport.requests import AuthorizedSession
        from google.oauth2 import service_account

        # google-auth ships these two without type annotations.
        creds = service_account.Credentials.from_service_account_info(  # type: ignore[no-untyped-call]
            _service_account(), scopes=[FCM_SCOPE]
        )
        _session = AuthorizedSession(creds)  # type: ignore[no-untyped-call]
    return _session


def save_device(user: User, token: str, platform: str, app_version: str = "") -> DeviceToken:
    """Upsert by token: an installed app belongs to whoever logged in on it last."""
    token = (token or "").strip()
    if not token or len(token) > 500 or platform not in PLATFORMS:
        raise DomainError("invalid_device", BAD_DEVICE)
    device, _ = DeviceToken.objects.update_or_create(
        token=token,
        defaults={"user": user, "platform": platform, "app_version": (app_version or "")[:20], "failures": 0},
    )
    return device


def delete_device(user: User, token: str) -> None:
    DeviceToken.objects.filter(user=user, token=(token or "").strip()).delete()


def _fcm_error_code(resp: Any) -> str:
    try:
        error = resp.json().get("error", {})
    except ValueError:
        return ""
    for detail in error.get("details", []) or []:
        if isinstance(detail, dict) and detail.get("errorCode"):
            return str(detail["errorCode"])
    return str(error.get("status", ""))


def send_fcm(notification_id: int) -> int:
    """Worker task body: send one notification to every installed app of its user.

    Data-only message: the app builds the notification itself, so it has the app icon, the
    right channel and opens the page on tap even when the app was closed.
    """
    n = Notification.objects.filter(id=notification_id).first()
    account = _service_account()
    if n is None or account is None:
        return 0
    url = f"https://fcm.googleapis.com/v1/projects/{account['project_id']}/messages:send"
    body = n.body if len(n.body) <= PUSH_BODY_MAX else n.body[: PUSH_BODY_MAX - 1].rstrip() + "…"
    data = {
        "title": n.title,
        "body": body,
        "url": n.link or "/notifications",
        "tag": f"n{n.id}",
        "channel": fcm_channel(n.type),
    }
    sent = 0
    for device in DeviceToken.objects.filter(user_id=n.user_id):
        message = {
            "token": device.token,
            "data": data,
            "android": {"priority": "HIGH", "ttl": f"{PUSH_TTL_S}s"},
        }
        try:
            resp = _fcm_session().post(url, json={"message": message}, timeout=10)
        except Exception:
            logger.exception("fcm send to device %s crashed", device.id)
            continue
        if resp.status_code == 200:
            device.failures = 0
            device.last_used_at = timezone.now()
            device.save(update_fields=["failures", "last_used_at"])
            sent += 1
            continue
        code = _fcm_error_code(resp)
        if resp.status_code == 404 or code in FCM_GONE_CODES:
            device.delete()
            continue
        logger.warning("fcm send to device %s failed: %s %s", device.id, resp.status_code, code)
        device.failures += 1
        if device.failures >= PUSH_MAX_FAILURES:
            device.delete()
        else:
            device.save(update_fields=["failures"])
    return sent


def kick_sender() -> None:
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
