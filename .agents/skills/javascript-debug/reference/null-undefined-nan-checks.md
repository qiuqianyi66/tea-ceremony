# null / undefined / NaN Checks

## Symptom

Type checks behave unexpectedly:

```js
typeof null            // "object"  ❌ historical bug
NaN === NaN            // false
typeof NaN             // "number"
isNaN('hello')         // true — coerces first ❌
```

## Correct checks

```js
value === null                      // null only
value === undefined                 // undefined only
value == null                       // null OR undefined (the one valid use of ==)
Number.isNaN(value)                 // NaN only, no coercion ✅
Number.isFinite(value)              // real usable number ✅
Array.isArray(value)                // arrays (typeof says "object")
```

## NaN propagation

NaN silently poisons math chains:

```js
const total = price * quantity      // NaN if either is NaN
```

Catch it at the boundary where numbers enter the system:

```js
const qty = Number(input)
if (!Number.isFinite(qty)) throw new Error(`Invalid quantity: ${input}`)
```

`NaN` is also why `indexOf(NaN)` fails but `includes(NaN)` works — `includes` uses SameValueZero:

```js
[NaN].indexOf(NaN)    // -1 ❌
[NaN].includes(NaN)   // true ✅
```

## Defaults

`??` treats only `null`/`undefined` as missing; `||` also rejects `0`, `''`, `false`:

```js
const limit = options.limit ?? 10   // ✅ limit: 0 respected
const limit = options.limit || 10   // ❌ 0 becomes 10
```
