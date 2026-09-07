---
name: javascript-dom
description: Vanilla DOM manipulation best practices without a framework. Covers selectors, event delegation, classList/dataset, safe HTML rendering (no innerHTML XSS), forms and FormData, IntersectionObserver/ResizeObserver/MutationObserver, and element creation patterns. Load when working with document, querySelector, addEventListener, DOM events, forms, or browser UI code outside Vue/React.
license: MIT
metadata:
  sources:
    - https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model (MDN DOM reference)
  version: "1.0.0"
compatibility: Modern evergreen browsers (ES2020+)
---

# JavaScript DOM — Best Practices

> Framework-free DOM code. Cache lookups, delegate events, never build HTML from untrusted strings.

## Core Rules

- **Cache selectors** — query once, reuse the reference.
- **Delegate events** for dynamic lists — one listener on the container.
- **Never inject untrusted strings via `innerHTML`** — use `textContent` or `createElement`.
- **Always clean up** listeners, observers, and timers when elements are removed.
- **Batch DOM writes** — read first, then write; avoid layout thrashing.

---

## 1) Selecting Elements

```js
const form = document.querySelector('#checkout-form')
const items = document.querySelectorAll('.cart-item')

const submitBtn = form.querySelector('[type="submit"]')
```

- `querySelector` / `querySelectorAll` for everything; forget `getElementById` vs `getElementsByClassName` differences.
- `querySelectorAll` returns a static `NodeList` — convert with `[...items]` to use array methods.
- Scope queries to a container (`form.querySelector`) instead of the whole document.
- Guard against missing elements at boundaries: `if (!form) return`.

---

## 2) Creating & Updating Elements

```js
const card = document.createElement('article')
card.className = 'card'

const title = document.createElement('h2')
title.textContent = user.name

card.append(title)
list.append(card)
```

- `textContent` for text — it never executes HTML.
- `append` / `prepend` / `before` / `after` / `replaceWith` over legacy `appendChild`/`insertBefore`.
- Build fragments for bulk inserts:

```js
const fragment = document.createDocumentFragment()
for (const user of users) {
  fragment.append(renderUserCard(user))
}
list.replaceChildren(fragment)
```

- `replaceChildren()` clears and refills in one call — preferred over `innerHTML = ''`.
- For trusted static templates only, `insertAdjacentHTML('beforeend', html)` is acceptable.

### Safe HTML rule

```js
// bad — XSS if user.name contains markup
card.innerHTML = `<h2>${user.name}</h2>`

// good
const h2 = document.createElement('h2')
h2.textContent = user.name
card.append(h2)
```

---

## 3) Classes, Attributes, Dataset

```js
el.classList.add('is-active')
el.classList.toggle('is-open', isOpen)
el.classList.remove('is-hidden')

el.dataset.userId = String(user.id)
const id = Number(el.dataset.userId)

el.toggleAttribute('disabled', !isValid)
el.setAttribute('aria-expanded', String(isOpen))
```

- `classList` always — never string-concatenate `className`.
- `dataset` for custom data (`data-user-id` ↔ `dataset.userId`); values are always strings.
- Keep ARIA attributes in sync with visual state.

---

## 4) Events

### Listeners

```js
button.addEventListener('click', handleClick)
button.removeEventListener('click', handleClick)

window.addEventListener('scroll', onScroll, { passive: true })
input.addEventListener('input', onInput, { signal: controller.signal })
```

- Named functions so listeners can be removed.
- `{ passive: true }` for `scroll`/`touchmove` handlers that never call `preventDefault`.
- `{ once: true }` for one-shot handlers.
- `AbortController` signal to remove many listeners at once:

```js
const controller = new AbortController()
const { signal } = controller

form.addEventListener('input', validate, { signal })
form.addEventListener('submit', submit, { signal })

// teardown — removes both
controller.abort()
```

### Delegation

One listener on the container handles all current and future children:

```js
list.addEventListener('click', (event) => {
  const item = event.target.closest('[data-item-id]')
  if (!item || !list.contains(item)) return
  selectItem(item.dataset.itemId)
})
```

- `closest()` walks up from the actual target to the element you care about.
- Essential for dynamic lists — no re-binding after re-render.

### Custom events

```js
el.dispatchEvent(new CustomEvent('cart:add', {
  bubbles: true,
  detail: { productId },
}))

document.addEventListener('cart:add', (e) => addToCart(e.detail.productId))
```

---

## 5) Forms

```js
form.addEventListener('submit', async (event) => {
  event.preventDefault()

  const data = new FormData(form)
  const payload = Object.fromEntries(data)

  if (!form.checkValidity()) {
    form.reportValidity()
    return
  }

  await api.submit(payload)
  form.reset()
})
```

- `FormData` + `Object.fromEntries` — no manual field reading.
- Multi-value fields (checkbox groups): `data.getAll('tags')`.
- Use native constraint validation (`required`, `pattern`, `min`) before custom JS validation.
- Custom messages: `input.setCustomValidity('...')` then `reportValidity()`; clear with `''`.
- Read fields by name, not index: `form.elements.email`.

---

## 6) Observers

### IntersectionObserver — visibility, lazy loading, infinite scroll

```js
const io = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue
    entry.target.src = entry.target.dataset.src
    io.unobserve(entry.target)
  }
}, { rootMargin: '200px' })

for (const img of document.querySelectorAll('img[data-src]')) {
  io.observe(img)
}
```

### ResizeObserver — element size changes

```js
const ro = new ResizeObserver(([entry]) => {
  chart.resize(entry.contentRect.width, entry.contentRect.height)
})
ro.observe(chartContainer)
```

### MutationObserver — DOM tree changes (last resort)

Use only when you don't control the code mutating the DOM (third-party widgets).

**Always disconnect** observers when done: `io.disconnect()`, `ro.disconnect()`.

---

## 7) Performance & Layout

- Read layout values (`offsetWidth`, `getBoundingClientRect`) together, then write — interleaving forces reflow.
- Animate with CSS `transform`/`opacity`, not `top`/`left`/`width`.
- Visual updates in JS → `requestAnimationFrame`; never `setInterval` for animation.
- Hide/show many elements with a class on a parent, not per-element style writes.
- Prefer CSS for hover/focus/checked states — JS only for state CSS can't express.

---

## 8) Cleanup Checklist

When a component/widget is destroyed:

- Remove listeners (`AbortController.abort()` makes this one call).
- `disconnect()` all observers.
- `clearTimeout` / `clearInterval` pending timers.
- Drop element references held in module state (let GC work).

---

## 9) Final Self-Check

- Selectors cached and scoped; missing-element guards at boundaries.
- No untrusted strings in `innerHTML`.
- Dynamic lists use event delegation with `closest()`.
- Forms read via `FormData`; native validation used first.
- Lazy/visibility logic uses `IntersectionObserver`, not scroll math.
- Every listener/observer/timer has a teardown path.
