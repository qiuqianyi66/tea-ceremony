# `this` Lost in Callbacks

## Symptom

`TypeError: Cannot read properties of undefined` when a class method is passed as a callback, or `this` is `undefined`/`window` inside it.

```js
class Timer {
  seconds = 0
  start() {
    setInterval(function () {
      this.seconds += 1 // ❌ this is not the Timer instance
    }, 1000)
  }
}

button.addEventListener('click', timer.start) // ❌ this lost when extracted
```

## Why

A regular `function` gets `this` from **how it is called**, not where it is defined. Passed as a plain callback, it's called without a receiver — `this` is `undefined` (strict mode) or the global object.

## Fix

Arrow functions inherit `this` lexically:

```js
start() {
  setInterval(() => {
    this.seconds += 1 // ✅
  }, 1000)
}
```

For extracted methods, bind at the call site or use an arrow wrapper:

```js
button.addEventListener('click', () => timer.start()) // ✅
// or
button.addEventListener('click', timer.start.bind(timer)) // ✅
```

Class field arrow methods auto-bind (one function per instance — fine for handlers):

```js
class Timer {
  start = () => { /* this is always the instance */ }
}
```
