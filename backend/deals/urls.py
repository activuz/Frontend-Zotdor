from django.urls import path

from deals import views

urlpatterns = [
    path("me/deals", views.MyDealsView.as_view(), name="my-deals"),
    path("deals/<uuid:deal_id>", views.DealDetailView.as_view(), name="deal-detail"),
    path("deals/<uuid:deal_id>/rating", views.RatingView.as_view(), name="deal-rating"),
    path("deals/<uuid:deal_id>/claims", views.ClaimView.as_view(), name="deal-claims"),
]
