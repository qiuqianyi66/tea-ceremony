---
name: html-a11y
description: Use for HTML accessibility — ARIA first rule, landmarks, headings, focus management, keyboard patterns, alt text, and prefers-* hooks. Load when fixing a11y issues, auditing WCAG, or building dialogs/menus.
license: MIT
metadata:
  sources:
    - https://www.w3.org/WAI/ARIA/apg/ (ARIA Authoring Practices Guide)
    - https://developer.mozilla.org/en-US/docs/Web/Accessibility (MDN Accessibility)
    - https://www.w3.org/WAI/standards-guidelines/wcag/ (WCAG)
  version: "1.0.0"
compatibility: Modern evergreen browsers (Baseline 2024); assistive tech agnostic patterns
---

# HTML Accessibility

> Prefer native HTML. Add ARIA only when semantics are missing. Keyboard and screen-reader users are first-class.

## Preferences

- Native elements (`button`, `a`, `input`, `dialog`) over `div` + ARIA role
- Visible focus styles — never `outline: none` without a replacement
- Logical heading order; one `<h1>` per view
- Landmarks: one `<main>`, labeled `<nav>` when multiple
- Meaningful alt text; `alt=""` only for decorative images
- Respect `prefers-reduced-motion` and other `prefers-*` hooks in CSS/JS

## Core Principles

- **First rule of ARIA:** if a native element provides the role/behavior, use it.
- **Name, role, value:** every interactive control must expose an accessible name.
- **Keyboard parity:** anything clickable must be reachable and operable without a pointer.
- **Don't trap focus** except in true modals — and restore focus on close.

---

## 1) ARIA First Rule

```html
<!-- Good: native button -->
<button type="button" aria-expanded="false" aria-controls="menu">Menu</button>

<!-- Bad: fake button -->
<div role="button" tabindex="0" onclick="...">Menu</div>
```

Use ARIA when:
- You need a pattern not covered by HTML (`treegrid`, complex tabs) — follow APG.
- You must expose state (`aria-expanded`, `aria-pressed`, `aria-invalid`, `aria-busy`).
- You need a live region for async updates (`aria-live`).

Avoid:
- Redundant roles (`<button role="button">`).
- `aria-label` that duplicates visible text.
- ARIA that lies (role says button but Enter does nothing).

---

## 2) Landmarks & Headings

```html
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header>
    <nav aria-label="Primary"><!-- ... --></nav>
  </header>
  <main id="main">
    <h1>Orders</h1>
    <section aria-labelledby="filters-heading">
      <h2 id="filters-heading">Filters</h2>
    </section>
  </main>
</body>
```

- Provide a skip link to `#main`.
- Label multiple navs: `aria-label="Primary"` / `"Footer"`.
- Do not skip heading levels (`h2` → `h4`).
- Prefer `aria-labelledby` pointing at a visible heading over opaque `aria-label` on regions.

---

## 3) Focus Management

```js
const dialog = document.querySelector('#edit-dialog')
const trigger = document.querySelector('#open-edit')

trigger.addEventListener('click', () => {
  dialog.showModal()
})

dialog.addEventListener('close', () => {
  trigger.focus()
})
```

Rules:
- After opening a modal, focus moves inside (native `<dialog>.showModal()` does this).
- On close, return focus to the trigger.
- After form errors, move focus to the first invalid field or the error summary.
- Do not use positive `tabindex` (>0); use `0` or `-1` only when necessary.
- Manage focus for SPAs on route change: move to the new `h1` or main container (`tabindex="-1"` then `.focus()`).

---

## 4) Keyboard Patterns

| Control | Keys |
|---------|------|
| Button / link | Enter (and Space for button) |
| Checkbox | Space |
| Radio group | Arrow keys between options |
| Menu / listbox | Arrows, Home/End, Escape, typeahead |
| Dialog | Escape closes; Tab cycles within |

```html
<button type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="actions">
  Actions
</button>
<ul id="actions" role="menu" hidden>
  <li role="menuitem" tabindex="-1">Edit</li>
  <li role="menuitem" tabindex="-1">Delete</li>
</ul>
```

- Implement APG keyboard behavior when using composite widgets.
- Ensure custom widgets are in tab order or have an inner roving tabindex.

---

## 5) Images & Non-Text Content

```html
<img src="/chart.png" alt="Orders up 12% week over week">
<img src="/divider.svg" alt="" role="presentation">
<svg role="img" aria-labelledby="icon-title">
  <title id="icon-title">Download</title>
  <!-- paths -->
</svg>
```

- Informative: describe purpose/outcome, not “image of…”.
- Decorative: empty `alt` (and optional `role="presentation"`).
- Icon-only buttons need an accessible name (`aria-label` or visually hidden text).

---

## 6) `prefers-*` Hooks

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

@media (prefers-contrast: more) {
  :root {
    --border: CanvasText;
  }
}
```

```js
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
```

- Gate non-essential animation and autoplay.
- Do not convey information by color alone — add text/icon.
- See `css-animations` for motion implementation details; this skill owns the a11y requirement to respect user preferences.

---

## 7) Forms Errors (A11y)

```html
<label for="email">Email</label>
<input id="email" name="email" type="email" required aria-invalid="true" aria-describedby="email-error">
<p id="email-error" role="alert">Enter a valid email address.</p>
```

- Tie errors with `aria-describedby` / `aria-errormessage` when supported.
- Use `aria-invalid="true"` on failing fields.
- Announce summaries with `role="alert"` or `aria-live="assertive"` sparingly.

---

## 8) Final Self-Check

- Native control used wherever possible; ARIA only to fill gaps.
- Keyboard-only path works; focus is visible and restored after overlays.
- Landmarks and headings describe the page.
- Images and icon buttons have correct accessible names.
- Motion and contrast preferences are honored.
- Form errors are programmatically associated and announced.
