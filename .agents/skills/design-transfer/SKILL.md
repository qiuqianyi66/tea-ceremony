---
name: design-transfer
description: Load when transferring a design (Figma, screenshot, photo, PDF export) to frontend code. Source-agnostic playbook — capture once into a durable design brief, then implement from the brief and reference images only, never from a live design-tool session.
license: MIT
metadata:
  sources:
    - https://www.w3.org/TR/css-variables-1/ (CSS Custom Properties)
    - https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties
  version: "1.0.0"
compatibility: Any frontend stack; examples use Vue 3 + CSS custom properties
---

# Design Transfer — Source-Agnostic Playbook

> Capture once. Implement from the brief. Never depend on a live Figma (or other design-tool) session during implementation.

## Preferences

- One durable **design brief** as the single intake contract for every source
- Capture → brief → implement → verify — always in that order
- Design tokens as CSS custom properties on `:root` (or a theme scope)
- Structural layout first; polish and micro-details last
- Reference images beside the brief for visual QA — not the live tool
- Sibling intake skills for source-specific capture: `figma-intake`, `design-from-screenshot`

## Core Principles

- **Brief is the source of truth:** after capture, stop querying the design tool.
- **Tokens before pixels:** map colors, type, spacing, radii, shadows to named properties.
- **Structure before style:** regions, hierarchy, and breakpoints before fine-tuned looks.
- **Verify against references:** compare layout and tokens to saved images, not memory.

---

## 1) Intake Contract — Design Brief

Every transfer produces a brief artifact (typically `design-brief.md` + token notes + `assets/` reference images). Required sections:

| Section | Contents |
|---------|----------|
| Source metadata | Origin type, IDs/paths, capture date |
| Layout structure | Regions, hierarchy, breakpoints, component inventory |
| Design tokens | Color, typography, spacing, radii, shadows |
| Reference images | Paths to saved screenshots/exports for key states |
| Constraints | Stack, a11y, motion, content rules, out-of-scope |

Full template: [references/design-brief-template.md](references/design-brief-template.md)

Token extraction checklist: [references/token-extraction.md](references/token-extraction.md)

### Intake paths

| Source | Load |
|--------|------|
| Figma MCP available | `figma-intake` — one-pass capture into the brief |
| Screenshot / photo / PDF raster | `design-from-screenshot` — vision extraction with confidence markers |
| Already have exports + notes | Fill the brief template directly, then continue here |

---

## 2) Workflow

### Step A — Capture

1. Choose the intake path above.
2. Save all needed context into the brief **before** access can expire or attention shifts.
3. Export/save reference images for default, hover/focus (if relevant), empty, error, and each breakpoint provided.
4. Confirm the brief has structure, tokens, images, metadata, and constraints.

### Step B — Implement (from brief only)

1. Create CSS custom properties from the token table (see §3).
2. Build layout regions with Grid/Flex matching the structure section.
3. Map components to SFCs (or framework equivalents); reuse existing design-system pieces when the brief allows.
4. Apply typography and spacing from tokens — no magic numbers that duplicate the brief.
5. Do **not** re-open Figma MCP or re-fetch the source during this step.

### Step C — Verify

1. Walk the structural QA checklist (§4) against reference images.
2. Spot-check token values in DevTools vs the brief.
3. Fix gaps in code or update the brief if capture was incomplete — then re-verify.

---

## 3) Mapping Brief → Code

### Tokens → CSS custom properties

```css
:root {
  --color-bg: #0f1419;
  --color-fg: #f4f6f8;
  --color-accent: #3d8bfd;
  --font-sans: "Source Sans 3", system-ui, sans-serif;
  --font-display: "Fraunces", Georgia, serif;
  --text-body: 1rem;
  --text-h1: clamp(2rem, 1.5rem + 2vw, 3rem);
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 1rem;
  --space-4: 1.5rem;
  --radius-m: 0.5rem;
  --shadow-card: 0 8px 24px rgb(0 0 0 / 0.12);
}
```

- Name by role (`--color-accent`), not by raw hue (`--blue-500`), unless the brief uses a scale.
- Prefer `rem` for type/spacing; keep `px` only when the brief mandates hairlines or device pixels.
- Scope theme overrides on a parent (`.theme-dark`) instead of duplicating components.

### Layout → Grid / Flex

- Page chrome and major regions → CSS Grid template areas or named tracks.
- Linear clusters (toolbars, chip rows) → Flex with `gap` from the spacing scale.
- Intrinsic sizing (`min-content`, `auto-fit`) over fixed widths when the brief is fluid.

### Components → SFC (Vue 3 example)

- One visual component from the brief → one SFC (or shared primitive).
- Props for brief variants (size, tone, state); slots for content regions.
- Keep token consumption in CSS; avoid hard-coded colors in templates.

---

## 4) Structural QA Checklist

Against reference images (not the live tool):

- [ ] Region order and hierarchy match the brief outline
- [ ] Spacing rhythm matches the documented scale (no one-off gaps)
- [ ] Type sizes/weights match the type scale
- [ ] Color roles match tokens (bg, fg, accent, borders, status)
- [ ] Radii and shadows match token names used in the brief
- [ ] Breakpoint behavior matches provided reference frames
- [ ] Empty / error / loading states covered if listed in constraints
- [ ] Focus/hover affordances present where the brief shows them
- [ ] No leftover dependency on live MCP calls for styling decisions

---

## 5) Do Not

- Implement while repeatedly querying a design MCP “just to check”
- Invent tokens that contradict the brief without updating the brief
- Skip reference images when any visual source was available
- Mix intake and implementation without a written brief for multi-screen work
