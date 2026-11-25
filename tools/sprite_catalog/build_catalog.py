#!/usr/bin/env python3
"""Build a diagnostic, coordinate-preserving catalog for the two sprite atlases.

This intentionally does not guess sprite names or remove background pixels.
All coordinates refer to the original 1536x1024 PNG files.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets" / "sprites" / "catalog"
OUT.mkdir(parents=True, exist_ok=True)

SOURCES = [
    ("world", ROOT / "assets/sprites/world_atlas.png"),
    ("secondary", ROOT / "assets/sprites/file_000000002d208210877c4978b05eaded.png"),
]
MIN_AREA = 80
THRESHOLD = 15
CELL_W, CELL_H = 144, 132
COLUMNS = 8


def catalog_one(name: str, path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(path)
    image = Image.open(path).convert("RGB")
    arr = np.asarray(image)
    # Treat near-black as background for candidate detection only. Source pixels
    # are never modified, and every bbox is a crop from the untouched source.
    mask = np.max(arr, axis=2) > THRESHOLD
    labels, count = ndimage.label(mask, structure=np.ones((3, 3), dtype=np.uint8))
    objects = ndimage.find_objects(labels)
    entries = []
    for label_id, slc in enumerate(objects, start=1):
        if slc is None:
            continue
        y0, y1 = slc[0].start, slc[0].stop
        x0, x1 = slc[1].start, slc[1].stop
        region = labels[slc] == label_id
        area = int(region.sum())
        if area < MIN_AREA:
            continue
        w, h = x1 - x0, y1 - y0
        bbox_area = w * h
        fill_ratio = round(area / bbox_area, 4) if bbox_area else 0
        entries.append({
            "id": f"{name}_{len(entries):04d}",
            "source": path.name,
            "bbox": {"x": x0, "y": y0, "width": w, "height": h},
            "pixel_area": area,
            "bbox_fill_ratio": fill_ratio,
            "review_flags": (
                ["sparse_or_irregular_component"] if fill_ratio < 0.18 else []
            ) + (
                ["large_component_review"] if bbox_area > 30000 else []
            ),
            "label": "unclassified",
        })

    # Diagnostic contact sheets: nearest-neighbour previews with stable IDs.
    font = ImageFont.load_default()
    per_page = 64
    pages = []
    for page_index in range((len(entries) + per_page - 1) // per_page):
        batch = entries[page_index * per_page:(page_index + 1) * per_page]
        rows = (len(batch) + COLUMNS - 1) // COLUMNS
        sheet = Image.new("RGB", (COLUMNS * CELL_W, rows * CELL_H), (30, 26, 36))
        draw = ImageDraw.Draw(sheet)
        for i, item in enumerate(batch):
            b = item["bbox"]
            crop = image.crop((b["x"], b["y"], b["x"] + b["width"], b["y"] + b["height"]))
            crop.thumbnail((CELL_W - 12, CELL_H - 34), Image.Resampling.NEAREST)
            col, row = i % COLUMNS, i // COLUMNS
            px = col * CELL_W + (CELL_W - crop.width) // 2
            py = row * CELL_H + 4 + (CELL_H - 34 - crop.height) // 2
            sheet.paste(crop, (px, py))
            draw.text((col * CELL_W + 5, row * CELL_H + CELL_H - 24), item["id"], fill=(255, 230, 120), font=font)
            draw.rectangle((col * CELL_W, row * CELL_H, (col + 1) * CELL_W - 1, (row + 1) * CELL_H - 1), outline=(82, 68, 100))
        filename = f"{name}_contact_{page_index + 1:02d}.png"
        sheet.save(OUT / filename, optimize=True)
        pages.append(filename)

    return {
        "atlas": name,
        "source": str(path.relative_to(ROOT)),
        "image_size": {"width": image.width, "height": image.height},
        "segmentation": {
            "method": "8-connected components",
            "background_rule": f"max(R,G,B) <= {THRESHOLD} treated as background for detection only",
            "minimum_component_pixels": MIN_AREA,
            "source_pixels_modified": False,
        },
        "candidate_count": len(entries),
        "contact_sheets": pages,
        "sprites": entries,
    }


catalogs = [catalog_one(name, path) for name, path in SOURCES]
result = {
    "schema_version": 1,
    "purpose": "diagnostic sprite candidate catalog; names and semantic categories require visual review",
    "atlases": catalogs,
}
target = OUT / "atlas_catalog.json"
target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({
    "catalog": str(target.relative_to(ROOT)),
    "atlases": [{"name": x["atlas"], "candidates": x["candidate_count"], "contact_sheets": x["contact_sheets"]} for x in catalogs],
}, ensure_ascii=False))
