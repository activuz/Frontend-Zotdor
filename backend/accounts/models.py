"""User model (docs/DATABASE.md, "users").

Created in phase 0 because Django requires the custom user model before the
first migration. Region/district FKs, rating counters and Telegram login are
added in phase 1.
"""

from __future__ import annotations

import uuid
from typing import Any, ClassVar

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.validators import RegexValidator
from django.db import models

phone_validator = RegexValidator(r"^\+998\d{9}$", "Telefon raqami +998XXXXXXXXX koʻrinishida boʻlishi kerak.")


class UserManager(BaseUserManager["User"]):
    def create_user(self, phone: str, **extra: Any) -> User:
        user = self.model(phone=phone, **extra)
        user.set_unusable_password()  # regular users log in via Telegram only
        user.full_clean(exclude=["password"])
        user.save(using=self._db)
        return user

    def create_superuser(self, phone: str, password: str | None = None, **extra: Any) -> User:
        """Emergency Django-admin account. Not a product role."""
        user = self.model(phone=phone, role=User.Role.ADMIN, is_staff=True, is_superuser=True, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        USER = "user", "Foydalanuvchi"
        MODERATOR = "moderator", "Moderator"
        ADMIN = "admin", "Admin"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    phone = models.CharField(max_length=13, unique=True, validators=[phone_validator])
    telegram_user_id = models.BigIntegerField(unique=True, null=True, blank=True)
    telegram_username = models.CharField(max_length=64, blank=True)
    first_name = models.CharField(max_length=64, blank=True)
    last_name = models.CharField(max_length=64, blank=True)
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.USER)
    region = models.ForeignKey("reference.Region", on_delete=models.PROTECT, null=True, blank=True)
    district = models.ForeignKey("reference.District", on_delete=models.PROTECT, null=True, blank=True)
    # Optional, rounded to ~10 m; only used for distance sorting (docs/ARCHITECTURE.md D-10).
    lat = models.DecimalField(max_digits=7, decimal_places=4, null=True, blank=True)
    lng = models.DecimalField(max_digits=7, decimal_places=4, null=True, blank=True)
    rating_avg = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    rating_count = models.PositiveIntegerField(default=0)
    deals_count = models.PositiveIntegerField(default=0)
    is_blocked = models.BooleanField(default=False)
    blocked_reason = models.TextField(blank=True)
    # Django admin access only (emergency superuser); product staff use `role`.
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "phone"
    REQUIRED_FIELDS: ClassVar[list[str]] = []

    class Meta:
        db_table = "users"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(role__in=["user", "moderator", "admin"]), name="users_role_valid"
            ),
        ]

    def __str__(self) -> str:
        return self.phone

    @property
    def is_moderator_or_admin(self) -> bool:
        return self.role in {self.Role.MODERATOR, self.Role.ADMIN}

    @property
    def needs_profile(self) -> bool:
        return not (self.first_name and self.region_id and self.district_id)


class LoginRequest(models.Model):
    """One Telegram login attempt (docs/ARCHITECTURE.md §6). Only hashes of secrets are stored."""

    class Status(models.TextChoices):
        PENDING = "pending"
        VERIFIED = "verified"
        FAILED = "failed"
        CONSUMED = "consumed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    phone = models.CharField(max_length=13, validators=[phone_validator])
    token_hash = models.CharField(max_length=64, unique=True)
    poll_secret_hash = models.CharField(max_length=64)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    fail_reason = models.CharField(max_length=32, blank=True)
    telegram_user_id = models.BigIntegerField(null=True, blank=True)
    telegram_username = models.CharField(max_length=64, blank=True)
    telegram_first_name = models.CharField(max_length=64, blank=True)
    telegram_last_name = models.CharField(max_length=64, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    # Where the login started: the bot's "back" button must reopen that place, because only
    # it holds the poll cookie (web = the browser, app = the Android app, FR-21).
    client = models.CharField(max_length=8, default="web")
    expires_at = models.DateTimeField()
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "login_requests"
        indexes = [
            models.Index(fields=["phone", "created_at"]),
            models.Index(fields=["ip", "created_at"]),
            models.Index(fields=["telegram_user_id", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.phone} {self.status}"
