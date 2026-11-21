from django.urls import path

from payments import views

urlpatterns = [
    path("wallet/topups", views.TopupView.as_view(), name="wallet-topups"),
    path("wallet/refund-requests", views.RefundRequestsView.as_view(), name="wallet-refund-requests"),
    path("payments/<uuid:payment_id>", views.PaymentDetailView.as_view(), name="payment-detail"),
    path(
        "payments/fake/<uuid:payment_id>/complete",
        views.FakeCompleteView.as_view(),
        name="payment-fake-complete",
    ),
]

click_urlpatterns = [
    path("prepare", views.ClickPrepareView.as_view(), name="click-prepare"),
    path("complete", views.ClickCompleteView.as_view(), name="click-complete"),
]
