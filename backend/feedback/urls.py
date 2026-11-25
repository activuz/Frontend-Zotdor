from django.urls import path

from feedback.views import BugReportCreateView

urlpatterns = [
    path("bug-reports", BugReportCreateView.as_view(), name="bug-reports"),
]
