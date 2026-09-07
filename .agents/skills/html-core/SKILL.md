---
name: html-core
description: Use for semantic HTML markup and document structure. Covers landmarks, head metadata, media (picture, srcset, lazy loading), dialog/details, and data attributes. Load when choosing elements or replacing div-soup.
license: MIT
metadata:
  sources:
    - https://developer.mozilla.org/en-US/docs/Web/HTML (MDN HTML)
    - https://html.spec.whatwg.org/ (HTML Living Standard)
  version: "1.0.0"
compatibility: Modern evergreen browsers (Baseline 2024)
---

# HTML Core — Semantic Markup

> Prefer native elements over generic containers. Structure communicates meaning to browsers, assistive tech, and crawlers.

## Preferences

- Semantic elements (`header`, `main`, `nav`, `article`, `section`, `aside`, `footer`) over nested `div`s
- One `<h1>` per page/view; heading levels never skip
- Meaningful `lang` on `<html>`; charset and viewport in `<head>`
- Native `dialog` / `details` before custom expand/modal markup
- `picture` + `srcset` for responsive images; `loading="lazy"` for below-fold media
- `data-*` for JS hooks — never invent non-standard attributes

## Core Principles

- **Meaning first:** choose the element that matches the content role, then style it.
- **Document outline:** headings and landmarks should make sense with CSS disabled.
- **Progressive enhancement:** HTML works without JS; enhance where needed.
- **Metadata is content:** title, description, and social tags belong in every page.

---

## 1) Document Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Orders — Acme Hub</title>
  <meta name="description" content="Track and manage warehouse orders.">
  <link rel="canonical" href="https://example.com/orders">
</head>
<body>
  <header><!-- site chrome --></header>
  <main id="main"><!-- unique page content --></main>
  <footer><!-- site footer --></footer>
</body>
</html>
```

Rules:
- Always set `lang` on `<html>`.
- Exactly one `<main>` per page (skip link target).
- Put site-wide chrome in `<header>` / `<footer>`; put unique content in `<main>`.
- Prefer `<section>` only when it has a heading; otherwise use `<div>` for layout only.

---

## 2) Semantic Elements

| Need | Prefer | Avoid |
|------|--------|-------|
| Primary navigation | `<nav>` | styled `<div>` list |
| Standalone content | `<article>` | generic wrapper |
| Thematic group with heading | `<section>` | unlabeled `div` |
| Sidebar / complementary | `<aside>` | float `div` |
| Inline emphasis | `<strong>` / `<em>` | bold/italic-only spans |
| Time / date | `<time datetime="...">` | plain text |
| Abbreviation | `<abbr title="...">` | unexplained acronyms |
| Figure + caption | `<figure>` + `<figcaption>` | image + orphaned text |

```html
<article>
  <h2>Shipment #4821</h2>
  <p>Dispatched <time datetime="2026-07-11">11 Jul 2026</time>.</p>
  <figure>
    <img src="/labels/4821.webp" alt="Shipping label for order 4821" width="400" height="300">
    <figcaption>Carrier label preview</figcaption>
  </figure>
</article>
```

---

## 3) Media

```html
<picture>
  <source type="image/avif" srcset="/hero.avif">
  <source type="image/webp" srcset="/hero.webp">
  <img
    src="/hero.jpg"
    alt="Sorting line at dawn"
    width="1200"
    height="675"
    loading="lazy"
    decoding="async"
  >
</picture>

<img
  src="/thumb.jpg"
  srcset="/thumb.jpg 1x, /thumb@2x.jpg 2x"
  alt=""
  width="80"
  height="80"
  loading="lazy"
>
```

- Always set `width` and `height` (or CSS aspect-ratio) to reduce CLS.
- Decorative images: `alt=""`. Informative images: concise, non-redundant alt.
- Use `loading="lazy"` for offscreen images; keep LCP/hero images eager.
- Prefer modern formats via `<picture>`; keep a JPEG/PNG fallback in `<img>`.

---

## 4) Interactive Disclosure

```html
<details>
  <summary>Shipping rates</summary>
  <p>Standard: 2–3 days. Express: next day.</p>
</details>

<dialog id="confirm-dialog">
  <form method="dialog">
    <p>Delete this draft?</p>
    <button value="cancel">Cancel</button>
    <button value="confirm">Delete</button>
  </form>
</dialog>
```

```js
const dialog = document.querySelector('#confirm-dialog')
dialog.showModal()
```

- Use `<details>`/`<summary>` for progressive disclosure without JS.
- Use `<dialog>` with `.showModal()` for modals (native focus trap + Esc).
- Prefer `method="dialog"` buttons to close and return a value.

---

## 5) Data Attributes

```html
<button type="button" data-action="retry" data-order-id="4821">Retry</button>
```

```js
const { action, orderId } = button.dataset
```

- Use `data-*` for behavior hooks and non-visible state shared with JS.
- Do not store secrets or PII in data attributes.
- Prefer boolean presence (`data-open`) or clear string values — avoid JSON blobs in HTML when possible.

---

## 6) Final Self-Check

- Landmarks and headings form a clear outline.
- No div-soup where a semantic element fits.
- Head has charset, viewport, unique title, and useful description.
- Media has dimensions, correct alt, and lazy-loading where appropriate.
- Custom widgets only when native `dialog`/`details`/`button` are insufficient.
