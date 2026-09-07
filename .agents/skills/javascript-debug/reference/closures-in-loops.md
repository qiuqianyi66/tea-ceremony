# Closures in Loops Capture the Last Value

## Symptom

Every callback created in a loop sees the same (final) value:

```js
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0) // ❌ logs 3, 3, 3
}
```

## Why

`var` is function-scoped: all three callbacks close over the **same** `i`, which is `3` by the time they run.

## Fix

`let` creates a fresh binding per iteration:

```js
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0) // ✅ 0, 1, 2
}
```

Or avoid the index entirely:

```js
for (const item of items) {
  setTimeout(() => process(item), 0) // ✅
}
```

The same trap appears with listeners attached in loops, promise chains built in loops, and any deferred callback referencing the loop variable.
