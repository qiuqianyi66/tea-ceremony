# Objects Compare by Reference, Not Value

## Symptom

```js
{ a: 1 } === { a: 1 }            // ❌ false
[1, 2].includes([1, 2])           // wrong tool — always false for arrays
new Set([[1], [1]]).size          // 2, not 1
map.get({ id: 1 })                // undefined — different object key
```

## Why

`===` on objects/arrays compares **identity** (same reference), never contents. `Set`, `Map` keys, `includes`, `indexOf` all use this identity semantics.

## Fix

Compare by content explicitly:

```js
// shallow
const shallowEqual = (a, b) => {
  const ka = Object.keys(a), kb = Object.keys(b)
  return ka.length === kb.length && ka.every((k) => a[k] === b[k])
}

// by stable key
users.some((u) => u.id === target.id)

// find in collections by predicate, not identity
list.find((x) => x.id === id)     // ✅ not list.includes(obj)
```

For `Map` lookups use primitive keys (`map.get(user.id)`), not object keys, unless you hold the exact same reference.

`JSON.stringify(a) === JSON.stringify(b)` works only for small, same-key-order plain data — don't use it as a general solution.
