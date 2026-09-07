---
name: javascript-performance
description: JavaScript performance optimization patterns. Covers debounce/throttle, memoization, lazy loading with dynamic import, requestAnimationFrame and requestIdleCallback, Web Workers for CPU-bound work, memory leak prevention (timers, listeners, closures, detached DOM), efficient data structures (Map/Set vs arrays), and measuring with performance.now and the Performance API. Load when optimizing slow code, fixing jank, reducing memory usage, or profiling JavaScript.
license: MIT
metadata:
  sources:
    - https://developer.mozilla.org/en-US/docs/Web/Performance (MDN Performance)
  version: "1.0.0"
compatibility: Modern browsers / Node.js >=18
---

# JavaScript Performance — Best Practices

> Measure first. Optimize the proven bottleneck, not the suspected one.

## Core Rules

- **Profile before optimizing** — DevTools Performance tab / `performance.now()`.
- **Don't block the main thread** — long sync work means frozen UI.
- **Rate-limit high-frequency events** — scroll/resize/input get debounce or throttle.
- **Cache pure computations** — memoize expensive deterministic functions.
- **Clean up everything you schedule** — timers, listeners, observers leak memory.

---

## 1) Measuring

```js
const start = performance.now()
expensiveWork()
console.log(`took ${(performance.now() - start).toFixed(1)}ms`)

performance.mark('parse-start')
parse(data)
performance.mark('parse-end')
performance.measure('parse', 'parse-start', 'parse-end')
```

- `performance.now()` — monotonic, sub-millisecond; never `Date.now()` for durations.
- Marks/measures show up in the DevTools Performance timeline.
- Benchmark realistic data sizes — O(n²) is invisible on 10 items, fatal on 10 000.

---

## 2) Debounce & Throttle

**Debounce** — run after the burst stops (search input, resize end, autosave):

```js
function debounce(fn, ms) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

input.addEventListener('input', debounce(search, 300))
```

**Throttle** — run at most once per interval (scroll position, mousemove, analytics):

```js
function throttle(fn, ms) {
  let last = 0
  return (...args) => {
    const now = Date.now()
    if (now - last < ms) return
    last = now
    fn(...args)
  }
}

window.addEventListener('scroll', throttle(updateProgress, 100), { passive: true })
```

Choosing: "react to the final state" → debounce; "react continuously but bounded" → throttle.
In projects with VueUse use `useDebounceFn` / `useThrottleFn` instead of hand-rolling.

---

## 3) Memoization

```js
function memoize(fn) {
  const cache = new Map()
  return (arg) => {
    if (cache.has(arg)) return cache.get(arg)
    const result = fn(arg)
    cache.set(arg, result)
    return result
  }
}

const parsePrice = memoize((raw) => heavyParse(raw))
```

- Only for **pure** functions — same input, same output, no side effects.
- Multi-arg keys: serialize deliberately (`args.join('|')`) or nest Maps — not `JSON.stringify` on hot paths.
- Bound the cache (LRU) when the input space is unbounded.
- Object-keyed caches → `WeakMap` so entries die with their keys:

```js
const layoutCache = new WeakMap()
function getLayout(node) {
  if (!layoutCache.has(node)) layoutCache.set(node, computeLayout(node))
  return layoutCache.get(node)
}
```

---

## 4) Scheduling Work

```js
// visual updates — sync with the frame
requestAnimationFrame(() => {
  el.style.transform = `translateX(${x}px)`
})

// non-urgent work — idle time
requestIdleCallback(() => prefetchNextPage(), { timeout: 2000 })
```

Chunk long loops so the UI can breathe:

```js
async function processInChunks(items, fn, chunkSize = 500) {
  for (let i = 0; i < items.length; i += chunkSize) {
    items.slice(i, i + chunkSize).forEach(fn)
    await new Promise((r) => setTimeout(r)) // yield a macrotask → render happens
  }
}
```

- Animation in rAF, never `setInterval`.
- A microtask yield (`await Promise.resolve()`) does NOT let the browser render — use a macrotask or `scheduler.yield()` where available.

---

## 5) Web Workers

CPU-bound work (parsing big JSON/CSV, diffing, image processing, crypto) off the main thread:

```js
// main.js
const worker = new Worker(new URL('./parser.worker.js', import.meta.url), { type: 'module' })

function parseInWorker(text) {
  return new Promise((resolve, reject) => {
    worker.onmessage = (e) => resolve(e.data)
    worker.onerror = reject
    worker.postMessage(text)
  })
}

// parser.worker.js
self.onmessage = (e) => {
  self.postMessage(heavyParse(e.data))
}
```

- Messages are structured-cloned — transfer big binary data instead: `postMessage(buf, [buf])`.
- Rule of thumb: sync work > ~50ms on the main thread → worker.

---

## 6) Memory Leaks

The usual suspects and their fixes:

| Leak | Fix |
|------|-----|
| `setInterval` never cleared | store id, `clearInterval` on teardown |
| listeners on long-lived targets (`window`, `document`) | remove on teardown; `AbortController` signal |
| observers never disconnected | `disconnect()` |
| detached DOM kept in variables/arrays | null out references after removal |
| unbounded caches/arrays (logs, history) | LRU / max length |
| closures capturing huge objects | extract only the fields you need |

```js
const controller = new AbortController()
window.addEventListener('resize', onResize, { signal: controller.signal })
const id = setInterval(poll, 5000)

function destroy() {
  controller.abort()
  clearInterval(id)
  observer.disconnect()
}
```

Diagnose: DevTools Memory → heap snapshot before/after suspected leak cycle → compare retained objects.

---

## 7) Data Structures & Hot Loops

```js
// O(n²) — find inside a loop
const enriched = orders.map((o) => ({ ...o, user: users.find((u) => u.id === o.userId) }))

// O(n) — index first
const byId = new Map(users.map((u) => [u.id, u]))
const enriched = orders.map((o) => ({ ...o, user: byId.get(o.userId) }))
```

- Repeated lookups → build a `Map` once.
- Membership checks → `Set.has` (O(1)) over `array.includes` (O(n)).
- In hot loops avoid: spread-accumulating (`acc = { ...acc }` in reduce — O(n²)), re-creating regexes/formatters, `try/catch` is fine (no longer deopts).
- Reuse `Intl.NumberFormat` / `Intl.DateTimeFormat` instances — construction is expensive.

---

## 8) Loading & Bundles

```js
// lazy-load heavy, rarely used code
const { default: ChartLib } = await import('./chart-lib.js')

// prefetch on intent
button.addEventListener('pointerenter', () => import('./editor.js'), { once: true })
```

- Dynamic `import()` for routes, modals, editors, admin panels.
- Tree-shaking needs named ES imports — `import { debounce } from 'lodash-es'`, never whole-package default imports.

---

## 9) Final Self-Check

- A measurement exists proving the bottleneck (before/after numbers).
- High-frequency events debounced/throttled with `{ passive: true }` where applicable.
- Pure expensive functions memoized with bounded caches.
- Main-thread sync work > 50ms moved to workers or chunked.
- Every timer/listener/observer has a teardown path.
- Hot loops use Map/Set indexes; no O(n²) accumulation.
- Heavy modules lazy-loaded via dynamic import.
