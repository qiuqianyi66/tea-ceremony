# Token Extraction Checklist

> Use during capture (any source). Record values in the design brief. Mark inferred values with `~` and a short confidence note.

## Color

- [ ] Page / canvas background
- [ ] Primary text (body)
- [ ] Secondary / muted text
- [ ] Accent / brand / primary CTA
- [ ] Borders and dividers
- [ ] Surface / elevated panels (if distinct from page bg)
- [ ] Status: success, warning, danger, info (only if present)
- [ ] Overlay / scrim (modals, drawers)
- [ ] Link color (if different from accent)
- [ ] Disabled / placeholder tones

Rules:
- Prefer role names (`--color-fg`) over raw palette indexes unless the source uses a named scale.
- Note opacity separately when fills are translucent (`rgb(0 0 0 / 0.4)`).
- If sampling from a photo, average a clean region and mark `~`.

## Typography

- [ ] Font families (sans, display, mono) + fallbacks
- [ ] Body size, line-height, weight
- [ ] Heading scale (h1–h3 minimum; more if present)
- [ ] Small / caption / overline styles
- [ ] Letter-spacing / text-transform on labels
- [ ] Link / button label styles if distinct

Rules:
- Prefer `rem` in the brief; note `px` from design tools and convert.
- Record weight as numeric (`400`, `600`) when known.
- If the font is unknown from a screenshot, note closest system/web alternative with `~`.

## Spacing scale

- [ ] Base unit (4px or 8px grid — state which)
- [ ] Common gaps: xs, s, m, l, xl (map to `--space-*`)
- [ ] Section padding (page gutters)
- [ ] Component internal padding (buttons, inputs, cards)
- [ ] Stack spacing between repeating items

Rules:
- Infer a small scale (4–6 steps), not every unique gap.
- Collapse near-duplicates to the nearest step; mark outliers as one-offs in layout notes.
- Screenshots: measure major gaps first; avoid over-fitting noise.

## Radii

- [ ] Controls (buttons, inputs)
- [ ] Cards / panels
- [ ] Pills / chips (if used — often full-round)
- [ ] Images / media frames
- [ ] Modal / dialog corners

## Shadows / elevation

- [ ] Resting elevation (cards, bars)
- [ ] Raised / hover elevation
- [ ] Modal / popover shadow
- [ ] Focus ring (color, width, offset) — treat as a token even if not a shadow

## Breakpoints & layout measures

- [ ] Documented frame widths from source (or inferred from multiple images)
- [ ] Max content width / reading measure
- [ ] Gutter behavior per breakpoint
- [ ] Sticky header height (if any)
- [ ] Grid columns / margins when a grid is visible

## Confidence markers

| Marker | Meaning |
|--------|---------|
| (none) | Exact from structured source or precise measurement |
| `~` | Inferred from raster / photo; verify before ship |
| `?` | Ambiguous; ask or leave as open question in the brief |

Always pair `~` with a one-line reason (`~ sampled from compressed JPEG`).

## Done when

- Color, type, spacing, radii, and shadows needed for the screen are listed in the brief
- Every `~` value is flagged
- Reference images exist for each breakpoint you claimed to extract
