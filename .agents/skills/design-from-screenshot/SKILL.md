---
name: design-from-screenshot
description: Load when the only design source is a screenshot, photo, PDF raster, or image export — no Figma MCP or structured tokens. Extract layout hierarchy, spacing scale, palette, and type scale into the design brief with mandatory confidence markers on inferred values.
license: MIT
metadata:
  sources:
    - https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout
    - https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout
  version: "1.0.0"
compatibility: Any frontend stack; pairs with design-transfer brief contract
---

# Design from Screenshot — Vision-Only Intake

> Turn raster images into a filled design brief. Everything extracted is a hypothesis until verified against the saved references.

## Preferences

- Fill [design-brief-template.md](../design-transfer/references/design-brief-template.md) before writing UI code
- Follow [token-extraction.md](../design-transfer/references/token-extraction.md) for token coverage
- Infer a **4px or 8px** spacing scale — do not invent arbitrary unique gaps
- Mark every inferred value with `~` (or `?` if ambiguous)
- Use multiple images for breakpoints; never invent a layout not shown
- Hand off to `design-transfer` for implement → verify

## Core Principles

- **Structure first:** regions and hierarchy before hex codes.
- **Scale over noise:** collapse similar gaps into a small spacing scale.
- **Honesty about uncertainty:** confidence markers are mandatory, not optional.
- **Photos are hostile:** correct perspective, crop chrome, distrust color casts.

---

## 1) Prepare Inputs

1. Collect all relevant images (desktop, mobile, states).
2. Prefer lossless or high-quality PNG over compressed social-media JPEGs.
3. Crop device bezels, OS chrome, and irrelevant desktop wallpaper when possible.
4. Note source type in brief metadata: `screenshot` / `photo` / `pdf`.

---

## 2) Layout Hierarchy from Raster

Read the image top → bottom, large → small:

1. **Page regions:** header, hero, main columns, sidebar, footer, overlays.
2. **Grouping:** what shares a background, card, or divider?
3. **Order:** visual reading order vs DOM order you will implement.
4. **Primary CTA:** largest/highest-contrast interactive control.
5. **Repeating patterns:** lists, grids, tables — note columns and gaps.

Record regions and component inventory in the brief. Sketch grid vs flex intent in notes (e.g. “2-col grid → stacks below tablet”).

---

## 3) Spacing-Scale Inference (4 / 8px)

1. Pick a clear repeated gap (card padding, stack gap between rows).
2. Decide base grid: **8px** default for product UI; **4px** when dense.
3. Map common gaps to `--space-1` … `--space-5` (or similar short scale).
4. Round noisy measurements to the nearest step; document true outliers as one-offs.
5. Mark the whole scale with `~` when measuring from pixels in a bitmap.

Do not create a new token for every measured distance.

---

## 4) Palette & Type Scale

### Color

- Sample large flat areas (backgrounds, surfaces), then text, then accents.
- Ignore single-pixel fringing and anti-aliasing at edges.
- Record roles in the brief (`bg`, `fg`, `accent`, `border`, status).
- Photos: neutralize obvious warm/cool casts; mark `~ color cast from photo`.

### Typography

- Estimate size relative to a known element (e.g. button height ≈ 40–48px).
- Infer weight bands: regular / medium / semibold / bold — not every numeric weight.
- Guess family only when distinctive; otherwise `system-ui` / generic with `~`.
- Build a short scale: body + 2–4 heading/caption steps.

---

## 5) Multi-Breakpoint Reasoning

- Treat each image as evidence for one breakpoint — do not interpolate unseen layouts.
- Table differences: what stacks, hides, or becomes a drawer?
- If only one width exists, state that in constraints and avoid inventing responsive behavior.
- Save each image under `assets/` and list it in the brief’s reference table.

---

## 6) Low-Quality Photo Handling

- Correct skew/perspective mentally; prefer orthogonal measurements on UI edges.
- Distrust white balance; prefer relative contrast roles over absolute hex when unsure (`?`).
- Increase crop aggressiveness — remove hands, desks, reflections.
- If unreadable, stop and request a cleaner capture rather than fabricating UI.

---

## 7) Confidence Markers (Required)

| Marker | Use when |
|--------|----------|
| exact | Rare for screenshots — only if value is explicit in accompanying notes |
| `~` | Measured or sampled from pixels |
| `?` | Conflicting or unreadable; open question in the brief |

Example brief row:

`| --color-accent | ~#3D8BFD | primary CTA | ~ sampled from JPEG |`

Never present inferred tokens as exact Figma variables.

---

## 8) Handoff

1. Brief sections complete: metadata, structure, tokens, images, constraints.
2. Load `design-transfer` and implement from the brief only.
3. Verify against `assets/` images using the structural QA checklist.
