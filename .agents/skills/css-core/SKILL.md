---
name: css-core
description: Use for modern CSS foundations — custom properties, native nesting, :is/:where/:has, cascade layers, specificity, logical properties, and units. Load for stylesheet work, component styles, design tokens, or cascade/specificity issues.
license: MIT
metadata:
  sources:
    - https://developer.mozilla.org/en-US/docs/Web/CSS (MDN CSS)
    - https://www.w3.org/TR/css-cascade-5/ (CSS Cascading and Inheritance Level 5)
  version: "1.0.0"
compatibility: Modern evergreen browsers (Baseline 2024); native nesting and :has widely available
---

# CSS Core — Modern Foundations

> Tokens and cascade over one-off overrides. Prefer logical properties and low-specificity selectors.

## Preferences

- Design tokens as custom properties on `:root` or scope roots
- Native CSS nesting over deep selector duplication
- `:is()` / `:where()` / `:has()` for expressive, maintainable selectors
- `@layer` for predictable cascade between reset, tokens, components, utilities
- Logical properties (`margin-inline`, `padding-block`) over physical `left`/`right` when writing-mode agnostic
- Relative units (`rem`, `%`, `dvh`, `cqw`) over hard-coded `px` for layout typography

## Core Principles

- **Low specificity wins long-term:** avoid IDs and deep chains for styling.
- **Cascade is a feature:** layers and tokens beat `!important`.
- **Logical axes:** inline/block adapt to writing mode and RTL.
- **Progressive syntax:** use modern features with clear fallbacks only when needed.

---

## 1) Custom Properties

```css
:root {
  color-scheme: light dark;
  --color-fg: canvastext;
  --color-bg: canvas;
  --space-s: 0.5rem;
  --space-m: 1rem;
  --radius-m: 0.5rem;
  --font-sans: "Source Sans 3", system-ui, sans-serif;
}

.card {
  background: var(--color-bg);
  color: var(--color-fg);
  padding: var(--space-m);
  border-radius: var(--radius-m);
}
```

- Define tokens once; consume with `var(--token, fallback)`.
- Scope overrides on a parent: `.theme-dark { --color-bg: #111; }`.
- Prefer computed tokens (`--space-m`) over magic numbers in components.

---

## 2) Native Nesting

```css
.card {
  padding: var(--space-m);

  & h2 {
    margin-block-end: var(--space-s);
  }

  &:hover,
  &:focus-within {
    outline: 2px solid Highlight;
  }

  @media (width >= 40rem) {
    padding: var(--space-l, 1.5rem);
  }
}
```

- Nest by component, not by page; keep depth shallow (≈2–3).
- Use `&` for pseudo-classes and compound selectors.
- Prefer style queries / media inside the component that owns the change.

---

## 3) Selectors: `:is`, `:where`, `:has`

```css
:is(h1, h2, h3) {
  font-family: var(--font-sans);
  line-height: 1.2;
}

.nav :where(a, button) {
  padding: var(--space-s);
}

.card:has(img) {
  display: grid;
  gap: var(--space-s);
}

label:has(:invalid) {
  color: crimson;
}
```

- `:where()` → specificity 0; ideal for resets and base styles.
- `:is()` → specificity of its most specific argument.
- `:has()` → parent/sibling conditions without extra wrapper classes.

---

## 4) Cascade Layers & Specificity

```css
@layer reset, tokens, base, components, utilities;

@layer reset {
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
}

@layer components {
  .button {
    padding-inline: 1rem;
  }
}

@layer utilities {
  .mt-0 {
    margin-top: 0;
  }
}
```

Specificity quick guide:

| Selector | Specificity |
|----------|-------------|
| `:where(...)` | 0,0,0 |
| type / pseudo-element | 0,0,1 |
| class / attr / pseudo-class | 0,1,0 |
| ID | 1,0,0 |
| inline style | wins (except `!important`) |

- Order layers early; later layers win regardless of selector weight (within normal importance).
- Reach for `!important` only in utilities that must win, or third-party overrides — document why.

---

## 5) Logical Properties & Units

```css
.panel {
  margin-inline: auto;
  padding-block: var(--space-m);
  padding-inline: var(--space-m);
  border-inline-start: 4px solid var(--accent, Highlight);
  inline-size: min(100%, 40rem);
  min-block-size: 100dvh;
}
```

| Physical | Logical |
|----------|---------|
| `margin-left/right` | `margin-inline-start/end` |
| `padding-top/bottom` | `padding-block` |
| `width` / `height` | `inline-size` / `block-size` |
| `left` / `right` | `inset-inline-start/end` |

Units:
- `rem` for typography and spacing tied to root
- `%` / `fr` for flexible layout tracks
- `dvh` / `svh` / `lvh` for viewport height (prefer `dvh` for mobile UI chrome)
- `cqw` / `cqh` inside containment contexts (see `css-layout`)

---

## 6) Final Self-Check

- Tokens via custom properties; no scattered hex/px duplicates.
- Nesting is shallow; selectors stay low-specificity.
- Layers establish reset → tokens → base → components → utilities.
- Logical properties used for inline/block spacing and sizing.
- Modern selectors (`:is`/`:where`/`:has`) preferred over long chains.
