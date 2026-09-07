# Mutating Array Methods

## Symptom

Source data is reordered or shrinks after a seemingly read-only operation:

```js
const sorted = users.sort(byAge)   // ❌ users is now ALSO sorted
const last = items.splice(-1)      // ❌ removed from items
```

## Why

These methods mutate **in place** and return the same (or removed) array:

`sort`, `reverse`, `splice`, `push`, `pop`, `shift`, `unshift`, `fill`, `copyWithin`

`sort` returning the array makes it look pure — it isn't.

## Fix

Copy before mutating, or use the immutable counterparts (ES2023):

```js
const sorted = [...users].sort(byAge)      // ✅ classic
const sorted = users.toSorted(byAge)       // ✅ ES2023
const reversed = users.toReversed()        // ✅
const patched = users.toSpliced(i, 1)      // ✅
const updated = users.with(i, newItem)     // ✅
```

## Sort comparator trap

Default sort is **lexicographic** — even for numbers:

```js
[10, 9, 1].sort()             // ❌ [1, 10, 9]
[10, 9, 1].sort((a, b) => a - b) // ✅ [1, 9, 10]
```

Comparator must be consistent: return negative/zero/positive, never a boolean:

```js
arr.sort((a, b) => a > b)     // ❌ boolean — unstable results
arr.sort((a, b) => a - b)     // ✅
```
