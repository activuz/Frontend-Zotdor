from __future__ import annotations

from typing import Any

import pytest
from django.core.management import call_command


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
