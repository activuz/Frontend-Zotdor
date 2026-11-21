from django.urls import path

from accounts.views import CsrfView, LoginStartView, LoginStatusView, LogoutView, MeView

urlpatterns = [
    path("auth/csrf", CsrfView.as_view(), name="auth-csrf"),
    path("auth/telegram/start", LoginStartView.as_view(), name="auth-telegram-start"),
    path("auth/telegram/status/<uuid:request_id>", LoginStatusView.as_view(), name="auth-telegram-status"),
    path("auth/logout", LogoutView.as_view(), name="auth-logout"),
    path("me", MeView.as_view(), name="me"),
]
