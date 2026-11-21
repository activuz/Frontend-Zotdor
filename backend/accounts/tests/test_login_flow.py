"""Telegram login: service rules (BR-01..03) and HTTP behaviour (docs/API.md "Auth")."""

from __future__ import annotations

from datetime import timedelta
from typing import Any
from urllib.parse import parse_qs, urlparse

import pytest
import time_machine
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import LoginRequest, User
from accounts.services import ContactResult, SharedContact, bind_telegram, verify_contact
from conftest import tg_message
from telegram_bot.handlers import process_update

pytestmark = pytest.mark.django_db

PHONE = "+998901234567"
TG_ID = 555001


def start(client: APIClient, phone: str = "90 123 45 67") -> dict[str, str]:
    response = client.post("/api/v1/auth/telegram/start", {"phone": phone}, format="json")
    assert response.status_code == 201, response.content
    body: dict[str, str] = response.json()
    return body


def token_of(deep_link: str) -> str:
    return parse_qs(urlparse(deep_link).query)["start"][0]


def own_contact(tg_id: int = TG_ID, phone: str = "998901234567") -> SharedContact:
    return SharedContact(from_user_id=tg_id, contact_user_id=tg_id, phone_number=phone, first_name="Ali")


def status(client: APIClient, request_id: str) -> dict[str, object]:
    body: dict[str, object] = client.get(f"/api/v1/auth/telegram/status/{request_id}").json()
    return body


# --- happy path -------------------------------------------------------------------------


def test_full_login_creates_user_and_session(telegram_settings: Any) -> None:
    client = APIClient()
    started = start(client)
    assert started["deep_link"].startswith("https://t.me/ZotdorTestBot?start=")
    assert status(client, started["request_id"])["status"] == "pending"

    assert bind_telegram(token_of(started["deep_link"]), TG_ID).value == "ok"
    assert verify_contact(own_contact())[0] is ContactResult.VERIFIED

    body = status(client, started["request_id"])
    assert body["status"] == "verified"
    user = User.objects.get(phone=PHONE)
    assert user.telegram_user_id == TG_ID
    assert user.first_name == "Ali"
    me = client.get("/api/v1/me")
    assert me.status_code == 200
    assert me.json()["needs_profile"] is True


def test_existing_user_logs_in_without_duplicate(telegram_settings: Any) -> None:
    User.objects.create_user(phone=PHONE, telegram_user_id=TG_ID, first_name="Eski")
    client = APIClient()
    started = start(client)
    bind_telegram(token_of(started["deep_link"]), TG_ID)
    verify_contact(own_contact())
    assert status(client, started["request_id"])["status"] == "verified"
    assert User.objects.filter(phone=PHONE).count() == 1
    assert User.objects.get(phone=PHONE).first_name == "Eski"


# --- rejected attempts ------------------------------------------------------------------


def test_foreign_contact_is_rejected(telegram_settings: Any) -> None:
    client = APIClient()
    started = start(client)
    bind_telegram(token_of(started["deep_link"]), TG_ID)
    forwarded = SharedContact(from_user_id=TG_ID, contact_user_id=999, phone_number="998901234567")
    assert verify_contact(forwarded)[0] is ContactResult.FOREIGN_CONTACT
    body = status(client, started["request_id"])
    assert body["status"] == "failed"
    assert body["fail_reason"] == "foreign_contact"
    assert not User.objects.exists()


def test_phone_mismatch_is_rejected(telegram_settings: Any) -> None:
    client = APIClient()
    started = start(client)
    bind_telegram(token_of(started["deep_link"]), TG_ID)
    assert verify_contact(own_contact(phone="998937654321"))[0] is ContactResult.PHONE_MISMATCH
    assert status(client, started["request_id"])["fail_reason"] == "phone_mismatch"


def test_phone_bound_to_other_telegram_is_conflict(telegram_settings: Any) -> None:
    User.objects.create_user(phone=PHONE, telegram_user_id=111)
    client = APIClient()
    started = start(client)
    bind_telegram(token_of(started["deep_link"]), TG_ID)
    assert verify_contact(own_contact())[0] is ContactResult.ACCOUNT_CONFLICT


def test_telegram_bound_to_other_phone_is_conflict(telegram_settings: Any) -> None:
    User.objects.create_user(phone="+998935550000", telegram_user_id=TG_ID)
    client = APIClient()
    started = start(client)
    bind_telegram(token_of(started["deep_link"]), TG_ID)
    assert verify_contact(own_contact())[0] is ContactResult.ACCOUNT_CONFLICT


def test_contact_without_start_has_no_request(telegram_settings: Any) -> None:
    assert verify_contact(own_contact())[0] is ContactResult.NO_REQUEST


def test_expired_token_cannot_be_bound(telegram_settings: Any) -> None:
    client = APIClient()
    started = start(client)
    with time_machine.travel(timezone.now() + timedelta(minutes=11)):
        assert bind_telegram(token_of(started["deep_link"]), TG_ID).value == "invalid"
        assert status(client, started["request_id"])["status"] == "expired"


def test_request_is_single_use(telegram_settings: Any) -> None:
    client = APIClient()
    started = start(client)
    bind_telegram(token_of(started["deep_link"]), TG_ID)
    verify_contact(own_contact())
    assert status(client, started["request_id"])["status"] == "verified"
    # The poll cookie is deleted after success; even with the secret, a replay is expired.
    assert LoginRequest.objects.get().status == LoginRequest.Status.CONSUMED
    assert bind_telegram(token_of(started["deep_link"]), TG_ID).value == "invalid"


def test_other_browser_without_poll_secret_gets_no_session(telegram_settings: Any) -> None:
    owner = APIClient()
    started = start(owner)
    bind_telegram(token_of(started["deep_link"]), TG_ID)
    verify_contact(own_contact())

    attacker = APIClient()  # knows request_id/deep link, but not the httpOnly poll cookie
    response = attacker.get(f"/api/v1/auth/telegram/status/{started['request_id']}")
    assert response.status_code == 404
    assert attacker.get("/api/v1/me").status_code in (401, 403)
    assert not User.objects.exists()


def test_blocked_user_cannot_log_in(telegram_settings: Any) -> None:
    User.objects.create_user(phone=PHONE, telegram_user_id=TG_ID, is_blocked=True)
    client = APIClient()
    started = start(client)
    bind_telegram(token_of(started["deep_link"]), TG_ID)
    verify_contact(own_contact())
    response = client.get(f"/api/v1/auth/telegram/status/{started['request_id']}")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "user_blocked"


# --- input validation and limits ---------------------------------------------------------


def test_invalid_phone_rejected(telegram_settings: Any) -> None:
    response = APIClient().post("/api/v1/auth/telegram/start", {"phone": "+7 900 123 45 67"}, format="json")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_phone"


def test_rate_limit_per_phone(telegram_settings: Any) -> None:
    telegram_settings.LOGIN_RATE_PER_IP_PER_HOUR = 100
    client = APIClient()
    for _ in range(5):
        start(client)
    response = client.post("/api/v1/auth/telegram/start", {"phone": PHONE}, format="json")
    assert response.status_code == 429
    assert response.json()["error"]["code"] == "rate_limited"


def test_rate_limit_per_ip(telegram_settings: Any) -> None:
    telegram_settings.LOGIN_RATE_PER_IP_PER_HOUR = 3
    client = APIClient()
    for i in range(3):
        start(client, phone=f"+99890000000{i}")
    response = client.post("/api/v1/auth/telegram/start", {"phone": "+998900000009"}, format="json")
    assert response.status_code == 429


def test_login_unavailable_without_bot_config(settings: Any) -> None:
    settings.TELEGRAM_BOT_TOKEN = ""
    response = APIClient().post("/api/v1/auth/telegram/start", {"phone": PHONE}, format="json")
    assert response.status_code == 503


def test_secrets_are_stored_hashed(telegram_settings: Any) -> None:
    started = start(APIClient())
    req = LoginRequest.objects.get()
    assert token_of(started["deep_link"]) not in (req.token_hash, req.poll_secret_hash)
    assert len(req.token_hash) == 64


# --- through the bot handler ----------------------------------------------------------------


def test_bot_flow_end_to_end(telegram_settings: Any) -> None:
    client = APIClient()
    started = start(client)
    replies = process_update(tg_message(TG_ID, text=f"/start {token_of(started['deep_link'])}"))
    assert replies[0].reply_markup is not None and "keyboard" in replies[0].reply_markup

    replies = process_update(
        tg_message(TG_ID, contact={"user_id": TG_ID, "phone_number": "+998901234567", "first_name": "Ali"})
    )
    assert "tasdiqlandi" in replies[0].text
    assert status(client, started["request_id"])["status"] == "verified"
    assert User.objects.get().telegram_username == "ali_chorva"


# --- profile ---------------------------------------------------------------------------------


def test_profile_update_requires_district_in_region(load_reference_data: None) -> None:
    from reference.models import District, Region

    user = User.objects.create_user(phone=PHONE)
    client = APIClient()
    client.force_authenticate(user)
    andijon = Region.objects.get(name="Andijon viloyati")
    buxoro_district = District.objects.filter(region__name="Buxoro viloyati").first()
    assert buxoro_district is not None

    bad = client.patch(
        "/api/v1/me", {"region_id": andijon.id, "district_id": buxoro_district.id}, format="json"
    )
    assert bad.status_code == 400

    good_district = andijon.districts.first()
    assert good_district is not None
    ok = client.patch(
        "/api/v1/me",
        {"first_name": "Ali", "region_id": andijon.id, "district_id": good_district.id},
        format="json",
    )
    assert ok.status_code == 200
    assert ok.json()["needs_profile"] is False


def test_logout_ends_session(telegram_settings: Any) -> None:
    user = User.objects.create_user(phone=PHONE)
    client = APIClient(enforce_csrf_checks=False)
    client.force_login(user)
    assert client.get("/api/v1/me").status_code == 200
    assert client.post("/api/v1/auth/logout").status_code == 204
    assert client.get("/api/v1/me").status_code in (401, 403)
