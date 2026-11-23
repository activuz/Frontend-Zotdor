"""Point the production bot at this server (docs/ARCHITECTURE.md §6).

Usage: manage.py telegram_set_webhook https://zotdor.uz
The URL and Telegram's secret header both carry TELEGRAM_WEBHOOK_SECRET.
"""

from __future__ import annotations

from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError, CommandParser

from telegram_bot.client import call


class Command(BaseCommand):
    help = "Register the Telegram webhook for the given public origin."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("origin", help="Public HTTPS origin that proxies /api, e.g. https://zotdor.uz")

    def handle(self, *args: Any, **options: Any) -> None:
        origin = str(options["origin"]).rstrip("/")
        secret = settings.TELEGRAM_WEBHOOK_SECRET
        if not origin.startswith("https://"):
            raise CommandError("Telegram faqat HTTPS manzilni qabul qiladi.")
        if len(secret) < 16:
            raise CommandError("TELEGRAM_WEBHOOK_SECRET kamida 16 belgidan iborat boʻlsin.")
        call(
            "setWebhook",
            {
                "url": f"{origin}/api/telegram/webhook/{secret}",
                "secret_token": secret,
                "drop_pending_updates": False,
            },
        )
        info = call("getWebhookInfo")
        self.stdout.write(self.style.SUCCESS(f"Webhook: {str(info.get('url', '')).replace(secret, '***')}"))
