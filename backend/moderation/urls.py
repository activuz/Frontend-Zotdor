from django.urls import path

from moderation.views import PublicProfileView, ReportView

urlpatterns = [
    path("reports", ReportView.as_view(), name="reports"),
    path("users/<uuid:user_id>", PublicProfileView.as_view(), name="public-profile"),
]
