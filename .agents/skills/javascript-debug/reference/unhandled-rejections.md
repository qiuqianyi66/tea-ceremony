# Unhandled Promise Rejections

## Symptom

Console shows `Uncaught (in promise) Error: ...`; in Node ≥15 the process **crashes** with `UnhandledPromiseRejection`.

```js
async function refresh() { /* may throw */ }

setInterval(refresh, 5000)            // ❌ rejections unhandled
button.onclick = refresh               // ❌ same
refresh()                              // ❌ fire-and-forget
```

## Why

Every promise needs a consumer. Async functions called from non-async contexts (timers, event handlers, top-level fire-and-forget) return promises nobody awaits — a rejection has nowhere to go.

## Fix

Handle at the boundary where async meets sync:

```js
setInterval(() => {
  refresh().catch((e) => logger.error('refresh failed', e)) // ✅
}, 5000)

button.addEventListener('click', async () => {
  try {
    await refresh()                    // ✅
  } catch (e) {
    showToast('Update failed')
  }
})
```

For intentional fire-and-forget, make it explicit:

```js
void refresh().catch(reportError)
```

## Global safety net (reporting only, not control flow)

```js
// browser
window.addEventListener('unhandledrejection', (e) => {
  reportError(e.reason)
})

// node
process.on('unhandledRejection', (reason) => {
  logger.fatal(reason)
  process.exit(1)
})
```

## Promise.all trap

`Promise.all` rejects on the first failure, but the **other** promises keep running; if they also reject, those rejections are handled internally — fine. The trap is constructing promises before the `all`:

```js
const a = taskA()           // started
const b = taskB()           // started
await a                     // if b rejects HERE, it's unhandled
await b
// ✅ use: const [ra, rb] = await Promise.all([a, b])
```
