---
name: javascript-debug
description: JavaScript debugging guide for runtime errors, silent bugs, and language pitfalls. Covers this-binding, closures in loops, TDZ, floating point, equality traps, mutation-by-reference, event loop timing (microtasks vs macrotasks), async pitfalls, and NaN/null/undefined confusion. Use when diagnosing unexpected JavaScript behavior, TypeError, ReferenceError, stale values, or timing bugs.
license: MIT
metadata:
  sources:
    - https://developer.mozilla.org/en-US/docs/Web/JavaScript (MDN reference)
  version: "1.0.0"
---

# JavaScript Debug — Troubleshooting Guide

Language-level pitfalls and runtime bugs in plain JavaScript.
For development best practices, use `javascript-core`. For Vue-specific issues, use `vue-debug`.

### `this` & Scope
- `this` is undefined inside a callback or extracted method → See [this-lost-in-callbacks](reference/this-lost-in-callbacks.md)
- All loop callbacks see the last value of the variable → See [closures-in-loops](reference/closures-in-loops.md)
- ReferenceError before a `let`/`const` declaration line → See [temporal-dead-zone](reference/temporal-dead-zone.md)

### Equality & Types
- `0.1 + 0.2 !== 0.3`, money math drifts → See [floating-point-precision](reference/floating-point-precision.md)
- Two identical objects/arrays are never equal → See [reference-equality](reference/reference-equality.md)
- `typeof null` is "object", NaN never equals itself → See [null-undefined-nan-checks](reference/null-undefined-nan-checks.md)
- Comparisons behave strangely with `==` → See [loose-equality-coercion](reference/loose-equality-coercion.md)

### Mutation & Copies
- Changing a copy also changes the original → See [mutation-by-reference](reference/mutation-by-reference.md)
- `sort()` reordered the source array unexpectedly → See [mutating-array-methods](reference/mutating-array-methods.md)

### Async & Event Loop
- `setTimeout(fn, 0)` runs after promise callbacks → See [microtasks-vs-macrotasks](reference/microtasks-vs-macrotasks.md)
- `forEach` with async callback doesn't wait → See [foreach-async-not-awaited](reference/foreach-async-not-awaited.md)
- Error thrown in async code isn't caught by try/catch → See [return-await-try-catch](reference/return-await-try-catch.md)
- Promise rejection crashes with "unhandled rejection" → See [unhandled-rejections](reference/unhandled-rejections.md)

### Numbers & JSON
- `parseInt` gives wrong results without radix or on large numbers → See [parseint-and-number-parsing](reference/parseint-and-number-parsing.md)
- Dates, Maps, undefined disappear after JSON round-trip → See [json-serialization-losses](reference/json-serialization-losses.md)

### Strategy

1. Reproduce in isolation — smallest possible snippet.
2. `console.log` shows live references — use `structuredClone(obj)` or `JSON.parse(JSON.stringify(obj))` to snapshot.
3. Use `debugger` + browser DevTools breakpoints over log-guessing.
4. Check the exact error class: `TypeError` (wrong shape), `ReferenceError` (scope/TDZ), `RangeError` (recursion/size).
5. For timing bugs, log with `performance.now()` and queue position in mind (microtask vs macrotask).
