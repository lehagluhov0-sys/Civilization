# Sprite atlas diagnostic catalog

Generated automatically from the two original 1536×1024 PNG atlases.

## Results

| Atlas | Candidates | Contact sheets |
|---|---:|---:|
| `world_atlas.png` | 238 | [01](world_contact_01.png) · [02](world_contact_02.png) · [03](world_contact_03.png) · [04](world_contact_04.png) |
| `file_000000002d208210877c4978b05eaded.png` | 291 | [01](secondary_contact_01.png) · [02](secondary_contact_02.png) · [03](secondary_contact_03.png) · [04](secondary_contact_04.png) · [05](secondary_contact_05.png) |

Full coordinate data: [atlas_catalog.json](atlas_catalog.json).

## Reading the catalog

- Each sprite has a stable ID such as `world_0000` or `secondary_0000`.
- `bbox.x`, `bbox.y`, `bbox.width`, and `bbox.height` are pixel coordinates in the original PNG.
- The contact sheets show nearest-neighbour previews and the matching IDs.
- All entries are currently `unclassified`; the script does not invent semantic names.
- `review_flags` identify sparse/irregular or unusually large candidates that may be merged sprites or segmentation noise.

## Important limitations

The extraction is diagnostic, not a final hand-checked sprite atlas. The backdrop is estimated from the four corners and a color-distance threshold is selected per atlas. Touching sprites can still merge, and textured backdrop regions can create false candidates. Source PNG files are never modified. Do not replace the current in-game sprite mappings with this catalog until the contact sheets and uncertain boxes have been visually reviewed.

The SVG files in `../svg/` are self-contained wrappers with the original PNG bytes embedded; the PNG originals remain the source of truth.
