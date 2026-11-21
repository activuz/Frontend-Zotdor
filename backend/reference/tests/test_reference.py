from __future__ import annotations

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from reference.models import AnimalType, Breed, District, Region

pytestmark = pytest.mark.django_db


def test_load_reference_is_idempotent_and_keeps_staff_edits(load_reference_data: None) -> None:
    counts = (Region.objects.count(), District.objects.count(), Breed.objects.count())
    assert counts[0] == 14
    renamed = Breed.objects.get(animal_type__slug="qoramol", name="Golshtin")
    renamed.name = "Golshteyn"
    renamed.save()
    Breed.objects.filter(animal_type__slug="qoy", name="Romanov").delete()

    call_command("load_reference", verbosity=0)

    assert not Breed.objects.filter(animal_type__slug="qoramol", name="Golshtin").exists()
    assert not Breed.objects.filter(animal_type__slug="qoy", name="Romanov").exists()
    assert (Region.objects.count(), District.objects.count(), Breed.objects.count()) == (
        counts[0],
        counts[1],
        counts[2] - 1,
    )


def test_names_use_official_apostrophes(load_reference_data: None) -> None:
    names = list(District.objects.values_list("name", flat=True))
    names += list(Region.objects.values_list("name", flat=True))
    assert not [n for n in names if "'" in n or "’" in n]
    assert Region.objects.filter(name="Qoraqalpogʻiston Respublikasi").exists()


def test_regions_endpoint_is_public_and_nested(load_reference_data: None) -> None:
    response = APIClient().get("/api/v1/reference/regions")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 14
    assert data[0]["name"] == "Qoraqalpogʻiston Respublikasi"
    assert all(r["districts"] for r in data)
    assert "max-age" in response["Cache-Control"]


def test_taxonomy_hides_inactive_rows(load_reference_data: None) -> None:
    AnimalType.objects.filter(slug="mushuk").update(is_active=False)
    Breed.objects.filter(animal_type__slug="qoramol", name="Gereford").update(is_active=False)

    data = APIClient().get("/api/v1/reference/taxonomy").json()
    slugs = [t["slug"] for t in data["animal_types"]]
    assert "mushuk" not in slugs
    qoramol = next(t for t in data["animal_types"] if t["slug"] == "qoramol")
    assert "Gereford" not in [b["name"] for b in qoramol["breeds"]]
    assert {c["name"] for c in qoramol["classes"]} >= {"Buzoq", "Sigir", "Buqa"}
    assert len(data["directions"]) == 5
