from django.utils import timezone
from procrastinate.contrib.django import app

from core.models import WorkerHeartbeat


@app.periodic(cron="* * * * *")
@app.task(queue="default")
def worker_heartbeat(timestamp: int) -> None:
    WorkerHeartbeat.objects.update_or_create(id=1, defaults={"beat_at": timezone.now()})
