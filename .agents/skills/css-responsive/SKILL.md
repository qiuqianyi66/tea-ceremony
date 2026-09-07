---
name: css-responsive
description: Use for responsive CSS — mobile-first media queries, fluid typography with clamp(), media vs container queries, dvh units, and responsive images. Load when adapting breakpoints or fixing mobile viewport bugs.
license: MIT
metadata:
  sources:
    - https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_media_queries (MDN Media queries)
    - https://developer.mozilla.org/en-US/docs/Web/CSS/clamp (MDN clamp)
    - https://developer.mozilla.org/en-US/docs/Web/CSS/length#viewport-relative_lengths (MDN viewport units)
  version: "1.0.0"
compatibility: Modern evergreen browsers (Baseline 2024)
---

# CSS Responsive — Fluid & Mobile-First

> Design the small screen first, then enhance. Prefer fluid values over breakpoint staircases when content allows.

## Preferences

- Mobile-first: base styles for narrow viewports; `min-width` enhancements
- Fluid typography and spacing with `clamp()` where a continuous scale fits
- Media queries for viewport/page concerns; container queries for component variants (syntax in `css-layout`)
- `dvh` / `svh` / `lvh` instead of naive `100vh` on mobile UI
- Responsive images coordinated with HTML `srcset` / `picture` (see `html-core`)

## Core Principles

- **Content breakpoints, not device names:** query when the layout breaks, not “iPad”.
- **Fluid over stepped** when typography/spacing can scale continuously.
- **Viewport ≠ component:** page chrome uses `@media`; cards/widgets use `@container`.
- **Test real devices:** address bar and dynamic toolbars affect viewport units.

---

## 1) Mobile-First Strategy

```css
.stack {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

@media (width >= 48rem) {
  .stack {
    flex-direction: row;
    align-items: flex-start;
  }
}
```

- Write the default for the narrowest supported width.
- Add complexity at `min-width` (or range) queries — avoid desktop-first `max-width` pyramids.
- Use modern range syntax (`width >= 48rem`) when targeting evergreen browsers; `(min-width: 48rem)` is equivalent.

---

## 2) Fluid Typography with `clamp()`

```css
:root {
  --step-0: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);
  --step-1: clamp(1.25rem, 1.1rem + 0.75vw, 1.75rem);
  --step-2: clamp(1.5rem, 1.2rem + 1.5vw, 2.5rem);
}

h1 {
  font-size: var(--step-2);
  line-height: 1.15;
}

p {
  font-size: var(--step-0);
  max-inline-size: 65ch;
}
```

- Form: `clamp(MIN, PREFERRED, MAX)` — preferred often mixes `rem` + `vw`.
- Keep body text readable; don't let fluid type shrink below ~16px equivalent without reason.
- Pair with a capped measure (`65ch`) for long-form text.

---

## 3) Media vs Container Queries

| Concern | Tool |
|---------|------|
| Global nav collapse, page columns | `@media` |
| Card switches from stacked to horizontal | `@container` (see `css-layout`) |
| Prefer dark scheme / reduced motion | `@media (prefers-*)` |
| Print stylesheet | `@media print` |

```css
@media (width >= 64rem) {
  .app-shell {
    grid-template-columns: 16rem 1fr;
  }
}

/* Component-owned: declare containment + @container in css-layout */
```

- Do not duplicate the same layout rule in both media and container queries.
- Cross-link: container query syntax and `container-type` live in `css-layout`.

---

## 4) Viewport Units

```css
.hero {
  min-block-size: 100dvh;
}

.sheet {
  max-block-size: 90svh;
  overflow: auto;
}
```

| Unit | Meaning |
|------|---------|
| `dvh` | Dynamic viewport — changes as browser chrome shows/hides |
| `svh` | Small viewport — assumes largest chrome |
| `lvh` | Large viewport — assumes smallest chrome |
| `vh` | Legacy; often wrong on mobile |

- Prefer `dvh` for full-screen sections; prefer `svh` when content must never be clipped by expanding chrome.
- Avoid `100vh` for mobile app shells.

---

## 5) Responsive Images Coordination

```css
.hero img {
  inline-size: 100%;
  block-size: auto;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}
```

```html
<img
  src="/hero-800.jpg"
  srcset="/hero-800.jpg 800w, /hero-1600.jpg 1600w"
  sizes="(min-width: 48rem) 50vw, 100vw"
  alt=""
  width="1600"
  height="900"
>
```

- CSS controls layout; HTML `srcset`/`sizes`/`picture` selects the file — keep them aligned.
- Always preserve aspect ratio to limit CLS.
- Details for `picture`/`srcset` markup: `html-core`.

---

## 6) Final Self-Check

- Base styles work on a narrow phone without horizontal scroll.
- Breakpoints match layout failure points, not device marketing names.
- Type/spacing use `clamp()` or intentional steps — not random font-size jumps.
- Full-height UI uses `dvh`/`svh`, not bare `100vh`.
- Component variants use container queries (`css-layout`); page shell uses media queries.
