"""Build reference/data/regions.json from raw OpenStreetMap Overpass exports.

Usage (from backend/):
    python -I reference/scripts/build_regions.py <uz_admin.json> <uz_qr.json>

Inputs are Overpass JSON answers (see reference/data/README.md for the exact
queries). Data © OpenStreetMap contributors, ODbL. Output is reviewed and
committed; the app never calls Overpass at runtime.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

OUT = Path(__file__).resolve().parent.parent / "data" / "regions.json"

# Official order used in Uzbek administrative lists.
REGION_ORDER = [
    "Qoraqalpogʻiston Respublikasi",
    "Andijon viloyati",
    "Buxoro viloyati",
    "Jizzax viloyati",
    "Qashqadaryo viloyati",
    "Navoiy viloyati",
    "Namangan viloyati",
    "Samarqand viloyati",
    "Surxondaryo viloyati",
    "Sirdaryo viloyati",
    "Toshkent viloyati",
    "Fargʻona viloyati",
    "Xorazm viloyati",
    "Toshkent shahri",
]

# Names that OSM spells differently from common Uzbek Latin usage.
# Every entry here should be confirmed by the product owner.
MANUAL_FIXES = {
    "Toshkent": "Toshkent shahri",
    "Bozataw rayonı": "Bozatov tumani",
    "Kegeili tumani": "Kegeyli tumani",
    "Moynoq tumani": "Moʻynoq tumani",
    "Nukus shahri hokimiyati": "Nukus shahri",
    "Angren": "Angren shahri",
    "Bekobod": "Bekobod shahri",
    "Ohangaron": "Ohangaron shahri",
    "Nurafshon (Toytepa)": "Nurafshon shahri",
    "Qoshkopir tumani": "Qoʻshkoʻpir tumani",
}

# OSM boundary overlaps / mistagged objects found during review (2026-11-21).
EXCLUDE = {
    "Toshkent shahri": {"Matbuotchilar koʻchasi", "Yuqorichirchiq tumani"},
}

_APOSTROPHES = "'’‘`ʼʻ"


def normalize(name: str) -> str:
    name = " ".join(name.split())
    # oʻ / gʻ use U+02BB; any other apostrophe is the tutuq belgisi U+02BC.
    name = re.sub(rf"([oOgG])[{_APOSTROPHES}]", "\\1ʻ", name)
    name = re.sub(rf"[{_APOSTROPHES.replace('ʻ', '')}]", "ʼ", name)
    name = re.sub(r"\b(Tumani|Viloyati|Shahri)\b", lambda m: m.group(1).lower(), name)
    return MANUAL_FIXES.get(name, name)


def uz_name(tags: dict[str, str]) -> str:
    return normalize(tags.get("name:uz") or tags.get("name:uz-Latn") or tags["name"])


def collect(elements: list[dict[str, Any]], regions: dict[str, dict[str, Any]]) -> None:
    current: dict[str, Any] | None = None
    for el in elements:
        tags = el.get("tags", {})
        level = tags.get("admin_level")
        center = el.get("center") or {}
        if level in {"3", "4"}:
            name = uz_name(tags)
            current = regions.setdefault(name, {"name": name, "osm_id": el["id"], "districts": []})
        elif level in {"5", "6"} and current is not None:
            current["districts"].append(
                {
                    "name": uz_name(tags),
                    "osm_id": el["id"],
                    "lat": round(center["lat"], 4),
                    "lng": round(center["lon"], 4),
                }
            )


def main(paths: list[str]) -> None:
    regions: dict[str, dict[str, Any]] = {}
    for path in paths:
        collect(json.loads(Path(path).read_text(encoding="utf-8"))["elements"], regions)

    unknown = sorted(set(regions) - set(REGION_ORDER))
    missing = sorted(set(REGION_ORDER) - set(regions))
    if unknown or missing:
        raise SystemExit(f"Region names do not match REGION_ORDER. unknown={unknown} missing={missing}")

    result = []
    for sort, name in enumerate(REGION_ORDER, start=1):
        region = regions[name]
        seen: set[str] = set()
        districts = []
        for d in sorted(region["districts"], key=lambda d: d["name"]):
            if d["name"] in seen or d["name"] in EXCLUDE.get(name, set()):
                continue
            seen.add(d["name"])
            districts.append(d)
        result.append({"name": name, "sort": sort, "osm_id": region["osm_id"], "districts": districts})

    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    total = sum(len(r["districts"]) for r in result)
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
    print(f"wrote {OUT} — {len(result)} regions, {total} districts")


if __name__ == "__main__":
    main(sys.argv[1:])
