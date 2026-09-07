# Async Patterns

Use `async/await` as the default. Reach for the `Promise` combinators when coordinating multiple operations.

## await for sequential, Promise.all for parallel

```js
// dependent — must run in order
const user = await fetchUser(id)
const orders = await fetchOrders(user.id)

// independent — run together
const [profile, settings] = await Promise.all([
  fetchProfile(id),
  fetchSettings(id),
])
```

## Don't await in a loop for independent work

```js
// bad — serial, slow
const results = []
for (const id of ids) {
  results.push(await fetchUser(id))
}

// good — parallel
const results = await Promise.all(ids.map((id) => fetchUser(id)))
```

If iterations depend on each other, or you must throttle concurrency, a loop is correct — make the intent explicit.

## Combinators

| Method | Resolves when | Rejects when | Use for |
|--------|---------------|--------------|---------|
| `Promise.all` | all fulfil | any rejects | all-or-nothing fan-out |
| `Promise.allSettled` | all settle | never | partial failure is OK |
| `Promise.race` | first settles | first rejects | timeouts, first-wins |
| `Promise.any` | first fulfils | all reject | fallback sources |

```js
const results = await Promise.allSettled(ids.map(fetchUser))
const ok = results.filter((r) => r.status === 'fulfilled').map((r) => r.value)
```

## Error handling

```js
async function loadUser(id) {
  try {
    const res = await fetch(`/api/users/${id}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (error) {
    logger.error('loadUser failed', { id, error })
    throw error
  }
}
```

- Wrap awaits that can fail; rethrow what you can't handle.
- Never leave a promise floating — `await`, `return`, or `.catch()` it.
- Don't mix `await` and `.then()` in the same function.

## Timeouts and cancellation

Use `AbortController` to cancel in-flight requests:

```js
function withTimeout(promiseFactory, ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return promiseFactory(controller.signal).finally(() => clearTimeout(timer))
}

await withTimeout((signal) => fetch('/api/slow', { signal }), 5000)
```

## Avoid the async pitfalls

- `async` callbacks passed to `forEach` are not awaited — use `for...of` or `Promise.all(map(...))`.
- Returning inside `try` without `await` (`return fetch(...)`) escapes the surrounding `catch` — use `return await`.
- An `async` function always returns a promise; don't double-wrap with `new Promise`.
