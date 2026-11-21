"""Seed reference data. Idempotent: creates missing rows and never deletes or renames
rows that staff may have edited in the panel."""

from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from reference.data.taxonomy import ANIMAL_TYPES, DIRECTIONS
from reference.models import AnimalClass, AnimalType, Breed, Direction, District, Region

REGIONS_FILE = Path(__file__).resolve().parents[2] / "data" / "regions.json"


class Command(BaseCommand):
    help = "Load regions/districts and the initial animal taxonomy (safe to re-run)."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        created = {"region": 0, "district": 0, "direction": 0, "type": 0, "class": 0, "breed": 0}

        for item in json.loads(REGIONS_FILE.read_text(encoding="utf-8")):
            region, is_new = Region.objects.get_or_create(
                osm_id=item["osm_id"], defaults={"name": item["name"], "sort": item["sort"]}
            )
            created["region"] += is_new
            for d in item["districts"]:
                _, is_new = District.objects.get_or_create(
                    osm_id=d["osm_id"],
                    defaults={
                        "region": region,
                        "name": d["name"],
                        "lat": Decimal(str(d["lat"])),
                        "lng": Decimal(str(d["lng"])),
                    },
                )
                created["district"] += is_new

        directions: dict[str, Direction] = {}
        for sort, (slug, name) in enumerate(DIRECTIONS, start=1):
            directions[slug], is_new = Direction.objects.get_or_create(
                slug=slug, defaults={"name": name, "sort": sort}
            )
            created["direction"] += is_new

        for t_sort, seed in enumerate(ANIMAL_TYPES, start=1):
            animal_type, is_new = AnimalType.objects.get_or_create(
                slug=seed.slug, defaults={"name": seed.name, "sort": t_sort}
            )
            created["type"] += is_new
            if not is_new:
                # Staff own this type's classes/breeds once it exists; re-seeding would
                # resurrect names they renamed or deleted.
                continue
            animal_type.directions.set([directions[s] for s in seed.directions])
            for c_sort, cls in enumerate(seed.classes, start=1):
                _, is_new = AnimalClass.objects.get_or_create(
                    animal_type=animal_type,
                    name=cls.name,
                    defaults={"sex": cls.sex, "age_hint": cls.age_hint, "sort": c_sort},
                )
                created["class"] += is_new
            for b_sort, breed in enumerate(seed.breeds, start=1):
                _, is_new = Breed.objects.get_or_create(
                    animal_type=animal_type, name=breed, defaults={"sort": b_sort}
                )
                created["breed"] += is_new

        summary = ", ".join(f"{k}: +{v}" for k, v in created.items())
        self.stdout.write(self.style.SUCCESS(f"Reference data loaded ({summary})"))
