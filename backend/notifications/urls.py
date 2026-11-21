from django.urls import path

from notifications.views import MarkReadView, NotificationListView, UnreadCountView

urlpatterns = [
    path("notifications", NotificationListView.as_view(), name="notifications"),
    path("notifications/unread-count", UnreadCountView.as_view(), name="notifications-unread"),
    path("notifications/read", MarkReadView.as_view(), name="notifications-read"),
]
