"""Initial taxonomy, transcribed from docs/TAXONOMY_DRAFT.md as edited by the product owner
(2026-11-21). After the first load, staff edit it in the panel; this file only seeds empty
databases and adds missing rows — it never deletes or renames what staff changed.
"""

from __future__ import annotations

from typing import NamedTuple


class ClassSeed(NamedTuple):
    name: str
    sex: str  # male | female | any
    age_hint: str = ""


class TypeSeed(NamedTuple):
    slug: str
    name: str
    directions: tuple[str, ...]
    classes: tuple[ClassSeed, ...]
    breeds: tuple[str, ...]


DIRECTIONS: tuple[tuple[str, str], ...] = (
    ("gosht", "Goʻsht"),
    ("sut-tuxum", "Sut-tuxum"),
    ("korkam", "Koʻrkam / manzarali"),
    ("sport-transport", "Sport va transport"),
    ("pet", "Uy hayvonlari"),
)

M, F, A = "male", "female", "any"


def _sexed(young: str, female: str, male: str, young_age: str = "") -> tuple[ClassSeed, ...]:
    return (ClassSeed(young, A, young_age), ClassSeed(female, F), ClassSeed(male, M))


ANIMAL_TYPES: tuple[TypeSeed, ...] = (
    TypeSeed(
        "qoramol",
        "Qoramol",
        ("gosht", "sut-tuxum"),
        (
            ClassSeed("Buzoq", A, "0–12 oy"),
            ClassSeed("Novvos", M, "1–2 yil"),
            ClassSeed("Tana", F, "6–15 oy"),
            ClassSeed("Gʻunajin", F, "15 oydan birinchi tugʻishgacha"),
            ClassSeed("Sigir", F, "tuqqan"),
            ClassSeed("Buqa", M, "2 yildan katta, naslli"),
            ClassSeed("Hoʻkiz", M, "2 yildan katta, bichilgan"),
        ),
        (
            "Oddiy",
            "Golshtin",
            "Simmental",
            "Shvits",
            "Qizil dasht",
            "Aberdin-angus",
            "Gereford",
            "Bushuyev",
            "Jaydari (mahalliy)",
        ),
    ),
    TypeSeed(
        "qoy",
        "Qoʻy",
        ("gosht",),
        (
            ClassSeed("Qoʻzi", A, "0–6 oy"),
            ClassSeed("Toʻqli", A, "6–18 oy"),
            ClassSeed("Sovliq", F, "tuqqan"),
            ClassSeed("Qoʻchqor", M, "naslli"),
            ClassSeed("Axta", M, "bichilgan"),
        ),
        ("Oddiy", "Hisori", "Qorakoʻl", "Jaydari", "Edilbay", "Romanov", "Chuvalang"),
    ),
    TypeSeed(
        "echki",
        "Echki",
        ("gosht", "sut-tuxum"),
        (
            ClassSeed("Uloq", A, "0–6 oy"),
            ClassSeed("Echki", F),
            ClassSeed("Taka", M),
            ClassSeed("Serka", M, "bichilgan"),
        ),
        ("Oddiy", "Zaanen", "Nubiy", "Angora", "Alpiy"),
    ),
    TypeSeed(
        "ot",
        "Ot",
        ("gosht", "sut-tuxum", "korkam", "sport-transport"),
        (
            ClassSeed("Qulun", A, "0–1 yil"),
            ClassSeed("Toy", A, "1–3 yil"),
            ClassSeed("Biya", F, "3 yildan katta"),
            ClassSeed("Aygʻir", M, "3 yildan katta, naslli"),
            ClassSeed("Axta", M, "3 yildan katta, bichilgan"),
        ),
        ("Oddiy", "Qorabayir", "Laqay", "Axaltaka", "Arab", "Don"),
    ),
    TypeSeed(
        "tuya",
        "Tuya",
        ("gosht", "sut-tuxum", "sport-transport"),
        (ClassSeed("Boʻtaloq", A, "0–1 yil"), ClassSeed("Moya", F), ClassSeed("Nor", M)),
        ("Oddiy", "Baqtriyan (ikki oʻrkachli)", "Dromedar (bir oʻrkachli)"),
    ),
    TypeSeed(
        "tovuq",
        "Tovuq",
        ("gosht", "sut-tuxum", "korkam"),
        _sexed("Joʻja", "Tovuq", "Xoʻroz", "0–2 oy"),
        ("Oddiy", "Dakan", "Broyler", "Brama", "Kuchinskiy", "Orpington", "Yaponka"),
    ),
    TypeSeed(
        "kurka",
        "Kurka",
        ("gosht",),
        _sexed("Joʻja", "Moda", "Nar", "0–2 oy"),
        ("Oddiy", "Bronza keng koʻkrakli", "Oq keng koʻkrakli", "BIG-6"),
    ),
    TypeSeed(
        "ordak",
        "Oʻrdak",
        ("gosht", "sut-tuxum"),
        _sexed("Oʻrdakcha", "Moda", "Nar", "0–2 oy"),
        ("Oddiy", "Pekin", "Mulard", "Muskus (indo-oʻrdak)", "Bashqird"),
    ),
    TypeSeed(
        "goz",
        "Gʻoz",
        ("gosht",),
        _sexed("Joʻja", "Moda", "Nar", "0–2 oy"),
        ("Oddiy", "Xolmogor", "Landa", "Tuluza", "Linda"),
    ),
    TypeSeed(
        "bedana",
        "Bedana",
        ("gosht", "sut-tuxum", "pet"),
        _sexed("Joʻja", "Moda", "Nar", "0–1 oy"),
        ("Oddiy", "Yapon", "Faraon", "Texas oq", "Estoniya"),
    ),
    TypeSeed(
        "kaptar",
        "Kaptar",
        ("gosht", "korkam", "pet"),
        _sexed("Polapon", "Moda", "Nar"),
        ("Oddiy", "Buxoro", "Andijon", "Oʻzbek ikki kokilli"),
    ),
    TypeSeed(
        "tovus",
        "Tovus",
        ("korkam",),
        (ClassSeed("Moda", F), ClassSeed("Nar", M)),
        ("Oddiy (koʻk)", "Oq", "Yashil"),
    ),
    TypeSeed(
        "quyon",
        "Quyon",
        ("gosht", "korkam", "pet"),
        _sexed("Quyonbachcha", "Urgʻochi", "Erkak", "0–3 oy"),
        ("Oddiy", "Kaliforniya", "Oq gigant", "Kulrang gigant", "Shinshilla", "Reks"),
    ),
    TypeSeed(
        "it",
        "It",
        ("pet",),
        _sexed("Kuchuk", "Urgʻochi", "Erkak", "0–12 oy"),
        ("Oddiy", "Gurji", "Alabay", "Apchakla"),
    ),
    TypeSeed(
        "mushuk",
        "Mushuk",
        ("pet",),
        _sexed("Mushukcha", "Urgʻochi", "Erkak", "0–12 oy"),
        ("Oddiy", "Britaniya", "Shotlandiya", "Fors", "Sfinks"),
    ),
)
