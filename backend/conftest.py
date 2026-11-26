from __future__ import annotations

from typing import Any

import pytest
from django.core.management import call_command


@pytest.fixture(autouse=True)
def _no_external_services(settings: Any, tmp_path: Any) -> None:
    """Tests never touch real services, whatever backend/.env says.

    A developer .env often holds production values (STORAGE_BACKEND=nhost, push keys). Without
    this, uploads in tests went to the real Nhost bucket. Tests that need a service configure
    a fake one themselves (e.g. telegram_settings, the push tests).
    """
    settings.STORAGE_BACKEND = "local"
    settings.MEDIA_ROOT = str(tmp_path / "media")
    settings.VAPID_PUBLIC_KEY = ""
    settings.VAPID_PRIVATE_KEY = ""
    settings.FIREBASE_SERVICE_ACCOUNT_JSON = ""
    settings.FIREBASE_SERVICE_ACCOUNT_FILE = ""
    settings.SUPPORT_TELEGRAM_CHAT_ID = ""
    settings.LEADS_TELEGRAM_CHAT_ID = ""


@pytest.fixture
def telegram_settings(settings: Any) -> Any:
    """A configured (fake) bot. No test ever reaches the real Telegram API."""
    settings.TELEGRAM_BOT_TOKEN = "test-token"  # noqa: S105
    settings.TELEGRAM_BOT_USERNAME = "ZotdorTestBot"
    settings.TELEGRAM_WEBHOOK_SECRET = "hook-secret"  # noqa: S105
    return settings


@pytest.fixture
def load_reference_data(db: None) -> None:
    call_command("load_reference", verbosity=0)


def tg_message(user_id: int, **fields: Any) -> dict[str, Any]:
    """Build a Telegram update with a private-chat message from `user_id`."""
    return {
        "update_id": 1,
        "message": {
            "message_id": 1,
            "chat": {"id": user_id, "type": "private"},
            "from": {"id": user_id, "first_name": "Ali", "username": "ali_chorva"},
            **fields,
        },
    }
