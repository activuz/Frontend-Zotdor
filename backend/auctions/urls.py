from django.urls import path

from auctions import views

urlpatterns = [
    path("auctions", views.AuctionListView.as_view(), name="auctions"),
    path("auctions/<uuid:auction_id>", views.AuctionDetailView.as_view(), name="auction-detail"),
    path("auctions/<uuid:auction_id>/submit", views.SubmitView.as_view(), name="auction-submit"),
    path("auctions/<uuid:auction_id>/cancel", views.CancelView.as_view(), name="auction-cancel"),
    path("auctions/<uuid:auction_id>/media", views.MediaUploadView.as_view(), name="auction-media"),
    path(
        "auctions/<uuid:auction_id>/media/order", views.MediaOrderView.as_view(), name="auction-media-order"
    ),
    path(
        "auctions/<uuid:auction_id>/media/<uuid:media_id>",
        views.MediaDeleteView.as_view(),
        name="auction-media-delete",
    ),
    path("auctions/<uuid:auction_id>/bids", views.BidsView.as_view(), name="auction-bids"),
    path("auctions/<uuid:auction_id>/decision", views.DecisionView.as_view(), name="auction-decision"),
    path("auctions/<uuid:auction_id>/accept", views.AcceptView.as_view(), name="auction-accept"),
    path("auctions/<uuid:auction_id>/reject-all", views.RejectAllView.as_view(), name="auction-reject-all"),
    path("auctions/<uuid:auction_id>/watch", views.WatchView.as_view(), name="auction-watch"),
    path("media/capture-sessions", views.CaptureSessionView.as_view(), name="capture-sessions"),
    path("me/auctions", views.MyAuctionsView.as_view(), name="my-auctions"),
    path("me/bids", views.MyBidsView.as_view(), name="my-bids"),
    path("me/watchlist", views.WatchlistView.as_view(), name="my-watchlist"),
]
