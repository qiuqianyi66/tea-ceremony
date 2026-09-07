# `return` Without `await` Escapes try/catch

## Symptom

A rejection isn't caught by the surrounding `try/catch`, even though the call is inside `try`:

```js
async function load() {
  try {
    return fetchData()        // ❌ rejection escapes this catch
  } catch (error) {
    return FALLBACK            // never runs for fetchData failures
  }
}
```

## Why

`return fetchData()` returns the **pending promise** immediately — the function's `try` block has already exited by the time the promise rejects. The rejection propagates to the caller, not to this `catch`.

## Fix

`return await` keeps the rejection inside the block:

```js
async function load() {
  try {
    return await fetchData()  // ✅ caught here
  } catch (error) {
    return FALLBACK
  }
}
```

Note: outside `try/catch` (and `finally`-sensitive code), plain `return promise` is fine — `return await` there only adds a tick. The rule is specifically: **inside try/catch/finally, always `return await`.**

## Related: throwing in async executors

```js
new Promise(async (resolve) => {       // ❌ anti-pattern
  throw new Error('lost')              // rejection swallowed
})
```

Never pass an async function to `new Promise` — an `async` function already returns a promise; use it directly.
