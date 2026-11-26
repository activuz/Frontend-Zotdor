"""Browser push notifications (FR-20): subscriptions and delivery through the worker."""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from pywebpush import WebPushException
from rest_framework.test import APIClient

from accounts.models import User
from notifications import services
from notifications.models import Notification, PushSubscription

pytestmark = pytest.mark.django_db

ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc123"
KEYS = {"p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA", "auth": "tBHItJI5svbpez7KI4CCXg"}
SUB: dict[str, Any] = {"endpoint": ENDPOINT, "keys": KEYS}


@pytest.fixture(autouse=True)
def _vapid(settings: Any) -> None:
    settings.VAPID_PUBLIC_KEY = "BPublicKeyForTests"
    settings.VAPID_PRIVATE_KEY = "private-key-for-tests"
    settings.VAPID_SUBJECT = "https://web.zotdor.uz"


@pytest.fixture
def user() -> User:
    return User.objects.create_user(phone="+998901000001", first_name="Ali")


def client_for(user: User | None) -> APIClient:
    c = APIClient()
    if user is not None:
        c.force_authenticate(user)
    return c


# --- config and subscriptions --------------------------------------------------------------------


def test_public_key_is_open_to_everyone(settings: Any) -> None:
    settings.FIREBASE_SERVICE_ACCOUNT_JSON = '{"project_id": "zotdor-test"}'
    body = client_for(None).get("/api/v1/push/public-key").json()
    assert body == {"public_key": "BPublicKeyForTests", "app_push": True}


def test_public_key_is_null_when_push_is_not_configured(settings: Any) -> None:
    settings.VAPID_PRIVATE_KEY = ""
    settings.FIREBASE_SERVICE_ACCOUNT_JSON = ""
    settings.FIREBASE_SERVICE_ACCOUNT_FILE = ""
    body = client_for(None).get("/api/v1/push/public-key").json()
    # Both flags let anyone check the production config from outside (docs/DEPLOYMENT.md).
    assert body == {"public_key": None, "app_push": False}


def test_subscribe_is_idempotent_per_endpoint(user: User) -> None:
    c = client_for(user)
    assert c.post("/api/v1/me/push-subscriptions", SUB, format="json").status_code == 201
    assert c.post("/api/v1/me/push-subscriptions", SUB, format="json").status_code == 201
    sub = PushSubscription.objects.get()
    assert sub.user == user and sub.p256dh == KEYS["p256dh"]


def test_same_browser_moves_to_the_user_who_logs_in(user: User) -> None:
    other = User.objects.create_user(phone="+998901000002", first_name="Vali")
    client_for(user).post("/api/v1/me/push-subscriptions", SUB, format="json")
    client_for(other).post("/api/v1/me/push-subscriptions", SUB, format="json")
    assert PushSubscription.objects.get().user == other


@pytest.mark.parametrize(
    "body",
    [
        {"endpoint": "http://insecure.example/x", "keys": SUB["keys"]},
        {"endpoint": SUB["endpoint"], "keys": {"p256dh": "", "auth": "x"}},
        {"endpoint": SUB["endpoint"]},
    ],
)
def test_bad_subscription_is_refused(user: User, body: dict[str, Any]) -> None:
    r = client_for(user).post("/api/v1/me/push-subscriptions", body, format="json")
    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_subscription"
    assert not PushSubscription.objects.exists()


def test_subscribing_needs_login() -> None:
    r = client_for(None).post("/api/v1/me/push-subscriptions", SUB, format="json")
    assert r.status_code in (401, 403)


def test_unsubscribe_removes_only_own(user: User) -> None:
    other = User.objects.create_user(phone="+998901000002", first_name="Vali")
    client_for(user).post("/api/v1/me/push-subscriptions", SUB, format="json")
    r = client_for(other).delete(
        "/api/v1/me/push-subscriptions", {"endpoint": SUB["endpoint"]}, format="json"
    )
    assert r.status_code == 204 and PushSubscription.objects.exists()
    client_for(user).delete("/api/v1/me/push-subscriptions", {"endpoint": SUB["endpoint"]}, format="json")
    assert not PushSubscription.objects.exists()


def test_old_subscriptions_are_capped(user: User, settings: Any) -> None:
    settings.PUSH_SUBSCRIPTIONS_PER_USER = 2
    for i in range(3):
        body = {**SUB, "endpoint": f"https://fcm.googleapis.com/fcm/send/{i}"}
        client_for(user).post("/api/v1/me/push-subscriptions", body, format="json")
    endpoints = set(PushSubscription.objects.values_list("endpoint", flat=True))
    assert endpoints == {"https://fcm.googleapis.com/fcm/send/1", "https://fcm.googleapis.com/fcm/send/2"}


# --- delivery ------------------------------------------------------------------------------------


def test_notify_queues_push_after_commit(user: User, django_capture_on_commit_callbacks: Any) -> None:
    PushSubscription.objects.create(user=user, endpoint=ENDPOINT, p256dh="k", auth="a")
    with (
        patch("notifications.tasks.send_push.defer") as defer,
        django_capture_on_commit_callbacks(execute=True),
    ):
        services.notify(user, "auction_started", "Auksion boshlandi", link="/a/1", telegram=False)
    n = Notification.objects.get()
    defer.assert_called_once_with(notification_id=n.id)


def test_no_push_job_without_subscriptions(user: User, django_capture_on_commit_callbacks: Any) -> None:
    with (
        patch("notifications.tasks.send_push.defer") as defer,
        django_capture_on_commit_callbacks(execute=True),
    ):
        services.notify(user, "auction_started", "Auksion boshlandi", telegram=False)
    defer.assert_not_called()


def test_no_push_job_when_not_configured(
    user: User, settings: Any, django_capture_on_commit_callbacks: Any
) -> None:
    settings.VAPID_PRIVATE_KEY = ""
    PushSubscription.objects.create(user=user, endpoint=ENDPOINT, p256dh="k", auth="a")
    with (
        patch("notifications.tasks.send_push.defer") as defer,
        django_capture_on_commit_callbacks(execute=True),
    ):
        services.notify(user, "auction_started", "Auksion boshlandi", telegram=False)
    defer.assert_not_called()


def test_send_web_push_payload_and_cleanup(user: User) -> None:
    alive = PushSubscription.objects.create(
        user=user, endpoint="https://push.example/alive", p256dh="k", auth="a"
    )
    PushSubscription.objects.create(user=user, endpoint="https://push.example/gone", p256dh="k", auth="a")
    n = Notification.objects.create(
        user=user, type="bid_outbid", title="Siz 1-oʻrindan tushdingiz", body="x" * 500, link="/a/5"
    )

    def fake(subscription_info: dict[str, Any], **kw: Any) -> None:
        if subscription_info["endpoint"].endswith("gone"):
            raise WebPushException("gone", response=MagicMock(status_code=410))

    with patch("notifications.services.webpush", side_effect=fake) as wp:
        sent = services.send_web_push(n.id)

    assert sent == 1
    kwargs = wp.call_args_list[0].kwargs
    payload = json.loads(kwargs["data"])
    assert payload["title"] == "Siz 1-oʻrindan tushdingiz"
    assert payload["url"] == "/a/5" and payload["tag"] == f"n{n.id}"
    assert len(payload["body"]) <= 240
    assert kwargs["vapid_claims"] == {"sub": "https://web.zotdor.uz"}
    assert list(PushSubscription.objects.all()) == [alive]  # 410 Gone is removed
    alive.refresh_from_db()
    assert alive.last_used_at is not None


def test_temporary_push_failure_keeps_subscription(user: User) -> None:
    sub = PushSubscription.objects.create(user=user, endpoint="https://push.example/x", p256dh="k", auth="a")
    n = Notification.objects.create(user=user, type="t", title="T")
    busy = WebPushException("busy", response=MagicMock(status_code=503))
    with patch("notifications.services.webpush", side_effect=busy):
        assert services.send_web_push(n.id) == 0
    sub.refresh_from_db()
    assert sub.failures == 1
