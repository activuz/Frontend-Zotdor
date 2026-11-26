from django.urls import path

from notifications.views import (
    DeviceView,
    MarkReadView,
    NotificationListView,
    PushPublicKeyView,
    PushSubscriptionView,
    UnreadCountView,
)

urlpatterns = [
    path("push/public-key", PushPublicKeyView.as_view(), name="push-public-key"),
    path("me/push-subscriptions", PushSubscriptionView.as_view(), name="push-subscriptions"),
    path("me/devices", DeviceView.as_view(), name="devices"),
    path("notifications", NotificationListView.as_view(), name="notifications"),
    path("notifications/unread-count", UnreadCountView.as_view(), name="notifications-unread"),
    path("notifications/read", MarkReadView.as_view(), name="notifications-read"),
]
