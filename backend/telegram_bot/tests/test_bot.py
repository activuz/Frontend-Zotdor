from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest
from rest_framework.test import APIClient

from conftest import tg_message
from telegram_bot.handlers import MSG_LINK_INVALID, MSG_NO_REQUEST, MSG_WELCOME, process_update

pytestmark = pytest.mark.django_db


def test_plain_start_explains_how_to_log_in() -> None:
    assert process_update(tg_message(1, text="/start"))[0].text == MSG_WELCOME


def test_unknown_token_is_reported() -> None:
    assert process_update(tg_message(1, text="/start not-a-real-token"))[0].text == MSG_LINK_INVALID


def test_contact_without_login_request() -> None:
    update = tg_message(1, contact={"user_id": 1, "phone_number": "998901234567"})
    assert process_update(update)[0].text == MSG_NO_REQUEST


def test_group_chats_are_ignored() -> None:
    update = tg_message(1, text="/start")
    update["message"]["chat"]["type"] = "group"
    assert process_update(update) == []


def test_non_message_updates_are_ignored() -> None:
    assert process_update({"update_id": 5, "edited_message": {}}) == []


def test_webhook_rejects_wrong_url_secret(telegram_settings: Any) -> None:
    response = APIClient().post(
        "/api/telegram/webhook/wrong",
        tg_message(1, text="/start"),
        format="json",
        HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN="hook-secret",
    )
    assert response.status_code == 404


def test_webhook_rejects_missing_header(telegram_settings: Any) -> None:
    response = APIClient().post(
        "/api/telegram/webhook/hook-secret", tg_message(1, text="/start"), format="json"
    )
    assert response.status_code == 404


def test_webhook_disabled_when_secret_not_configured(settings: Any) -> None:
    settings.TELEGRAM_WEBHOOK_SECRET = ""
    response = APIClient().post(
        "/api/telegram/webhook/x",
        tg_message(1, text="/start"),
        format="json",
        HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN="x",
    )
    assert response.status_code == 404


def test_webhook_processes_update_and_replies(telegram_settings: Any) -> None:
    with patch("telegram_bot.views.send_message") as send:
        response = APIClient().post(
            "/api/telegram/webhook/hook-secret",
            tg_message(42, text="/start"),
            format="json",
            HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN="hook-secret",
        )
    assert response.status_code == 200
    send.assert_called_once()
    assert send.call_args.args[0] == 42
