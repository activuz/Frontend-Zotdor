"""Reference data (docs/DATABASE.md, "reference"). Editable later from the staff panel."""

from __future__ import annotations

from django.db import models


class Region(models.Model):
    id = models.SmallAutoField(primary_key=True)
    name = models.CharField(max_length=64, unique=True)
    sort = models.PositiveSmallIntegerField(default=0)
    osm_id = models.BigIntegerField(unique=True, null=True, blank=True)

    class Meta:
        ordering = ["sort", "name"]

    def __str__(self) -> str:
        return self.name


class District(models.Model):
    """A tuman or a city with district status. lat/lng is the OSM centroid, used for distance."""

    id = models.AutoField(primary_key=True)
    region = models.ForeignKey(Region, on_delete=models.PROTECT, related_name="districts")
    name = models.CharField(max_length=64)
    lat = models.DecimalField(max_digits=7, decimal_places=4)
    lng = models.DecimalField(max_digits=7, decimal_places=4)
    osm_id = models.BigIntegerField(unique=True, null=True, blank=True)

    class Meta:
        ordering = ["region__sort", "name"]
        constraints = [
            models.UniqueConstraint(fields=["region", "name"], name="district_unique_name_in_region"),
        ]

    def __str__(self) -> str:
        return self.name


class Direction(models.Model):
    id = models.SmallAutoField(primary_key=True)
    slug = models.SlugField(max_length=32, unique=True)
    name = models.CharField(max_length=64)
    sort = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort"]

    def __str__(self) -> str:
        return self.name


class AnimalType(models.Model):
    id = models.SmallAutoField(primary_key=True)
    slug = models.SlugField(max_length=32, unique=True)
    name = models.CharField(max_length=64)
    sort = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    directions = models.ManyToManyField(Direction, related_name="animal_types")

    class Meta:
        ordering = ["sort"]

    def __str__(self) -> str:
        return self.name


class AnimalClass(models.Model):
    """Sex-age class, e.g. buzoq, gʻunajin, sigir for qoramol."""

    class Sex(models.TextChoices):
        MALE = "male", "Erkak"
        FEMALE = "female", "Urgʻochi"
        ANY = "any", "Har ikkisi"

    id = models.SmallAutoField(primary_key=True)
    animal_type = models.ForeignKey(AnimalType, on_delete=models.PROTECT, related_name="classes")
    name = models.CharField(max_length=64)
    sex = models.CharField(max_length=8, choices=Sex.choices)
    age_hint = models.CharField(max_length=64, blank=True)
    sort = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["animal_type__sort", "sort"]
        constraints = [
            models.UniqueConstraint(fields=["animal_type", "name"], name="class_unique_name_per_type"),
        ]

    def __str__(self) -> str:
        return f"{self.animal_type.name} · {self.name}"


class Breed(models.Model):
    id = models.SmallAutoField(primary_key=True)
    animal_type = models.ForeignKey(AnimalType, on_delete=models.PROTECT, related_name="breeds")
    name = models.CharField(max_length=64)
    sort = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["animal_type__sort", "sort"]
        constraints = [
            models.UniqueConstraint(fields=["animal_type", "name"], name="breed_unique_name_per_type"),
        ]

    def __str__(self) -> str:
        return f"{self.animal_type.name} · {self.name}"
