# Microtasks vs Macrotasks

## Symptom

Code runs in an unexpected order:

```js
setTimeout(() => console.log('timeout'), 0)
Promise.resolve().then(() => console.log('promise'))
console.log('sync')
// sync → promise → timeout
```

UI doesn't repaint during a long chain of promise callbacks; `setTimeout(fn, 0)` is "slow".

## Why

The event loop processes queues in strict order:

1. Run current synchronous code to completion.
2. Drain the **entire microtask queue** (promise callbacks, `queueMicrotask`, `MutationObserver`).
3. Render if needed.
4. Take ONE **macrotask** (`setTimeout`, `setInterval`, I/O, events) → back to step 1.

Promise callbacks always beat timers. An endlessly self-scheduling microtask **starves rendering**; macrotasks don't.

## Practical rules

```js
queueMicrotask(() => { /* after current code, before render */ })
setTimeout(() => { /* after render, next macrotask */ }, 0)
requestAnimationFrame(() => { /* right before next paint */ })
```

- Need DOM measured **after** browser paints → `requestAnimationFrame` or double rAF.
- Need to yield so UI stays responsive in a heavy loop → `await new Promise(r => setTimeout(r))` (macrotask), not `await Promise.resolve()` (microtask — doesn't yield to render).
- `await x` resumes as a microtask — everything after `await` runs before any pending `setTimeout`.

## Debugging timing

Log queue position explicitly:

```js
console.log('A sync')
Promise.resolve().then(() => console.log('B micro'))
setTimeout(() => console.log('C macro'))
```

If a value is "stale" in a timer callback but fresh in a `.then`, you're reading it across different loop turns — capture the value when scheduling, not when running.
