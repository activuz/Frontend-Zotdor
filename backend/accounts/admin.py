from django.contrib import admin

from accounts.models import User


@admin.register(User)
class UserAdmin(admin.ModelAdmin[User]):
    list_display = ("phone", "first_name", "last_name", "role", "is_blocked", "created_at")
    list_filter = ("role", "is_blocked")
    search_fields = ("phone", "first_name", "last_name", "telegram_username")
    readonly_fields = ("id", "created_at", "last_seen_at", "password")
