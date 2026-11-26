"""After the phone is verified, the bot links back to where the login started (site or app)."""

from __future__ import annotations

from typing import Any
from urllib.parse import parse_qs, urlparse

import pytest
from rest_framework.test import APIClient

from accounts.models import LoginRequest
from conftest import tg_message
from telegram_bot.handlers import MSG_VERIFIED, REMOVE_KEYBOARD, process_update

pytestmark = pytest.mark.django_db

TG_ID = 555001


def login_until_contact(client_kind: str | None) -> list[Any]:
    body: dict[str, Any] = {"phone": "90 123 45 67"}
    if client_kind is not None:
        body["client"] = client_kind
    started = APIClient().post("/api/v1/auth/telegram/start", body, format="json").json()
    token = parse_qs(urlparse(started["deep_link"]).query)["start"][0]
    process_update(tg_message(TG_ID, text=f"/start {token}"))
    contact = {"user_id": TG_ID, "phone_number": "998901234567", "first_name": "Ali"}
    return process_update(tg_message(TG_ID, contact=contact))


def button_url(reply: Any) -> str:
    return str(reply.reply_markup["inline_keyboard"][0][0]["url"])


@pytest.mark.parametrize(
    ("client_kind", "path"),
    [(None, "/login?continue=1"), ("web", "/login?continue=1"), ("app", "/app/login")],
)
def test_verified_reply_links_back(
    telegram_settings: Any, settings: Any, client_kind: str | None, path: str
) -> None:
    settings.FRONTEND_URL = "https://web.zotdor.uz"
    replies = login_until_contact(client_kind)
    # Telegram allows one keyboard per message: first close the "share phone" keyboard...
    assert replies[0].text == MSG_VERIFIED and replies[0].reply_markup == REMOVE_KEYBOARD
    # ...then a button back. The site path is not an App Link, so a login begun in a browser
    # ends in that browser (its poll cookie is there); /app/login opens the Android app.
    assert button_url(replies[1]) == f"https://web.zotdor.uz{path}"


def test_client_is_stored(telegram_settings: Any) -> None:
    body = {"phone": "90 123 45 67", "client": "app"}
    APIClient().post("/api/v1/auth/telegram/start", body, format="json")
    assert LoginRequest.objects.get().client == "app"


def test_no_button_without_https_frontend(telegram_settings: Any, settings: Any) -> None:
    # Telegram rejects non-https buttons (e.g. a local dev URL): the text alone is sent.
    settings.FRONTEND_URL = "http://localhost:3000"
    replies = login_until_contact(None)
    assert [r.text for r in replies] == [MSG_VERIFIED]
