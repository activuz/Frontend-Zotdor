from django.urls import path

from seo import views

# Mounted at /api/seo/ (config/urls.py). web.zotdor.uz proxies /sitemap.xml and bot previews here.
urlpatterns = [
    path("sitemap.xml", views.sitemap_xml, name="seo-sitemap"),
    path("a/<uuid:auction_id>", views.auction_share, name="seo-auction"),
]
