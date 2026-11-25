"""Bug reports from users (FR-19): public form, staff queue in the panel."""

from __future__ import annotations

from typing import Any

import pytest
from rest_framework.test import APIClient

from accounts.models import User
from core.models import StaffAuditLog
from feedback.models import BugReport
from notifications.models import Notification, TelegramOutbox

pytestmark = pytest.mark.django_db

URL = "/api/v1/bug-reports"
MESSAGE = "Videoni yuklaganimda sahifa qotib qoldi."


def _post(client: APIClient | None = None, ip: str = "10.0.0.1", **fields: Any) -> Any:
    body = {"message": MESSAGE, "page_url": "https://web.zotdor.uz/sell/x?step=media", **fields}
    return (client or APIClient()).post(
        URL, body, format="json", REMOTE_ADDR=ip, HTTP_USER_AGENT="Mozilla/5.0 Test"
    )


def test_guest_report_is_stored_with_context() -> None:
    r = _post(contact="+998 90 123 45 67", viewport="390x844", error="TypeError: x is undefined")
    assert r.status_code == 201
    report = BugReport.objects.get(id=r.json()["id"])
    assert report.user is None
    assert report.message == MESSAGE
    assert report.contact == "+998 90 123 45 67"
    assert report.page_url.endswith("step=media")
    assert report.user_agent == "Mozilla/5.0 Test"
    assert report.viewport == "390x844"
    assert report.error_text == "TypeError: x is undefined"
    assert report.status == BugReport.ReportStatus.NEW


def test_logged_in_report_is_linked_to_user() -> None:
    user = User.objects.create_user(phone="+998901000001", first_name="Ali")
    client = APIClient()
    client.force_authenticate(user)
    assert _post(client).status_code == 201
    assert BugReport.objects.get().user == user


@pytest.mark.parametrize(
    ("fields", "code"),
    [
        ({"message": "yomon"}, "message_too_short"),
        ({"message": "x" * 2001}, "message_too_long"),
    ],
)
def test_validation(fields: dict[str, Any], code: str) -> None:
    r = _post(**fields)
    assert r.status_code == 400 and r.json()["error"]["code"] == code
    assert not BugReport.objects.exists()


def test_long_context_is_truncated_not_refused() -> None:
    r = _post(page_url="https://web.zotdor.uz/" + "a" * 900, error="e" * 5000)
    assert r.status_code == 201
    report = BugReport.objects.get()
    assert len(report.page_url) == 500 and len(report.error_text) == 2000


def test_rate_limited_per_ip(settings: Any) -> None:
    settings.BUG_REPORTS_PER_HOUR = 2
    assert _post().status_code == 201
    assert _post().status_code == 201
    r = _post()
    assert r.status_code == 429 and r.json()["error"]["code"] == "rate_limited"
    assert _post(ip="10.0.0.2").status_code == 201


def test_staff_are_notified_in_telegram(settings: Any) -> None:
    settings.SUPPORT_TELEGRAM_CHAT_ID = "-100123"
    _post(contact="@ali")
    msg = TelegramOutbox.objects.get()
    assert msg.chat_id == -100123
    assert MESSAGE in msg.text and "@ali" in msg.text and "step=media" in msg.text


def test_no_telegram_without_chat(settings: Any) -> None:
    settings.SUPPORT_TELEGRAM_CHAT_ID = ""
    _post()
    assert not TelegramOutbox.objects.exists()


def test_panel_lists_and_resolves_with_audit() -> None:
    mod = User.objects.create_user(phone="+998909000001", role=User.Role.MODERATOR, first_name="Mod")
    report_id = _post().json()["id"]
    staff = APIClient()
    staff.force_authenticate(mod)

    page = staff.get("/api/panel/bug-reports?status=new").json()
    assert page["count"] == 1 and page["results"][0]["message"] == MESSAGE
    assert staff.get("/api/panel/stats").json()["queues"]["bug_reports"] == 1

    r = staff.post(
        f"/api/panel/bug-reports/{report_id}/status",
        {"status": "resolved", "note": "Tuzatildi"},
        format="json",
    )
    assert r.status_code == 200 and r.json()["status"] == "resolved"
    report = BugReport.objects.get()
    assert report.handled_by == mod and report.handled_note == "Tuzatildi"
    assert StaffAuditLog.objects.filter(action="bug_report.resolved").exists()


@pytest.mark.parametrize(
    ("new_status", "title_part"), [("resolved", "tuzatildi"), ("closed", "koʻrib chiqildi")]
)
def test_reporter_is_told_the_outcome_in_app_and_telegram(new_status: str, title_part: str) -> None:
    mod = User.objects.create_user(phone="+998909000001", role=User.Role.MODERATOR, first_name="Mod")
    user = User.objects.create_user(phone="+998901000001", first_name="Ali", telegram_user_id=555)
    client = APIClient()
    client.force_authenticate(user)
    report_id = _post(client).json()["id"]
    staff = APIClient()
    staff.force_authenticate(mod)

    staff.post(
        f"/api/panel/bug-reports/{report_id}/status",
        {"status": new_status, "note": "Yangi versiyada tuzatdik, rahmat!"},
        format="json",
    )

    n = Notification.objects.get(user=user)
    assert n.type == f"bug_report_{new_status}"
    assert title_part in n.title
    assert "Yangi versiyada tuzatdik" in n.body and "Videoni yuklaganimda" in n.body
    tg = TelegramOutbox.objects.get(chat_id=555)
    assert "Yangi versiyada tuzatdik" in tg.text


def test_guest_reporter_gets_nothing_and_no_crash() -> None:
    mod = User.objects.create_user(phone="+998909000001", role=User.Role.MODERATOR, first_name="Mod")
    report_id = _post().json()["id"]
    staff = APIClient()
    staff.force_authenticate(mod)
    r = staff.post(f"/api/panel/bug-reports/{report_id}/status", {"status": "closed"}, format="json")
    assert r.status_code == 200
    assert not Notification.objects.exists()


def test_panel_needs_staff() -> None:
    user = User.objects.create_user(phone="+998901000009", first_name="U")
    client = APIClient()
    client.force_authenticate(user)
    assert client.get("/api/panel/bug-reports").status_code == 403
