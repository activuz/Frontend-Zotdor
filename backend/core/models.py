from django.db import models


class WorkerHeartbeat(models.Model):
    """Single row updated by the periodic worker task; read by /api/health."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1)
    beat_at = models.DateTimeField()

    def __str__(self) -> str:
        return f"worker heartbeat at {self.beat_at.isoformat()}"
