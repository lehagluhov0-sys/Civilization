#!/usr/bin/env python3
"""Build a diagnostic sprite catalog without modifying source atlas pixels."""
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
THRESHOLDS = (15, 25, 35, 45, 50, 55, 60, 65, 70, 75, 80, 90, 100)
TARGET_COUNTS = {"world": 282, "secondary": 305}
CELL_W, CELL_H, COLUMNS = 144, 132, 8
STRUCTURE = np.ones((3, 3), dtype=np.uint8)


def get_components(mask: np.ndarray):
    labels, _ = ndimage.label(mask, structure=STRUCTURE)
    slices = ndimage.find_objects(labels)
    comps = []
    for label_id, slc in enumerate(slices, start=1):
        if slc is None:
            continue
        y0, y1 = slc[0].start, slc[0].stop
        x0, x1 = slc[1].start, slc[1].stop
        area = int(np.count_nonzero(labels[slc] == label_id))
        if area >= MIN_AREA:
            comps.append((x0, y0, x1, y1, area))
    return comps


def catalog_one(name: str, path: Path) -> dict:
    if not path.is_file():
        raise FileNotFoundError(path)
    image = Image.open(path).convert("RGB")
    arr = np.asarray(image).astype(np.int16)
    h, w = arr.shape[:2]

    # Estimate the backdrop from four corner patches rather than assuming pure black.
    patch = 48
    corners = np.concatenate([
        arr[:patch, :patch].reshape(-1, 3),
        arr[:patch, -patch:].reshape(-1, 3),
        arr[-patch:, :patch].reshape(-1, 3),
        arr[-patch:, -patch:].reshape(-1, 3),
    ], axis=0)
    background = np.median(corners, axis=0)
    distance = np.max(np.abs(arr - background), axis=2)

    diagnostics = []
    candidates = []
    for threshold in THRESHOLDS:
        comps = get_components(distance > threshold)
        largest = max((c[4] for c in comps), default=0)
        diagnostics.append({
            "threshold": threshold,
            "candidate_count": len(comps),
            "largest_component_pixels": largest,
        })
        # Avoid choosing a threshold where the backdrop becomes one giant object.
        if largest < int(w * h * 0.08) and len(comps) >= 20:
            target = TARGET_COUNTS[name]
            candidates.append((abs(len(comps) - target), threshold, comps))
    if candidates:
        _, chosen_threshold, components = min(candidates, key=lambda x: (x[0], x[1]))
    else:
        # Keep the least-connected plausible mask for inspection and flag it.
        viable = [(d["candidate_count"], d["threshold"]) for d in diagnostics]
        chosen_threshold = max(viable)[1]
        components = get_components(distance > chosen_threshold)

    entries = []
    for x0, y0, x1, y1, area in components:
        bw, bh = x1 - x0, y1 - y0
        box_area = bw * bh
        fill = round(area / box_area, 4) if box_area else 0
        flags = []
        if fill < 0.18:
            flags.append("sparse_or_irregular_component")
        if box_area > 30000 or area > int(w * h * 0.08):
            flags.append("large_component_review")
        entries.append({
            "id": f"{name}_{len(entries):04d}",
            "source": path.name,
            "bbox": {"x": x0, "y": y0, "width": bw, "height": bh},
            "pixel_area": area,
            "bbox_fill_ratio": fill,
            "review_flags": flags,
            "label": "unclassified",
        })

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

        # A compact SVG version embeds each thumbnail as a data URI, so the
        # entire review sheet is a single self-contained file.
        import io
        svg_parts = [
            '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1152" height="' + str(rows * CELL_H) + '" viewBox="0 0 1152 ' + str(rows * CELL_H) + '">',
            '<rect width="100%" height="100%" fill="#1e1a24"/>'
        ]
        for i, item in enumerate(batch):
            b = item["bbox"]
            crop = image.crop((b["x"], b["y"], b["x"] + b["width"], b["y"] + b["height"]))
            crop.thumbnail((CELL_W - 12, CELL_H - 34), Image.Resampling.NEAREST)
            buffer = io.BytesIO()
            crop.save(buffer, format="PNG", optimize=True)
            import base64
            encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
            col, row = i % COLUMNS, i // COLUMNS
            px = col * CELL_W + (CELL_W - crop.width) // 2
            py = row * CELL_H + 4 + (CELL_H - 34 - crop.height) // 2
            svg_parts.append(f'<image x="{px}" y="{py}" width="{crop.width}" height="{crop.height}" href="data:image/png;base64,{encoded}"/>')
            svg_parts.append(f'<text x="{col * CELL_W + 5}" y="{row * CELL_H + CELL_H - 8}" fill="#ffe678" font-family="monospace" font-size="12">{item["id"]} · {b["x"]},{b["y"]} {b["width"]}x{b["height"]}</text>')
            svg_parts.append(f'<rect x="{col * CELL_W}" y="{row * CELL_H}" width="{CELL_W - 1}" height="{CELL_H - 1}" fill="none" stroke="#524464"/>')
        svg_parts.append('</svg>')
        svg_name = f"{name}_contact_{page_index + 1:02d}.svg"
        (OUT / svg_name).write_text("\\n".join(svg_parts), encoding="utf-8")
        pages.append(svg_name)

    return {
        "atlas": name,
        "source": str(path.relative_to(ROOT)),
        "image_size": {"width": w, "height": h},
        "segmentation": {
            "method": "8-connected components with corner-estimated backdrop",
            "estimated_background_rgb": [round(float(v), 2) for v in background],
            "chosen_color_distance_threshold": chosen_threshold,
            "target_candidate_count": TARGET_COUNTS[name],
            "threshold_diagnostics": diagnostics,
            "minimum_component_pixels": MIN_AREA,
            "source_pixels_modified": False,
            "warning": "Candidate boxes are diagnostic; merged or fragmented sprites require visual review.",
        },
        "candidate_count": len(entries),
        "contact_sheets": pages,
        "sprites": entries,
    }


catalogs = [catalog_one(name, path) for name, path in SOURCES]

# Enlarged review sheets for known composite crops that must be split manually.
review_path = OUT / "visual-review.json"
if review_path.is_file():
    reviewed = json.loads(review_path.read_text(encoding="utf-8"))
    from PIL import ImageOps
    for atlas_name, source_path in SOURCES:
        source_image = Image.open(source_path).convert("RGB")
        composites = [
            item for item in reviewed.get("sprites", [])
            if item.get("source") == source_path.name and item.get("category") == "composite_atlas"
        ]
        if not composites:
            continue
        cell_w, cell_h, columns = 360, 320, 4
        rows = (len(composites) + columns - 1) // columns
        detail = Image.new("RGB", (columns * cell_w, rows * cell_h), (30, 26, 36))
        draw = ImageDraw.Draw(detail)
        font = ImageFont.load_default()
        for index, item in enumerate(composites):
            b = item["bbox"]
            crop = source_image.crop((b["x"], b["y"], b["x"] + b["width"], b["y"] + b["height"]))
            crop.thumbnail((cell_w - 16, cell_h - 52), Image.Resampling.NEAREST)
            col, row = index % columns, index // columns
            px = col * cell_w + (cell_w - crop.width) // 2
            py = row * cell_h + 4 + (cell_h - 52 - crop.height) // 2
            detail.paste(crop, (px, py))
            draw.text((col * cell_w + 6, row * cell_h + cell_h - 42),
                      f'{item["id"]} {b["x"]},{b["y"]} {b["width"]}x{b["height"]}',
                      fill=(255, 230, 120), font=font)
            draw.text((col * cell_w + 6, row * cell_h + cell_h - 25),
                      item["label"], fill=(220, 220, 220), font=font)
            draw.rectangle((col * cell_w, row * cell_h, (col + 1) * cell_w - 1,
                            (row + 1) * cell_h - 1), outline=(82, 68, 100))
        detail.save(OUT / f"composite_review_{atlas_name}.png", optimize=True)
result = {
    "schema_version": 2,
    "purpose": "diagnostic sprite candidates with original atlas coordinates; no semantic names are guessed",
    "atlases": catalogs,
}
target = OUT / "atlas_catalog.json"
target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({
    "catalog": str(target.relative_to(ROOT)),
    "atlases": [{
        "name": x["atlas"],
        "candidates": x["candidate_count"],
        "threshold": x["segmentation"]["chosen_color_distance_threshold"],
        "diagnostics": x["segmentation"]["threshold_diagnostics"],
        "contact_sheets": x["contact_sheets"],
    } for x in catalogs],
}, ensure_ascii=False))
