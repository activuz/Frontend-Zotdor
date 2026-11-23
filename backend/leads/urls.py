from django.urls import path

from leads.views import LeadCreateView

urlpatterns = [
    path("leads", LeadCreateView.as_view(), name="leads"),
]
