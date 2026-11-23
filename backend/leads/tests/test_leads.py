from __future__ import annotations

from typing import Any

import pytest
from rest_framework.test import APIClient

from accounts.models import User
from core.models import StaffAuditLog
from leads.models import Lead
from notifications.models import TelegramOutbox
from reference.models import Region

pytestmark = pytest.mark.django_db

URL = "/api/v1/leads"


def _post(client: APIClient | None = None, **fields: Any) -> Any:
    body = {"name": "Anvar", "phone": "+998 90 123 45 67", "role": "seller", **fields}
    return (client or APIClient()).post(URL, body, format="json", REMOTE_ADDR="10.0.0.1")


def test_lead_is_stored_with_normalized_phone() -> None:
    region = Region.objects.create(name="Surxondaryo viloyati")
    response = _post(region=region.id, message="  Buqa sotmoqchiman  ", utm="instagram")
    assert response.status_code == 201
    lead = Lead.objects.get(id=response.json()["id"])
    assert lead.phone == "+998901234567"
    assert lead.region == region
    assert lead.message == "Buqa sotmoqchiman"
    assert lead.status == Lead.LeadStatus.NEW
    assert lead.ip == "10.0.0.1"


def test_lead_needs_no_csrf_even_with_enforcing_client() -> None:
    response = _post(APIClient(enforce_csrf_checks=True))
    assert response.status_code == 201


@pytest.mark.parametrize(
    ("fields", "code"),
    [
        ({"name": "A"}, "invalid_name"),
        ({"phone": "+7 999 123 45 67"}, "invalid_phone"),
        ({"role": "broker"}, "invalid_role"),
        ({"region": 999}, "invalid_region"),
        ({"message": "x" * 1001}, "message_too_long"),
    ],
)
def test_lead_validation_errors(fields: dict[str, Any], code: str) -> None:
    response = _post(**fields)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == code
    assert not Lead.objects.exists()


def test_lead_rate_limited_per_phone(settings: Any) -> None:
    settings.LEADS_PER_PHONE_PER_DAY = 2
    assert _post().status_code == 201
    assert _post().status_code == 201
    response = _post()
    assert response.status_code == 429
    assert response.json()["error"]["code"] == "rate_limited"
    assert Lead.objects.count() == 2


def test_lead_rate_limited_per_ip(settings: Any) -> None:
    settings.LEADS_PER_IP_PER_HOUR = 1
    assert _post().status_code == 201
    assert _post(phone="+998911112233").status_code == 429


def test_lead_queues_staff_telegram_copy(settings: Any, django_capture_on_commit_callbacks: Any) -> None:
    settings.LEADS_TELEGRAM_CHAT_ID = "-1001234"
    with django_capture_on_commit_callbacks():
        assert _post(message="Qoʻylar bormi?").status_code == 201
    msg = TelegramOutbox.objects.get()
    assert msg.chat_id == -1001234
    assert "+998901234567" in msg.text
    assert "Qoʻylar bormi?" in msg.text


def test_lead_without_chat_id_sends_nothing(settings: Any) -> None:
    settings.LEADS_TELEGRAM_CHAT_ID = ""
    assert _post().status_code == 201
    assert not TelegramOutbox.objects.exists()


def _staff(role: str) -> APIClient:
    user = User.objects.create(phone="+998935550000", role=role)
    client = APIClient()
    client.force_authenticate(user)
    return client


def test_panel_lists_and_marks_lead_with_audit() -> None:
    lead_id = _post().json()["id"]
    client = _staff("moderator")
    page = client.get("/api/panel/leads").json()
    assert [row["id"] for row in page["results"]] == [lead_id]
    assert page["results"][0]["role_label"] == "Sotuvchi"

    response = client.post(
        f"/api/panel/leads/{lead_id}/status",
        {"status": "contacted", "note": "Qoʻngʻiroq qilindi"},
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["status"] == "contacted"
    log = StaffAuditLog.objects.get(action="lead.contacted")
    assert log.target_id == lead_id
    assert log.before["status"] == "new"
    assert client.get("/api/panel/leads").json()["results"] == []
    assert client.get("/api/panel/stats").json()["queues"]["leads"] == 0


def test_panel_rejects_invalid_lead_status() -> None:
    lead_id = _post().json()["id"]
    client = _staff("moderator")
    response = client.post(f"/api/panel/leads/{lead_id}/status", {"status": "new"}, format="json")
    assert response.status_code == 400


def test_regular_user_cannot_see_leads() -> None:
    _post()
    assert _staff("user").get("/api/panel/leads").status_code == 403
