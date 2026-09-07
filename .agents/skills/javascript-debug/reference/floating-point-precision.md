# Floating Point Precision

## Symptom

```js
0.1 + 0.2 === 0.3        // ❌ false (0.30000000000000004)
19.99 * 100              // 1998.9999999999998
```

Totals drift by a cent; equality checks on computed decimals fail.

## Why

JavaScript numbers are IEEE 754 doubles. Many decimal fractions (0.1, 0.2) have no exact binary representation.

## Fix

**Money:** store and compute in integer minor units (cents/kopiykas):

```js
const totalCents = items.reduce((sum, i) => sum + i.priceCents, 0)
const display = (totalCents / 100).toFixed(2)
```

**Comparison:** use an epsilon, never `===` on computed floats:

```js
const approxEqual = (a, b, eps = Number.EPSILON * 4) => Math.abs(a - b) < eps
```

**Display rounding:** `value.toFixed(2)` returns a string; for numeric rounding use:

```js
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100
```

**Large integers:** beyond `Number.MAX_SAFE_INTEGER` (2^53−1) use `BigInt` — IDs from APIs lose precision silently:

```js
9007199254740993 === 9007199254740992 // ❌ true — precision lost
const id = BigInt('9007199254740993')  // ✅
```
