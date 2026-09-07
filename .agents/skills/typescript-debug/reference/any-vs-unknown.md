# `any` vs `unknown`

## `any` disables checking for everything derived from it

```ts
function parse(json: string): any {
  return JSON.parse(json)
}

const data = parse('{"id": 1}')
data.nam.toUpperCase() // no compile error — typo `nam` instead of `name`, crashes at runtime
```

`any` is contagious — once a value is `any`, every property access, method call, and value derived from it is also silently `any`, anywhere it flows in the codebase.

## `unknown` forces a check before use

```ts
function parse(json: string): unknown {
  return JSON.parse(json)
}

const data = parse('{"id": 1}')
data.id // TS18046: 'data' is of type 'unknown' — must narrow first
```

```ts
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

const data = parse('{"id": 1}')
if (isRecord(data) && typeof data.id === 'number') {
  console.log(data.id) // safe — narrowed step by step
}
```

`unknown` is the type-safe counterpart to `any`: it accepts any value (like `any`), but forbids using it until it's been narrowed to something more specific.

## Where each belongs

| Situation | Use |
|---|---|
| Boundary of untyped external data (`fetch`, `JSON.parse`, `localStorage`) | `unknown`, then narrow/validate |
| A `catch` clause error (TS 4.4+ defaults `catch (e)` to `unknown`) | `unknown`, narrow with `instanceof Error` |
| Genuinely untypeable legacy interop you're actively migrating away from | `any`, scoped as narrowly as possible, with a comment |
| A function parameter that truly accepts every type without inspection | Generic `<T>` — not `any`, so the return type stays connected to the input |

## `catch` clause typing

```ts
try {
  await save(form)
} catch (error) {
  // error: unknown by default with useUnknownInCatchVariables (default since TS 4.4)
  if (error instanceof ValidationError) {
    showFieldError(error.field, error.message)
  } else if (error instanceof Error) {
    logger.error(error.message)
  } else {
    logger.error('Unknown error', error)
  }
}
```

Never annotate a catch variable as `any` to "fix" this — narrow it the same way any other `unknown` value is narrowed.

## Migrating `any` to `unknown` incrementally

```ts
// legacy signature returning any
declare function legacyFetch(url: string): any

// wrap once at the boundary instead of spreading `any` everywhere
function fetchTyped<T>(url: string): T {
  return legacyFetch(url) as T
}
```

Contain the `any` to a single, clearly-named wrapper rather than letting it leak through every call site — this makes the eventual removal of the legacy dependency a one-file change.
