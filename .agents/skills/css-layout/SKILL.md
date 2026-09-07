---
name: css-layout
description: Use for CSS layout — Flexbox vs Grid, common grid patterns, subgrid, container queries, and intrinsic sizing (min, clamp, fit-content). Load when building layouts, aligning items, or choosing between flex and grid.
license: MIT
metadata:
  sources:
    - https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout (MDN Flexbox)
    - https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout (MDN Grid)
    - https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries (MDN Container queries)
  version: "1.0.0"
compatibility: Modern evergreen browsers (Baseline 2024); subgrid and container queries widely available
---

# CSS Layout — Flexbox, Grid & Containers

> Flex for one-dimensional alignment; Grid for two-dimensional structure. Size with intrinsic constraints, not magic breakpoints alone.

## Preferences

- Flexbox for rows/columns of controls, toolbars, nav links
- Grid for page shells, card galleries, form layouts with aligned columns
- `subgrid` when children must share parent track alignment
- Container queries for component-level responsiveness (owned here for syntax)
- Intrinsic sizing: `min()`, `max()`, `clamp()`, `fit-content`, `minmax()`

## Core Principles

- **Content decides tracks:** prefer `auto` / `minmax` / `fr` over fixed pixel grids.
- **Gap over margins:** use `gap` for spacing between siblings in flex/grid.
- **Contain before query:** `@container` needs `container-type` on an ancestor.
- **One layout job per wrapper:** don't nest grids/flexes without a reason.

---

## 1) Flex vs Grid

| Situation | Choose |
|-----------|--------|
| Distribute items on one axis | Flexbox |
| Equal-height cards in a wrap row | Flexbox or auto-fit Grid |
| Explicit rows **and** columns | Grid |
| Overlapping / named areas | Grid |
| Align unknown number of siblings | Flexbox (`flex-wrap`) or `auto-fit` Grid |

```css
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.toolbar__spacer {
  flex: 1 1 auto;
}
```

---

## 2) Grid Patterns

```css
.page {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 3fr);
  grid-template-areas:
    "sidebar main"
    "sidebar main";
  gap: 1.5rem;
  min-block-size: 100dvh;
}

.sidebar { grid-area: sidebar; }
.main { grid-area: main; min-inline-size: 0; }

.gallery {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
  gap: 1rem;
}
```

- Set `min-inline-size: 0` (or `min-width: 0`) on grid/flex children that scroll or truncate.
- `repeat(auto-fit, minmax(...))` builds responsive galleries without breakpoints.
- Prefer named `grid-template-areas` for readable page shells.

---

## 3) Subgrid

```css
.card-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

.card {
  display: grid;
  grid-template-rows: subgrid;
  grid-row: span 3;
  gap: inherit;
}

.card__title { /* row 1 */ }
.card__body { /* row 2 */ }
.card__actions { /* row 3 */ }
```

- Use `subgrid` so sibling cards share row sizes (aligned titles/actions).
- Parent must define the tracks the child spans.
- Fall back to independent grids if support is not required for the audience.

---

## 4) Container Queries

```css
.card-shell {
  container-type: inline-size;
  container-name: card;
}

@container card (min-width: 24rem) {
  .card {
    display: grid;
    grid-template-columns: 8rem 1fr;
    gap: 1rem;
  }
}
```

- Put `container-type: inline-size` on the element whose width should drive variants.
- Name containers when multiple exist on a page.
- Prefer container queries for reusable components; prefer media queries for page chrome and typography rooted to the viewport (see `css-responsive`).

---

## 5) Intrinsic Sizing

```css
.prose {
  inline-size: min(100%, 65ch);
  margin-inline: auto;
}

.hero-title {
  font-size: clamp(1.5rem, 1rem + 2vw, 3rem);
}

.sidebar {
  inline-size: fit-content;
  max-inline-size: 20rem;
}

.track {
  grid-template-columns: minmax(12rem, 20rem) minmax(0, 1fr);
}
```

- `min(100%, 65ch)` — fluid but capped measure.
- `clamp(min, preferred, max)` — fluid type/spacing with hard bounds.
- `fit-content` / `max-content` / `min-content` — size to content deliberately.
- `minmax(0, 1fr)` — flexible tracks that can shrink below content size.

---

## 6) Final Self-Check

- Flex vs Grid chosen by axis and structure, not habit.
- `gap` used instead of sibling margin hacks.
- Overflowing children have `min-inline-size: 0` where needed.
- Component variants use container queries with `container-type`.
- Widths/type use `min`/`clamp`/`minmax` instead of brittle fixed sizes.
