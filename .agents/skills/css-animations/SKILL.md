---
name: css-animations
description: Use for CSS motion — transitions, @keyframes, compositor-friendly properties, View Transitions API, scroll-driven animations, and prefers-reduced-motion. Load when adding motion or debugging janky animation.
license: MIT
metadata:
  sources:
    - https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_transitions (MDN Transitions)
    - https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_animations (MDN Animations)
    - https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API (MDN View Transitions)
    - https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_scroll-driven_animations (MDN Scroll-driven animations)
  version: "1.0.0"
compatibility: Modern evergreen browsers (Baseline 2024); View Transitions and scroll-driven animations — progressive enhancement
---

# CSS Animations — Motion with Restraint

> Motion clarifies state change. Prefer compositor-friendly properties, short durations, and respect `prefers-reduced-motion`.

## Preferences

- Transitions for simple state changes; `@keyframes` for multi-step sequences
- Animate `transform` and `opacity` — avoid layout-thrashing properties in hot paths
- View Transitions API for same-document navigations / DOM updates (progressive enhancement)
- Scroll-driven animations for parallax/progress tied to scroll — not as the only affordance
- Always provide a `prefers-reduced-motion: reduce` path

## Core Principles

- **Purpose over decoration:** every animation should signal entry, exit, feedback, or continuity.
- **60fps mindset:** stick to compositor properties; measure when unsure.
- **Interruptible:** hover/focus transitions should reverse cleanly.
- **Accessible:** reduced motion is a requirement, not an afterthought (see also `html-a11y`).

---

## 1) Transitions

```css
.button {
  transform: translateY(0);
  transition:
    transform 160ms ease-out,
    background-color 160ms ease-out,
    box-shadow 160ms ease-out;
}

.button:hover {
  transform: translateY(-1px);
}

.button:active {
  transform: translateY(0);
}
```

- List only properties you intend to animate — avoid `transition: all`.
- Typical UI: 120–250ms; longer for large spatial moves.
- Use `ease-out` for entrances, `ease-in` for exits, `ease-in-out` for symmetric loops.

---

## 2) `@keyframes`

```css
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(0.5rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.toast {
  animation: fade-in-up 200ms ease-out both;
}
```

- Prefer `both`/`forwards` fill-mode deliberately — know the end state.
- Name keyframes by intent (`fade-in-up`), not decoration (`anim1`).
- Avoid infinite animations except loaders; pause when offscreen if costly.

---

## 3) Compositor-Friendly Properties

| Prefer (often compositor) | Avoid in frequent animation |
|---------------------------|-----------------------------|
| `transform` | `top` / `left` / `right` / `bottom` |
| `opacity` | `width` / `height` |
| `filter` (sparingly) | `margin` / `padding` |
| `clip-path` (sparingly) | `border-width` |

```css
/* Good */
.panel--enter {
  transform: scale(0.98);
  opacity: 0;
}

/* Costly if animated continuously */
.panel--bad {
  height: 0; /* triggers layout */
}
```

- Promote sparingly with `will-change: transform` only while animating; remove afterward.
- Batch DOM reads/writes if JS drives motion; prefer CSS or WAAPI when possible.

---

## 4) View Transitions API

```css
@view-transition {
  navigation: auto; /* cross-document where supported */
}

::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 200ms;
}

.card {
  view-transition-name: card-hero;
}
```

```js
if (document.startViewTransition) {
  document.startViewTransition(() => {
    updateDOM()
  })
} else {
  updateDOM()
}
```

- Treat as progressive enhancement — always provide a non-VT path.
- Unique `view-transition-name` per concurrent morphing element.
- Keep transitions short; large shared-element morphs can feel sluggish.

---

## 5) Scroll-Driven Animations

```css
@keyframes grow-progress {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

.progress {
  transform-origin: inline-start;
  animation: grow-progress linear forwards;
  animation-timeline: scroll(root block);
}
```

```css
.reveal {
  animation: fade-in-up linear both;
  animation-timeline: view();
  animation-range: entry 0% entry 100%;
}
```

- Use for scroll progress and reveal effects; do not hide critical content solely behind scroll animation.
- Feature-detect or wrap in `@supports (animation-timeline: scroll())` when required.
- Pair with reduced-motion fallbacks that show the final state immediately.

---

## 6) `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  .toast,
  .reveal,
  .progress {
    animation: none !important;
    transition: none !important;
  }

  .button {
    transition: background-color 120ms ease-out;
  }
}
```

- Remove or drastically shorten non-essential motion.
- Keep instantaneous feedback (color/opacity snap) if it aids understanding.
- JS: `matchMedia('(prefers-reduced-motion: reduce)')` before starting WAAPI/rAF loops.

---

## 7) Final Self-Check

- Motion has a UX purpose; durations stay short.
- Hot animations use `transform`/`opacity`, not layout properties.
- View Transitions / scroll timelines degrade gracefully.
- `prefers-reduced-motion` disables or softens non-essential animation.
- No `transition: all`; no perpetual decorative motion competing with content.
