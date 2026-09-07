# Design Brief Template

> Copy into the project (e.g. `design-brief.md`) and fill during intake. Implementation consumes this file and `assets/` only.

```markdown
# Design Brief — <Screen / Feature Name>

## Source metadata

| Field | Value |
|-------|-------|
| Source type | figma-mcp / figma-export / screenshot / photo / pdf / other |
| Origin | <file URL, path, or description> |
| File key / ID | <if applicable> |
| Node IDs | <primary frames / components> |
| Capture date | YYYY-MM-DD |
| Captured by | <agent / human> |
| Related intake skill | figma-intake / design-from-screenshot / manual |

## Constraints

- **Stack:** <e.g. Vue 3 + Pinia + CSS custom properties>
- **Target viewports:** <e.g. 375, 768, 1280>
- **A11y:** <contrast, keyboard, reduced motion>
- **Motion:** <allowed / reduced-motion only / none>
- **Content:** <real copy vs placeholders; i18n>
- **Out of scope:** <what not to build this pass>

## Layout structure

### Regions (top → bottom / z-order)

1. **Header** — <role, sticky?, contents>
2. **Hero / primary** — <role, full-bleed?, contents>
3. **Main** — <sections list>
4. **Aside** — <if any>
5. **Footer** — <if any>

### Hierarchy notes

- Primary action: <label / placement>
- Secondary actions: <…>
- Information density: <sparse / medium / dense>

### Breakpoints

| Name | Width | Layout changes |
|------|-------|----------------|
| mobile | <e.g. <768> | <stack columns, hide X> |
| tablet | <…> | <…> |
| desktop | <…> | <…> |

### Component inventory

| Name in design | Maps to | Variants / states |
|----------------|---------|-------------------|
| Primary button | `<AppButton>` | default, hover, disabled |
| … | … | … |

## Design tokens

> Prefer the checklist in [token-extraction.md](token-extraction.md). Mark inferred values with `~` and a confidence note.

### Color

| Token | Value | Role | Confidence |
|-------|-------|------|------------|
| `--color-bg` | `#…` | page background | exact / ~inferred |
| `--color-fg` | `#…` | body text | … |
| `--color-accent` | `#…` | primary CTA | … |
| `--color-border` | `#…` | dividers | … |
| `--color-muted` | `#…` | secondary text | … |
| `--color-danger` | `#…` | errors | … |

### Typography

| Token | Value | Usage |
|-------|-------|-------|
| `--font-sans` | `"…", system-ui, sans-serif` | body / UI |
| `--font-display` | `"…", Georgia, serif` | headings (if any) |
| `--text-xs` … `--text-h1` | size / line-height / weight | scale |

### Spacing

| Token | Value | Notes |
|-------|-------|-------|
| `--space-1` | `0.25rem` | base unit ×1 |
| `--space-2` | `0.5rem` | |
| `--space-3` | `1rem` | |
| `--space-4` | `1.5rem` | |
| Scale basis | 4px / 8px / other | |

### Radii & shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-s` / `m` / `l` | `…` | controls, cards |
| `--shadow-*` | `…` | elevation |

### Breakpoint tokens (optional)

| Token | Value |
|-------|-------|
| `--bp-md` | `48rem` |
| `--bp-lg` | `80rem` |

## Reference images

Store files under `assets/` (or project-agreed path). List every image used for QA:

| File | State / breakpoint | Notes |
|------|--------------------|-------|
| `assets/home-desktop.png` | default / desktop | primary reference |
| `assets/home-mobile.png` | default / mobile | |
| `assets/home-empty.png` | empty state | |
| `assets/home-error.png` | error | |

## Open questions

- [ ] <ambiguities from intake>
- [ ] <missing states>

## Implementation notes

- Prefer existing components: <list>
- Forbidden patterns: <e.g. no card chrome in hero>
```

## How to use

1. Duplicate this template into the working tree before implementation.
2. Complete capture via `figma-intake` or `design-from-screenshot` (or manual fill).
3. Keep the brief and `assets/` in version control with the feature when practical.
4. Implement and verify only against this brief and the listed images.
