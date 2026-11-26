"""Native app push through Firebase Cloud Messaging (FR-21): device tokens and delivery."""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from rest_framework.test import APIClient

from accounts.models import User
from notifications import services
from notifications.models import DeviceToken, Notification

pytestmark = pytest.mark.django_db

TOKEN = "fcm-token-" + "x" * 140
SERVICE_ACCOUNT = {"type": "service_account", "project_id": "zotdor-test", "client_email": "a@b.c"}


@pytest.fixture(autouse=True)
def _fcm(settings: Any) -> None:
    settings.FIREBASE_SERVICE_ACCOUNT_JSON = json.dumps(SERVICE_ACCOUNT)
    settings.FIREBASE_SERVICE_ACCOUNT_FILE = ""
    settings.VAPID_PRIVATE_KEY = ""  # web push off: only the native path is tested here
    services.reset_fcm_session()


@pytest.fixture
def user() -> User:
    return User.objects.create_user(phone="+998901000001", first_name="Ali")


def client_for(user: User | None) -> APIClient:
    c = APIClient()
    if user is not None:
        c.force_authenticate(user)
    return c


def response(status: int, body: dict[str, Any] | None = None) -> MagicMock:
    r = MagicMock(status_code=status)
    r.json.return_value = body or {}
    r.text = json.dumps(body or {})
    return r


# --- device tokens -------------------------------------------------------------------------------


def test_device_token_is_saved_and_moves_with_login(user: User) -> None:
    other = User.objects.create_user(phone="+998901000002", first_name="Vali")
    body = {"token": TOKEN, "platform": "android", "app_version": "1.0"}
    assert client_for(user).post("/api/v1/me/devices", body, format="json").status_code == 201
    assert client_for(other).post("/api/v1/me/devices", body, format="json").status_code == 201
    d = DeviceToken.objects.get()
    assert d.user == other and d.platform == "android" and d.app_version == "1.0"


@pytest.mark.parametrize("body", [{"token": "", "platform": "android"}, {"token": TOKEN, "platform": "web"}])
def test_bad_device_token_is_refused(user: User, body: dict[str, Any]) -> None:
    r = client_for(user).post("/api/v1/me/devices", body, format="json")
    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_device"


def test_device_removed_only_by_owner(user: User) -> None:
    other = User.objects.create_user(phone="+998901000002", first_name="Vali")
    client_for(user).post("/api/v1/me/devices", {"token": TOKEN, "platform": "android"}, format="json")
    client_for(other).delete("/api/v1/me/devices", {"token": TOKEN}, format="json")
    assert DeviceToken.objects.exists()
    assert client_for(user).delete("/api/v1/me/devices", {"token": TOKEN}, format="json").status_code == 204
    assert not DeviceToken.objects.exists()


def test_devices_need_login() -> None:
    r = client_for(None).post("/api/v1/me/devices", {"token": TOKEN, "platform": "android"}, format="json")
    assert r.status_code in (401, 403)


# --- delivery ------------------------------------------------------------------------------------


def test_notify_queues_one_push_job_for_app_users(
    user: User, django_capture_on_commit_callbacks: Any
) -> None:
    DeviceToken.objects.create(user=user, token=TOKEN, platform="android")
    with (
        patch("notifications.tasks.send_push.defer") as defer,
        django_capture_on_commit_callbacks(execute=True),
    ):
        services.notify(user, "bid_outbid", "Siz 1-oʻrindan tushdingiz", telegram=False)
    defer.assert_called_once_with(notification_id=Notification.objects.get().id)


def test_no_job_when_firebase_is_not_configured(
    user: User, settings: Any, django_capture_on_commit_callbacks: Any
) -> None:
    settings.FIREBASE_SERVICE_ACCOUNT_JSON = ""
    DeviceToken.objects.create(user=user, token=TOKEN, platform="android")
    with (
        patch("notifications.tasks.send_push.defer") as defer,
        django_capture_on_commit_callbacks(execute=True),
    ):
        services.notify(user, "bid_outbid", "Siz 1-oʻrindan tushdingiz", telegram=False)
    defer.assert_not_called()


def test_fcm_message_is_data_only_with_channel_and_url(user: User) -> None:
    DeviceToken.objects.create(user=user, token=TOKEN, platform="android")
    n = Notification.objects.create(
        user=user, type="bid_outbid", title="Siz 1-oʻrindan tushdingiz", body="Yangi taklif", link="/a/7"
    )
    session = MagicMock()
    session.post.return_value = response(200, {"name": "projects/zotdor-test/messages/1"})
    with patch("notifications.services._fcm_session", return_value=session):
        assert services.send_fcm(n.id) == 1

    url, kwargs = session.post.call_args.args[0], session.post.call_args.kwargs
    assert url == "https://fcm.googleapis.com/v1/projects/zotdor-test/messages:send"
    message = kwargs["json"]["message"]
    assert message["token"] == TOKEN
    # Data only: the app draws the notification itself (channel, icon, colour, tap target).
    assert "notification" not in message
    assert message["data"] == {
        "title": "Siz 1-oʻrindan tushdingiz",
        "body": "Yangi taklif",
        "url": "/a/7",
        "tag": f"n{n.id}",
        "channel": "bids",
    }
    assert message["android"]["priority"] == "HIGH"
    d = DeviceToken.objects.get()
    assert d.last_used_at is not None and d.failures == 0


@pytest.mark.parametrize(
    ("type_", "channel"),
    [
        ("auction_started", "auctions"),
        ("deal_created", "deals"),
        ("topup_done", "wallet"),
        ("bug_report_closed", "general"),
    ],
)
def test_channel_follows_notification_type(type_: str, channel: str) -> None:
    assert services.fcm_channel(type_) == channel


def test_unregistered_token_is_deleted(user: User) -> None:
    DeviceToken.objects.create(user=user, token=TOKEN, platform="android")
    n = Notification.objects.create(user=user, type="t", title="T")
    gone = response(404, {"error": {"status": "NOT_FOUND", "details": [{"errorCode": "UNREGISTERED"}]}})
    session = MagicMock()
    session.post.return_value = gone
    with patch("notifications.services._fcm_session", return_value=session):
        assert services.send_fcm(n.id) == 0
    assert not DeviceToken.objects.exists()


def test_temporary_fcm_failure_keeps_token(user: User) -> None:
    DeviceToken.objects.create(user=user, token=TOKEN, platform="android")
    n = Notification.objects.create(user=user, type="t", title="T")
    session = MagicMock()
    session.post.return_value = response(503, {"error": {"status": "UNAVAILABLE"}})
    with patch("notifications.services._fcm_session", return_value=session):
        assert services.send_fcm(n.id) == 0
    assert DeviceToken.objects.get().failures == 1
