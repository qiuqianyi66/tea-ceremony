---
name: typescript-debug
description: TypeScript compiler error decoding guide — common TS error codes (TS2345, TS2322, TS2769, TS18048, TS2739), any-vs-unknown confusion, non-null assertion pitfalls, type widening surprises, structural typing gotchas, and excess property checks. Use when diagnosing a confusing TypeScript compiler error or unexpected type-checking behavior.
license: MIT
metadata:
  sources:
    - https://www.typescriptlang.org/docs/handbook/ (TypeScript Handbook)
    - https://github.com/microsoft/TypeScript/wiki/FAQ (TypeScript FAQ)
  version: "1.0.0"
---

# TypeScript Debug — Compiler Error Guide

Language-level TypeScript pitfalls and how to decode common compiler errors.
For best-practice patterns use `typescript-core`/`typescript-types`. For Vue-specific typing issues use `typescript-vue`.

### Assignability Errors
- "Type X is not assignable to type Y" on an object literal that looks correct → See [excess-property-checks](reference/excess-property-checks.md)
- TS2345 "Argument of type X is not assignable to parameter of type Y" → See [assignability-errors](reference/assignability-errors.md)
- TS2769 "No overload matches this call" with a confusing list of candidates → See [assignability-errors](reference/assignability-errors.md)

### Nullability
- TS18048 "X is possibly undefined" after what looks like a null check → See [nullability-and-narrowing](reference/nullability-and-narrowing.md)
- `!` (non-null assertion) hides a real runtime crash → See [non-null-assertion-pitfalls](reference/non-null-assertion-pitfalls.md)
- TS2532 "Object is possibly undefined" on an array/index access → See [nullability-and-narrowing](reference/nullability-and-narrowing.md)

### Type Widening & Inference
- A literal type becomes a wider type unexpectedly (`'admin'` → `string`) → See [type-widening](reference/type-widening.md)
- Generic function returns `unknown`/`{}` instead of the specific type → See [generic-inference-gotchas](reference/generic-inference-gotchas.md)

### `any` vs `unknown`
- `any` silently disables checking on everything derived from a value → See [any-vs-unknown](reference/any-vs-unknown.md)
- `unknown` from `JSON.parse`/`fetch` won't let you access properties → See [any-vs-unknown](reference/any-vs-unknown.md)

### Structural Typing
- Two seemingly unrelated interfaces are assignable to each other → See [structural-typing-surprises](reference/structural-typing-surprises.md)
- A class instance satisfies an interface it never declared `implements` → See [structural-typing-surprises](reference/structural-typing-surprises.md)

### Strategy

1. Read the **first** error in a cascade first — later errors are often downstream consequences of the first mismatch.
2. Hover the failing expression in the editor before reading the error text — the inferred type at that point is often the real clue.
3. For "no overload matches this call," check the **last** overload's error message — TS reports the one it thinks is the closest match.
4. Isolate: extract the failing expression into a `const x: ExpectedType = expression` on its own line to get a cleaner, single error.
5. Use `// @ts-expect-error` (not `@ts-ignore`) when an error is truly expected/intentional — it fails the build if the error ever disappears (meaning the underlying issue was fixed and the suppression is now stale).
