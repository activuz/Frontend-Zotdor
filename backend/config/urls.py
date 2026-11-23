from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView

from core.views import HealthView, PublicConfigView
from payments.urls import click_urlpatterns
from telegram_bot.views import TelegramWebhookView

urlpatterns = [
    path("api/health", HealthView.as_view(), name="health"),
    path("api/v1/config", PublicConfigView.as_view(), name="public-config"),
    path("api/v1/reference/", include("reference.urls")),
    path("api/v1/", include("accounts.urls")),
    path("api/v1/", include("wallet.urls")),
    path("api/v1/", include("payments.urls")),
    path("api/v1/", include("notifications.urls")),
    path("api/v1/", include("auctions.urls")),
    path("api/v1/", include("deals.urls")),
    path("api/v1/", include("moderation.urls")),
    path("api/panel/", include("panel_api.urls")),
    path("api/payments/click/", include(click_urlpatterns)),
    path("api/telegram/webhook/<str:secret>", TelegramWebhookView.as_view(), name="telegram-webhook"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    # Emergency-only superuser access; staff work happens in the separate panel app.
    path("django-admin/", admin.site.urls),
]

if settings.DEBUG:
    # In production nginx serves /media/ directly (docs/ARCHITECTURE.md §8).
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
