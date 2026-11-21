from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView

from core.views import HealthView
from telegram_bot.views import TelegramWebhookView

urlpatterns = [
    path("api/health", HealthView.as_view(), name="health"),
    path("api/v1/reference/", include("reference.urls")),
    path("api/v1/", include("accounts.urls")),
    path("api/telegram/webhook/<str:secret>", TelegramWebhookView.as_view(), name="telegram-webhook"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    # Emergency-only superuser access; staff work happens in the separate panel app.
    path("django-admin/", admin.site.urls),
]
