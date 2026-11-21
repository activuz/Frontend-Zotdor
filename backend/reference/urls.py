from django.urls import path

from reference.views import RegionListView, TaxonomyView

urlpatterns = [
    path("regions", RegionListView.as_view(), name="reference-regions"),
    path("taxonomy", TaxonomyView.as_view(), name="reference-taxonomy"),
]
