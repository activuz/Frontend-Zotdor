"""Telegram login flow (docs/ARCHITECTURE.md §6, BR-01..03).

start_login() -> deep link; bot: bind_telegram() on /start, verify_contact() on contact;
browser: complete_login() polls with the poll secret and receives a session.
"""

from __future__ import annotations

import hashlib
import math
import secrets
import uuid
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
from enum import StrEnum

from django.conf import settings
from django.db import transaction
from django.db.models import QuerySet
from django.utils import timezone
from rest_framework import status

from accounts.models import LoginRequest, User
from accounts.phone import normalize_phone
from core.errors import DomainError
from notifications.services import notify
from reference.models import District
from wallet.services import grant_signup_bonus


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


@dataclass(frozen=True)
class StartedLogin:
    request: LoginRequest
    deep_link: str
    poll_secret: str


def start_login(raw_phone: str, ip: str | None, client: str = "web") -> StartedLogin:
    if not (settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_BOT_USERNAME):
        raise DomainError(
            "login_unavailable", "Kirish vaqtincha ishlamayapti. Birozdan keyin urinib koʻring.", 503
        )
    phone = normalize_phone(raw_phone)
    if phone is None:
        raise DomainError("invalid_phone", "Telefon raqamini +998 XX XXX XX XX koʻrinishida kiriting.")

    hour_ago = timezone.now() - timedelta(hours=1)
    recent = LoginRequest.objects.filter(created_at__gte=hour_ago)
    if recent.filter(phone=phone).count() >= settings.LOGIN_RATE_PER_PHONE_PER_HOUR or (
        ip and recent.filter(ip=ip).count() >= settings.LOGIN_RATE_PER_IP_PER_HOUR
    ):
        raise DomainError(
            "rate_limited",
            "Juda koʻp urinish. Bir soatdan keyin qayta urinib koʻring.",
            status.HTTP_429_TOO_MANY_REQUESTS,
        )

    token = secrets.token_urlsafe(32)  # 43 chars of [A-Za-z0-9_-]; Telegram allows up to 64
    poll_secret = secrets.token_urlsafe(32)
    request = LoginRequest.objects.create(
        phone=phone,
        token_hash=_hash(token),
        poll_secret_hash=_hash(poll_secret),
        ip=ip,
        client=client if client in ("web", "app") else "web",
        expires_at=timezone.now() + timedelta(seconds=settings.LOGIN_REQUEST_TTL_SECONDS),
    )
    deep_link = f"https://t.me/{settings.TELEGRAM_BOT_USERNAME}?start={token}"
    return StartedLogin(request=request, deep_link=deep_link, poll_secret=poll_secret)


def _active(qs: QuerySet[LoginRequest]) -> QuerySet[LoginRequest]:
    return qs.filter(status=LoginRequest.Status.PENDING, expires_at__gt=timezone.now())


class BindResult(StrEnum):
    OK = "ok"
    INVALID = "invalid"


def bind_telegram(token: str, telegram_user_id: int) -> BindResult:
    """Called when the user presses Start in the bot with the deep-link token."""
    updated = _active(LoginRequest.objects.filter(token_hash=_hash(token))).update(
        telegram_user_id=telegram_user_id
    )
    return BindResult.OK if updated else BindResult.INVALID


class ContactResult(StrEnum):
    VERIFIED = "verified"
    NO_REQUEST = "no_request"
    FOREIGN_CONTACT = "foreign_contact"
    PHONE_MISMATCH = "phone_mismatch"
    ACCOUNT_CONFLICT = "account_conflict"


@dataclass(frozen=True)
class SharedContact:
    from_user_id: int
    contact_user_id: int | None
    phone_number: str
    first_name: str = ""
    last_name: str = ""
    username: str = ""


@transaction.atomic
def verify_contact(contact: SharedContact) -> tuple[ContactResult, LoginRequest | None]:
    request = (
        _active(LoginRequest.objects.select_for_update())
        .filter(telegram_user_id=contact.from_user_id)
        .order_by("-created_at")
        .first()
    )
    if request is None:
        return ContactResult.NO_REQUEST, None

    def fail(reason: ContactResult) -> tuple[ContactResult, LoginRequest]:
        request.status = LoginRequest.Status.FAILED
        request.fail_reason = reason.value
        request.save(update_fields=["status", "fail_reason"])
        return reason, request

    # A forwarded contact card has a different (or no) user_id: only your own number counts.
    if contact.contact_user_id != contact.from_user_id:
        return fail(ContactResult.FOREIGN_CONTACT)
    if normalize_phone(contact.phone_number) != request.phone:
        return fail(ContactResult.PHONE_MISMATCH)

    # BR-02: one phone = one account = one Telegram account.
    by_phone = User.objects.filter(phone=request.phone).first()
    by_telegram = User.objects.filter(telegram_user_id=contact.from_user_id).first()
    if (by_phone and by_phone.telegram_user_id not in (None, contact.from_user_id)) or (
        by_telegram and by_telegram.phone != request.phone
    ):
        return fail(ContactResult.ACCOUNT_CONFLICT)

    request.status = LoginRequest.Status.VERIFIED
    request.verified_at = timezone.now()
    request.telegram_username = contact.username[:64]
    request.telegram_first_name = contact.first_name[:64]
    request.telegram_last_name = contact.last_name[:64]
    request.save()
    return ContactResult.VERIFIED, request


_FAIL_MESSAGES = {
    "foreign_contact": "Faqat oʻzingizning raqamingizni ulashish mumkin.",
    "phone_mismatch": "Telegramʼdagi raqamingiz siz kiritgan raqamga mos kelmadi.",
    "account_conflict": "Bu raqam boshqa Telegram akkauntiga bogʻlangan.",
}


@dataclass(frozen=True)
class LoginStatus:
    status: str
    fail_reason: str = ""
    fail_message: str = ""
    user: User | None = None


@transaction.atomic
def complete_login(request_id: uuid.UUID, poll_secret: str | None) -> LoginStatus:
    """Return the attempt's state; on first verified poll, create/update the user.

    The caller opens the session only when `user` is returned. Without the poll secret
    (cookie set by start_login) the attempt is treated as unknown, so a stolen deep link
    cannot produce a session in another browser.
    """
    request = LoginRequest.objects.select_for_update().filter(id=request_id).first()
    if (
        request is None
        or not poll_secret
        or not secrets.compare_digest(request.poll_secret_hash, _hash(poll_secret))
    ):
        raise DomainError("login_not_found", "Kirish soʻrovi topilmadi. Qaytadan boshlang.", 404)

    if request.status == LoginRequest.Status.FAILED:
        return LoginStatus("failed", request.fail_reason, _FAIL_MESSAGES.get(request.fail_reason, ""))
    if request.status == LoginRequest.Status.CONSUMED or request.expires_at <= timezone.now():
        return LoginStatus("expired")
    if request.status == LoginRequest.Status.PENDING:
        return LoginStatus("pending")

    user = User.objects.filter(phone=request.phone).first()
    bonus = None
    if user is None:
        user = User.objects.create_user(
            phone=request.phone,
            first_name=request.telegram_first_name,
            last_name=request.telegram_last_name,
        )
        bonus = grant_signup_bonus(user)  # BR-43; same transaction, once per account
    if user.is_blocked:
        raise DomainError("user_blocked", "Akkauntingiz bloklangan.", status.HTTP_403_FORBIDDEN)

    user.telegram_user_id = request.telegram_user_id
    user.telegram_username = request.telegram_username
    user.save(update_fields=["telegram_user_id", "telegram_username"])
    if bonus is not None:
        # After the Telegram id is saved, so the welcome also goes to the bot chat.
        amount = f"{bonus.amount:,}".replace(",", " ")
        notify(
            user,
            "bonus_granted",
            f"Sizga {amount} soʻm bonus berildi",
            "Bonus auksion komissiyasiga ishlatiladi. "
            "Har bir bitimdan keyin komissiyaning bir qismi yana bonus hamyonga qaytadi.",
            "/wallet",
        )

    request.status = LoginRequest.Status.CONSUMED
    request.save(update_fields=["status"])
    return LoginStatus("verified", user=user)


# --- location (browser geolocation) --------------------------------------------------------

# Uzbekistan's bounding box with a small margin; points outside are a wrong fix or a VPN.
UZ_LAT = (37.0, 45.8)
UZ_LNG = (55.8, 73.3)
# 3 decimals ≈ 100 m: enough for "nearest auctions", never an exact address (BR-33).
LOCATION_DECIMALS = 3


def _distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(a))


def nearest_district(lat: float, lng: float) -> District | None:
    """The district whose centroid is closest. ~200 rows, so a scan in Python is fine."""
    best: tuple[float, District] | None = None
    for d in District.objects.select_related("region"):
        km = _distance_km(lat, lng, float(d.lat), float(d.lng))
        if best is None or km < best[0]:
            best = (km, d)
    return best[1] if best else None


def check_inside_uzbekistan(lat: float, lng: float) -> None:
    if not (math.isfinite(lat) and math.isfinite(lng)) or not (
        UZ_LAT[0] <= lat <= UZ_LAT[1] and UZ_LNG[0] <= lng <= UZ_LNG[1]
    ):
        raise DomainError(
            "location_outside", "Joylashuv Oʻzbekiston hududidan tashqarida. Hududni qoʻlda tanlang."
        )


@transaction.atomic
def set_location(user: User, lat: float, lng: float) -> User:
    """Save the device position (rounded) for distances and "nearest" sorting.

    If the profile has no region yet, it is filled from the nearest district, so a new user
    does not have to pick it by hand. A chosen region/district is never overwritten.
    """
    check_inside_uzbekistan(lat, lng)
    user = User.objects.select_for_update().get(id=user.id)
    user.lat = Decimal(str(round(lat, LOCATION_DECIMALS)))
    user.lng = Decimal(str(round(lng, LOCATION_DECIMALS)))
    fields = ["lat", "lng"]
    if user.region_id is None:
        district = nearest_district(lat, lng)
        if district is not None:
            user.region, user.district = district.region, district
            fields += ["region", "district"]
    user.save(update_fields=fields)
    return user


def clear_location(user: User) -> User:
    """Forget the device position; distances fall back to the district centroid."""
    User.objects.filter(id=user.id).update(lat=None, lng=None)
    user.lat = user.lng = None
    return user
