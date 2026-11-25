# Sprite atlas catalog

Generated from the two original 1536×1024 PNG atlases. Original PNGs remain unchanged.

## Extraction results

| Atlas | Candidate components | Contact sheets |
|---|---:|---|
| `world_atlas.png` | 274 | [PNG 1](world_contact_01.png) · [2](world_contact_02.png) · [3](world_contact_03.png) · [4](world_contact_04.png) · [5](world_contact_05.png) |
| `file_000000002d208210877c4978b05eaded.png` | 312 | [PNG 1](secondary_contact_01.png) · [2](secondary_contact_02.png) · [3](secondary_contact_03.png) · [4](secondary_contact_04.png) · [5](secondary_contact_05.png) |

Each contact sheet also has a self-contained SVG version (for example, [world sheet 1](world_contact_01.svg)). Enlarged composite crops: [world composites](composite_review_world.png) · [secondary composites](composite_review_secondary.png).

## Coordinate catalog and visual review

- [`atlas_catalog.json`](atlas_catalog.json) — all 586 detected candidates, source rectangles, pixel areas and segmentation diagnostics
- [`visual-review.json`](visual-review.json) — 129 manually classified candidates with labels, categories, confidence and source coordinates
- [`build_catalog.py`](../../../tools/sprite_catalog/build_catalog.py) — reproducible extraction and contact-sheet generator

## Runtime integration

The game renderer's sprite coordinates were corrected against the visual contact sheets in `js/render/sprite-assets.js`. Cache version was bumped to **v0.18.1**.

The corrected map uses tight foreground bounds for recognizable trees, rocks, houses, farm plots, windmill, mine entrance, market stall, ship and castle. Existing game logic and building placement rules were not changed.

## Important limitations

The 586 entries are *candidate connected components*, not 586 guaranteed independent sprites. Some entries are composite sheets, touching objects, or fragments. The segmentation estimates the backdrop from the four image corners and selects a color-distance threshold per atlas. Every coordinate is relative to the original PNG; source pixels are not modified.

The 129 labels are a manually reviewed subset. Enlarged composite sheets make multi-object regions easier to inspect. Composite sheets must be sliced into individual sprites before they can be used as independent map objects. Unreviewed candidates remain unclassified. Two construction-stage crops remain explicitly marked for manual review in runtime-mapping.json. Android runtime rendering has not yet been tested after the coordinate update, so the next check is to inspect the updated game on the phone for crop accuracy, sprite scale, and any visual regressions.
