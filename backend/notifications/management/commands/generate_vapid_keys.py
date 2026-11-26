"""Print a new VAPID key pair for Web Push (FR-20). Run once, put both values in the env.

Changing the keys later unsubscribes every browser: users have to allow notifications again.
"""

from __future__ import annotations

import base64
from typing import Any

from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from django.core.management.base import BaseCommand
from py_vapid import Vapid01


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


class Command(BaseCommand):
    help = "Generate VAPID keys for browser push notifications."

    def handle(self, *args: Any, **options: Any) -> None:
        vapid = Vapid01()
        vapid.generate_keys()
        private = vapid.private_key.private_numbers().private_value.to_bytes(32, "big")
        public = vapid.public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
        self.stdout.write(f"VAPID_PUBLIC_KEY={_b64url(public)}")
        self.stdout.write(f"VAPID_PRIVATE_KEY={_b64url(private)}")
        self.stdout.write(
            "Maxfiy kalitni faqat env'da saqlang. Uni almashtirsangiz, barcha obunalar bekor boʻladi."
        )
