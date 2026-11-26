"""In-app notifications and the Telegram outbox (docs/DATABASE.md "notifications")."""

from __future__ import annotations

from django.conf import settings
from django.db import models


class Notification(models.Model):
    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    type = models.CharField(max_length=40)
    title = models.CharField(max_length=160)
    body = models.TextField(blank=True)
    link = models.CharField(max_length=200, blank=True)  # in-app path, e.g. /a/<id>
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notifications"
        indexes = [models.Index(fields=["user", "read_at", "-created_at"])]

    def __str__(self) -> str:
        return f"{self.type} → {self.user_id}"


class TelegramOutbox(models.Model):
    """Messages are queued in the DB and sent by the worker, never inside a request transaction."""

    class Status(models.TextChoices):
        PENDING = "pending"
        SENT = "sent"
        FAILED = "failed"

    id = models.BigAutoField(primary_key=True)
    chat_id = models.BigIntegerField()
    text = models.TextField()
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.PENDING)
    attempts = models.PositiveSmallIntegerField(default=0)
    next_attempt_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "telegram_outbox"
        indexes = [models.Index(fields=["status", "next_attempt_at"])]

    def __str__(self) -> str:
        return f"outbox {self.id} {self.status}"


class PushSubscription(models.Model):
    """One browser or installed app that receives Web Push (FR-20), identified by its endpoint."""

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="push_subscriptions"
    )
    endpoint = models.CharField(max_length=1000, unique=True)
    p256dh = models.CharField(max_length=200)
    auth = models.CharField(max_length=100)
    user_agent = models.CharField(max_length=300, blank=True)
    failures = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "push_subscriptions"

    def __str__(self) -> str:
        return f"push → {self.user_id}"


class DeviceToken(models.Model):
    """A Firebase Cloud Messaging token of the Android app (FR-21): one per installed app."""

    class Platform(models.TextChoices):
        ANDROID = "android"

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="device_tokens")
    token = models.CharField(max_length=500, unique=True)
    platform = models.CharField(max_length=10, choices=Platform.choices)
    app_version = models.CharField(max_length=20, blank=True)
    failures = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "device_tokens"

    def __str__(self) -> str:
        return f"{self.platform} → {self.user_id}"


class SentReminder(models.Model):  # noqa: DJ008 - internal table, not shown in admin
    """One row per reminder already sent, so a periodic job never repeats it (F8)."""

    key = models.CharField(max_length=120, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "sent_reminders"
