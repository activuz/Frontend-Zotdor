from django.urls import include, path
from rest_framework.routers import SimpleRouter

from panel_api import views

router = SimpleRouter(trailing_slash=False)
router.register("taxonomy/directions", views.DirectionViewSet, basename="panel-directions")
router.register("taxonomy/animal-types", views.AnimalTypeViewSet, basename="panel-animal-types")
router.register("taxonomy/classes", views.AnimalClassViewSet, basename="panel-classes")
router.register("taxonomy/breeds", views.BreedViewSet, basename="panel-breeds")
router.register("districts", views.DistrictViewSet, basename="panel-districts")

urlpatterns = [
    path("stats", views.StatsView.as_view()),
    path("auctions", views.AuctionQueueView.as_view()),
    path("auctions/<uuid:auction_id>", views.AuctionPanelDetailView.as_view()),
    path("auctions/<uuid:auction_id>/<str:action>", views.AuctionActionView.as_view()),
    path("reports", views.ReportListView.as_view()),
    path("reports/<uuid:report_id>/resolve", views.ReportResolveView.as_view()),
    path("leads", views.LeadListView.as_view()),
    path("leads/<uuid:lead_id>/status", views.LeadStatusView.as_view()),
    path("bug-reports", views.BugReportListView.as_view()),
    path("bug-reports/<uuid:report_id>/status", views.BugReportStatusView.as_view()),
    path("claims", views.ClaimListView.as_view()),
    path("claims/<uuid:claim_id>/resolve", views.ClaimResolveView.as_view()),
    path("refund-requests", views.RefundListView.as_view()),
    path("refund-requests/<uuid:refund_id>/resolve", views.RefundResolveView.as_view()),
    path("users", views.UserListView.as_view()),
    path("users/<uuid:user_id>", views.UserDetailView.as_view()),
    path("users/<uuid:user_id>/block", views.UserBlockView.as_view()),
    path("users/<uuid:user_id>/role", views.UserRoleView.as_view()),
    path("users/<uuid:user_id>/wallet/adjust", views.WalletAdjustView.as_view()),
    path("settings", views.SettingsView.as_view()),
    path("audit-log", views.AuditLogView.as_view()),
    path("", include(router.urls)),
]
