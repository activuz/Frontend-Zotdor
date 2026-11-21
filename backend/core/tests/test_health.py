from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import WorkerHeartbeat
from core.tasks import worker_heartbeat

pytestmark = pytest.mark.django_db


def test_health_reports_unknown_worker_before_first_beat() -> None:
    response = APIClient().get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "degraded", "db": "ok", "worker": "unknown"}


def test_health_ok_after_heartbeat_task_runs() -> None:
    worker_heartbeat(timestamp=0)
    response = APIClient().get("/api/health")
    assert response.json() == {"status": "ok", "db": "ok", "worker": "ok"}


def test_health_marks_old_heartbeat_as_stale() -> None:
    WorkerHeartbeat.objects.create(id=1, beat_at=timezone.now() - timedelta(minutes=10))
    response = APIClient().get("/api/health")
    assert response.json()["worker"] == "stale"


def test_health_needs_no_authentication() -> None:
    assert APIClient().get("/api/health").status_code == 200
