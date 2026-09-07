# forEach Doesn't Await Async Callbacks

## Symptom

Code after `forEach` runs before the async work finishes; results are empty; errors vanish.

```js
async function saveAll(items) {
  items.forEach(async (item) => {
    await api.save(item)      // ❌ nobody awaits these
  })
  console.log('done')          // ❌ logs immediately
}
```

## Why

`forEach` ignores the return value of its callback. The async callbacks return promises that are dropped — they run in the background, unawaited and unhandled.

Same applies to `map` **without** `Promise.all`, `filter`, `some`, `every`, `reduce` with async callbacks (they receive promises, not values).

## Fix

Sequential (order matters / throttling):

```js
for (const item of items) {
  await api.save(item)         // ✅
}
```

Parallel (independent):

```js
await Promise.all(items.map((item) => api.save(item))) // ✅
```

Async filter pattern:

```js
const flags = await Promise.all(items.map((i) => isValid(i)))
const valid = items.filter((_, idx) => flags[idx])      // ✅
```

Rule: an `async` callback only makes sense where the caller awaits the returned promise — `map` + `Promise.all` yes, `forEach`/`filter`/`some` no.
