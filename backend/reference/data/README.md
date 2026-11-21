# Reference data sources

## regions.json

Regions and districts of Uzbekistan with district centroid coordinates (used only for
distance between buyer and seller, never shown as an address).

- Source: OpenStreetMap via the Overpass API, downloaded 2026-11-21.
  Data © OpenStreetMap contributors, licensed under ODbL — keep this attribution.
- Built by `reference/scripts/build_regions.py`, which normalizes spelling to the official
  Uzbek Latin apostrophes (oʻ, gʻ, ʼ) and applies `MANUAL_FIXES` / `EXCLUDE`. Those two lists
  record every hand correction and should be confirmed by the product owner.
- Known gaps: OSM has no separate boundaries for some cities (e.g. Urganch shahri, Xiva shahri).
  Add them in the staff panel; `load_reference` never overwrites panel edits.

Overpass queries used (save each answer as JSON, then run the script with both files):

```
[out:json][timeout:240];
area["ISO3166-1"="UZ"][admin_level=2]->.uz;
rel(area.uz)[boundary=administrative][admin_level=4]->.regs;
foreach.regs->.r(.r out tags center; .r map_to_area->.a;
  rel(area.a)[boundary=administrative][admin_level=6]; out tags center;);
```

```
[out:json][timeout:240];
area["ISO3166-1"="UZ"][admin_level=2]->.uz;
rel(area.uz)[boundary=administrative]["ISO3166-2"="UZ-QR"]->.r;
.r out tags center; .r map_to_area->.a;
rel(area.a)[boundary=administrative][admin_level~"^(5|6)$"]; out tags center;
```

## taxonomy.py

Initial directions, animal types, sex-age classes and breeds from `docs/TAXONOMY_DRAFT.md`
as edited by the product owner. Seeds only; staff manage the live list in the panel.
