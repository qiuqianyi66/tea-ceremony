# Mutation Through Shared References

## Symptom

Changing a "copy" also changes the original; state mutates "by itself"; a default object accumulates values across calls.

```js
const copy = state            // ❌ not a copy — same reference
copy.user.name = 'X'          // state.user.name is also 'X'

const shallow = { ...state }
shallow.user.name = 'X'       // ❌ still shared — spread is one level deep
```

## Why

Assignment and spread copy **references** to nested objects, not the objects themselves. Two variables point to the same data.

## Fix

Copy as deep as you mutate:

```js
const next = { ...state, user: { ...state.user, name: 'X' } } // ✅
```

Independent full copy:

```js
const snapshot = structuredClone(state) // ✅ deep, handles Dates/Maps/Sets
```

## Classic variants of this bug

Shared default object:

```js
function createUser(opts = DEFAULTS) { // ❌ everyone shares DEFAULTS
  opts.createdAt = Date.now()
}
function createUser(opts = {}) {       // ✅ fresh object per call
  const config = { ...DEFAULTS, ...opts }
}
```

`fill` with an object:

```js
const grid = Array(3).fill([])   // ❌ 3 references to ONE array
grid[0].push(1)                  // all three rows get 1

const grid = Array.from({ length: 3 }, () => []) // ✅
```

Caching/logging live objects:

```js
console.log(state)               // ❌ DevTools shows the value at expand time
console.log(structuredClone(state)) // ✅ snapshot
```
