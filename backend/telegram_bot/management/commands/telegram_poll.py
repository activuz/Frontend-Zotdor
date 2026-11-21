"""Run the bot locally with long polling (no public URL needed).

Removes any configured webhook first, because Telegram refuses getUpdates while a webhook
is set. Do not run this against the production bot while production uses the webhook.
"""

from __future__ import annotations

import time
from typing import Any

from django.core.management.base import BaseCommand

from telegram_bot.client import TelegramError, call, send_message
from telegram_bot.handlers import process_update


class Command(BaseCommand):
    help = "Process Telegram bot updates via long polling (local development)."

    def handle(self, *args: Any, **options: Any) -> None:
        me = call("getMe")
        call("deleteWebhook", {"drop_pending_updates": False})
        self.stdout.write(self.style.SUCCESS(f"Polling as @{me['username']} — Ctrl+C to stop"))
        offset = 0
        while True:
            try:
                updates = call("getUpdates", {"offset": offset, "timeout": 25}, timeout=35)
            except TelegramError as exc:
                self.stderr.write(str(exc))
                time.sleep(3)
                continue
            for update in updates:
                offset = update["update_id"] + 1
                for reply in process_update(update):
                    send_message(reply.chat_id, reply.text, reply.reply_markup)
