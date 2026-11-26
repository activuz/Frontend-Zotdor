"""Turn Telegram updates into login actions and bot replies.

Pure with respect to Telegram: returns the replies to send, so it is testable without
network access. Only private chats are handled.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from django.conf import settings

from accounts import services
from accounts.phone import mask_phone, normalize_phone
from accounts.services import BindResult, ContactResult, SharedContact

SHARE_KEYBOARD = {
    "keyboard": [[{"text": "Raqamni ulashish", "request_contact": True}]],
    "resize_keyboard": True,
    "one_time_keyboard": True,
}
REMOVE_KEYBOARD = {"remove_keyboard": True}

MSG_WELCOME = (
    "Assalomu alaykum! Bu Zotdor.uz bilan kirish uchun bot.\n\n"
    "Saytda telefon raqamingizni kiriting va «Telegram orqali tasdiqlash» tugmasini bosing."
)
MSG_SHARE = "Kirishni tasdiqlash uchun pastdagi «Raqamni ulashish» tugmasini bosing."
MSG_LINK_INVALID = "Havola eskirgan yoki notoʻgʻri. Saytda qaytadan urinib koʻring."
MSG_VERIFIED = "Raqam tasdiqlandi. Zotdorʼga qayting — kirish oʻzi davom etadi."
MSG_RETURN = "Kirishni yakunlash uchun pastdagi tugmani bosing."
BUTTON_RETURN = "Zotdorʼga qaytish"
# A login begun in the Android app returns through a path the app opens (App Links);
# one begun in a browser returns to /login, which the app deliberately does not open.
RETURN_PATH = {"app": "/app/login", "web": "/login?continue=1"}
MSG_NO_REQUEST = "Avval saytda raqamingizni kiriting va tasdiqlash havolasini bosing."
MSG_FOREIGN = "Faqat oʻzingizning raqamingizni ulashish mumkin. Pastdagi tugmadan foydalaning."
MSG_CONFLICT = "Bu raqam boshqa Telegram akkauntiga bogʻlangan, shu sababli kirish rad etildi."


def _mismatch_message(telegram_phone: str) -> str:
    shown = mask_phone(telegram_phone) if telegram_phone else "boshqa"
    return (
        f"Telegramʼdagi raqamingiz ({shown}) saytda kiritilgan raqamga mos kelmadi. "
        "Saytda Telegramʼga bogʻlangan raqamni kiriting."
    )


@dataclass(frozen=True)
class Reply:
    chat_id: int
    text: str
    reply_markup: dict[str, Any] | None = None


def process_update(update: dict[str, Any]) -> list[Reply]:
    message = update.get("message")
    if not isinstance(message, dict):
        return []
    chat = message.get("chat") or {}
    sender = message.get("from") or {}
    if chat.get("type") != "private" or not isinstance(sender.get("id"), int):
        return []
    chat_id: int = chat["id"]
    user_id: int = sender["id"]

    contact = message.get("contact")
    if isinstance(contact, dict):
        return _handle_contact(chat_id, user_id, contact, str(sender.get("username") or ""))

    text = message.get("text") or ""
    if text.startswith("/start"):
        token = text.removeprefix("/start").strip()
        if not token:
            return [Reply(chat_id, MSG_WELCOME)]
        if services.bind_telegram(token, user_id) is BindResult.OK:
            return [Reply(chat_id, MSG_SHARE, SHARE_KEYBOARD)]
        return [Reply(chat_id, MSG_LINK_INVALID, REMOVE_KEYBOARD)]

    return [Reply(chat_id, MSG_WELCOME)]


def _return_button(client: str) -> dict[str, Any] | None:
    base = (settings.FRONTEND_URL or "").rstrip("/")
    if not base.startswith("https://"):
        return None  # Telegram refuses non-https button links (local development)
    url = base + RETURN_PATH.get(client, RETURN_PATH["web"])
    return {"inline_keyboard": [[{"text": BUTTON_RETURN, "url": url}]]}


def _handle_contact(chat_id: int, user_id: int, contact: dict[str, Any], username: str) -> list[Reply]:
    shared = SharedContact(
        from_user_id=user_id,
        contact_user_id=contact.get("user_id"),
        phone_number=str(contact.get("phone_number") or ""),
        first_name=str(contact.get("first_name") or ""),
        last_name=str(contact.get("last_name") or ""),
        username=username,
    )
    result, request = services.verify_contact(shared)
    if result is ContactResult.VERIFIED:
        replies = [Reply(chat_id, MSG_VERIFIED, REMOVE_KEYBOARD)]
        button = _return_button(request.client if request is not None else "web")
        if button is not None:
            replies.append(Reply(chat_id, MSG_RETURN, button))
        return replies
    if result is ContactResult.FOREIGN_CONTACT:
        return [Reply(chat_id, MSG_FOREIGN, SHARE_KEYBOARD)]
    if result is ContactResult.PHONE_MISMATCH:
        text = _mismatch_message(normalize_phone(shared.phone_number) or "")
        return [Reply(chat_id, text, REMOVE_KEYBOARD)]
    if result is ContactResult.ACCOUNT_CONFLICT:
        return [Reply(chat_id, MSG_CONFLICT, REMOVE_KEYBOARD)]
    return [Reply(chat_id, MSG_NO_REQUEST, REMOVE_KEYBOARD)]
