# Immutability & Array Methods

Treat data as immutable: derive new values instead of mutating shared state. It makes change tracking, testing, and reactivity predictable.

## Prefer non-mutating operations

| Goal | Use (immutable) | Avoid (mutates) |
|------|-----------------|-----------------|
| Add item | `[...list, item]` | `list.push(item)` |
| Remove item | `list.filter((x) => x.id !== id)` | `list.splice(i, 1)` |
| Update item | `list.map((x) => x.id === id ? { ...x, ...patch } : x)` | `list[i].foo = bar` |
| Sort | `[...list].sort(cmp)` | `list.sort(cmp)` |
| Reverse | `[...list].reverse()` | `list.reverse()` |
| Merge object | `{ ...a, ...b }` | `Object.assign(a, b)` |
| Omit key | `const { drop, ...rest } = obj` | `delete obj.drop` |

`sort`, `reverse`, `splice`, `push`, `pop`, `shift`, `unshift`, `fill`, `copyWithin` all mutate — copy first.

## Transformation methods over manual loops

```js
const active = users.filter((u) => u.isActive)
const names = active.map((u) => u.name)
const byId = users.reduce((acc, u) => ({ ...acc, [u.id]: u }), {})

const total = orders.reduce((sum, o) => sum + o.amount, 0)
const hasAdmin = users.some((u) => u.role === 'admin')
const allVerified = users.every((u) => u.verified)
const first = users.find((u) => u.id === id)
```

Choose the method that names the intent:

| Need | Method |
|------|--------|
| transform each | `map` |
| keep matching | `filter` |
| single value | `reduce` |
| first match | `find` / `findIndex` |
| any / all | `some` / `every` |
| flatten | `flat` / `flatMap` |

## When loops are right

Use `for...of` for side effects, early `break`/`continue`, or when awaiting sequentially. Don't force a `reduce` that hurts readability.

```js
for (const job of queue) {
  if (job.cancelled) continue
  await process(job)
}
```

## Building maps and sets

Prefer `Map` and `Set` over plain objects for dynamic keyed collections:

```js
const counts = new Map()
for (const tag of tags) {
  counts.set(tag, (counts.get(tag) ?? 0) + 1)
}

const unique = [...new Set(values)]
```

## Deep immutability

Spread is shallow. For nested updates, copy each level you touch:

```js
const next = {
  ...state,
  user: { ...state.user, address: { ...state.user.address, city } },
}
```

Use `Object.freeze` for true constants, or `structuredClone` for an independent deep copy when needed.
