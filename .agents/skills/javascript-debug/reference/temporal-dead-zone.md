# Temporal Dead Zone (TDZ)

## Symptom

`ReferenceError: Cannot access 'x' before initialization` — even though the variable is declared in the same scope.

```js
function setup() {
  console.log(config) // ❌ ReferenceError
  const config = loadConfig()
}
```

## Why

`let`/`const` declarations are hoisted but **uninitialized** until their declaration line executes. The zone between scope entry and the declaration is the TDZ — any access throws.

`var` instead yields `undefined` silently (worse — hides the bug).

## Fix

Declare before use; keep declarations close to first usage:

```js
function setup() {
  const config = loadConfig()
  console.log(config) // ✅
}
```

Watch for sneaky TDZ cases:

```js
// default parameter referencing a later parameter
function f(a = b, b = 1) {} // ❌ TDZ on b

// class referenced before declaration
new Service() // ❌ classes are TDZ-bound too
class Service {}

// typeof is NOT safe for let/const (unlike undeclared vars)
typeof x // ❌ ReferenceError
let x
```
