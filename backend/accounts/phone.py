"""Uzbek phone number normalization (BR-03: only +998 numbers)."""

from __future__ import annotations

import re

_DIGITS = re.compile(r"\D+")


def normalize_phone(raw: str) -> str | None:
    """Return +998XXXXXXXXX, or None if the input is not an Uzbek number.

    Accepts the shapes people actually type or Telegram sends:
    "+998 90 123-45-67", "998901234567", "90 123 45 67", "(90) 1234567".
    """
    digits = _DIGITS.sub("", raw or "")
    if len(digits) == 9:
        digits = "998" + digits
    if len(digits) != 12 or not digits.startswith("998"):
        return None
    return "+" + digits


def mask_phone(phone: str) -> str:
    """+998901234567 -> +998 90 *** ** 67 (for messages that may be seen by others)."""
    return f"{phone[:4]} {phone[4:6]} *** ** {phone[-2:]}"
