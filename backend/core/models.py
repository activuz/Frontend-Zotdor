from __future__ import annotations

from django.db import models


class PlatformSettings(models.Model):
    """Single-row business settings (docs/DATABASE.md "platform_settings"), edited by admins.

    Values are copied onto auctions when they are published, so a change never affects
    auctions that are already running.
    """

    id = models.PositiveSmallIntegerField(primary_key=True, default=1)
    commission_rate_bp = models.PositiveSmallIntegerField(default=20, help_text="20 = 0.2%")
    signup_bonus = models.PositiveIntegerField(default=50_000)
    bonus_ttl_days = models.PositiveSmallIntegerField(default=90)
    min_bid_pct = models.PositiveSmallIntegerField(default=50)
    max_bid_pct = models.PositiveSmallIntegerField(default=300)
    min_duration_min = models.PositiveSmallIntegerField(default=10)
    max_duration_min = models.PositiveSmallIntegerField(default=720)
    max_schedule_ahead_days = models.PositiveSmallIntegerField(default=7)
    decision_window_h = models.PositiveSmallIntegerField(default=48)
    early_accept_min_minutes = models.PositiveSmallIntegerField(default=10)
    claim_window_days = models.PositiveSmallIntegerField(default=7)
    rating_window_days = models.PositiveSmallIntegerField(default=14)
    photos_min = models.PositiveSmallIntegerField(default=4)
    photos_max = models.PositiveSmallIntegerField(default=10)
    videos_min = models.PositiveSmallIntegerField(default=1)
    videos_max = models.PositiveSmallIntegerField(default=2)
    video_max_s = models.PositiveSmallIntegerField(default=30)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "platform_settings"
        constraints = [models.CheckConstraint(condition=models.Q(id=1), name="platform_settings_single_row")]

    def __str__(self) -> str:
        return "Platform settings"

    @classmethod
    def load(cls) -> PlatformSettings:
        obj, _ = cls.objects.get_or_create(id=1)
        return obj


class WorkerHeartbeat(models.Model):
    """Single row updated by the periodic worker task; read by /api/health."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1)
    beat_at = models.DateTimeField()

    def __str__(self) -> str:
        return f"worker heartbeat at {self.beat_at.isoformat()}"
