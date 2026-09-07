# Loose Equality Coercion Traps

## Symptom

`==` produces surprising matches:

```js
'' == 0          // true
'0' == 0         // true
'' == '0'        // false (!)
[] == false      // true
[] == ![]        // true (!)
null == 0        // false
' \t ' == 0      // true
```

## Why

`==` runs the abstract equality algorithm: strings↔numbers coerce, objects call `valueOf`/`toString`, booleans become numbers. The results are consistent but impossible to keep in your head.

## Fix

Always `===` / `!==`. One deliberate exception:

```js
if (value == null) { /* matches null AND undefined — idiomatic */ }
```

Convert explicitly before comparing:

```js
if (Number(input) === 0) { /* ... */ }
if (String(code) === expected) { /* ... */ }
```

Related trap — implicit coercion in conditions:

```js
if (items.length)        // ok for arrays, but...
if (user.age)            // ❌ fails for age 0
if (user.age !== undefined) // ✅ explicit
```

And in `+`:

```js
1 + '2'    // '12' — string wins
'3' - 1    // 2 — minus coerces to number
```

Never rely on these; convert with `Number()` / `String()` first.
