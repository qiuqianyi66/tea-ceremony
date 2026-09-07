---
name: typescript-core
description: Use for TypeScript fundamentals — annotations, interfaces vs type aliases, unions, narrowing, functions, classes, enums, and strict-mode discipline. For utility/conditional types use typescript-types. For Vue SFC typing use typescript-vue.
license: MIT
metadata:
  sources:
    - https://www.typescriptlang.org/docs/handbook/ (TypeScript Handbook)
    - https://github.com/microsoft/TypeScript (TypeScript compiler & release notes)
  version: "1.0.0"
compatibility: TypeScript 5.x
---

# TypeScript Core — Best Practices

> Based on TypeScript 5.x with `strict: true`. Prefer inference over explicit annotation; prefer explicit annotation at public boundaries.

## Preferences

- `strict: true` (and all strict sub-flags) — never loosen without a written reason
- `interface` for object shapes that can be extended/implemented; `type` for unions, tuples, and mapped/derived shapes
- `unknown` over `any` at every untyped boundary (JSON, API responses, catch clauses)
- Let inference work for local variables; annotate function parameters and public return types
- `as const` and discriminated unions over loose string/boolean flags
- Never use non-null assertion (`!`) as a substitute for a real null check

## Core Principles

- **Types describe truth, not wishes:** don't cast or assert away an error — fix the shape or the logic.
- **Narrow, don't widen:** guard early so the compiler proves the rest of the function safe.
- **Make illegal states unrepresentable:** model data so invalid combinations can't compile.
- **`any` is a debt, not a shortcut:** isolate it, comment why, remove it before merge.
- **The compiler is a collaborator:** a red squiggle is information, not an obstacle to silence.

---

## 1) Type Annotations & Inference

```ts
const userCount = 3                          // inferred: number
const label: string = getLabel()             // annotate at boundaries

function createUser(name: string, role: Role = 'member'): User {
  return { name, role, active: true }
}
```

- Let TypeScript infer simple local variables (`const x = 5`) — don't annotate the obvious.
- Annotate function **parameters** always; annotate **return types** on exported/public functions so a signature change is caught at the definition, not at every call site.
- Avoid annotating object literals that are immediately assigned — let structural inference do the work, or state intent with a named type.

---

## 2) `interface` vs `type`

```ts
interface User {
  id: number
  name: string
  role: Role
}

interface AdminUser extends User {
  permissions: string[]
}

type Role = 'admin' | 'member' | 'guest'
type Point = [x: number, y: number]
type ApiResult<T> = { data: T; error: null } | { data: null; error: string }
```

- `interface` for object/class shapes meant to be extended (`extends`) or implemented (`implements`); interfaces merge declarations, which types cannot do.
- `type` for unions, tuples, function signatures, and mapped/conditional types — anything an `interface` structurally cannot express.
- Don't mix conventions per-project — pick object-shape default (`interface`) and stick to it; reach for `type` only when the shape requires it.

See [`references/interfaces-vs-types.md`](references/interfaces-vs-types.md).

---

## 3) Unions, Literals & Narrowing

```ts
type Status = 'idle' | 'loading' | 'success' | 'error'

function describe(status: Status): string {
  switch (status) {
    case 'idle': return 'Not started'
    case 'loading': return 'In progress'
    case 'success': return 'Done'
    case 'error': return 'Failed'
  }
}
```

- Model finite states as string-literal unions, not `boolean` flags (`isLoading`/`isError` pairs allow impossible combinations).
- Narrow with `typeof`, `instanceof`, `in`, discriminant property checks, or a custom type guard (`value is T`) — never a type assertion to "fix" a narrowing error.
- Exhaustiveness: add a `default: assertNever(status)` branch (a function taking `never`) so a new union member fails to compile until handled.

See [`references/narrowing.md`](references/narrowing.md).

---

## 4) Functions & Overloads

```ts
function parseId(value: string): number
function parseId(value: number): number
function parseId(value: string | number): number {
  return typeof value === 'string' ? Number.parseInt(value, 10) : value
}

const toLabel = (status: Status): string => STATUS_LABELS[status]
```

- Prefer a single parameter typed as a union over overloads when the body doesn't fork on the input type.
- Use overloads only when different input types produce genuinely different return types.
- Optional params (`age?: number`) go after required ones; prefer an options object once you have 3+ optional params.
- Type callback parameters explicitly when they aren't inferred from a generic (e.g. plain `Array.prototype` callbacks are inferred — custom higher-order functions may need annotation).

See [`references/functions-and-classes.md`](references/functions-and-classes.md).

---

## 5) Objects, Readonly & `as const`

```ts
const STATUS_LABELS = {
  idle: 'Not started',
  loading: 'In progress',
} as const

type StatusLabel = typeof STATUS_LABELS[keyof typeof STATUS_LABELS]

interface Config {
  readonly apiUrl: string
  readonly retries: number
}
```

- `as const` locks object/array literals to their literal types and makes them `readonly` — use it for lookup tables, config maps, and enum-like constants.
- `readonly` on interface properties and `ReadonlyArray<T>` / `readonly T[]` for data that must not be mutated after creation.
- Prefer `Record<K, V>` for uniform key/value maps over an interface with repeated similar properties.

---

## 6) Enums vs Union Literals

```ts
type Role = 'admin' | 'member' | 'guest'          // preferred: zero runtime cost

const enum Direction { Up, Down, Left, Right }     // avoid: const enum has tooling pitfalls

enum HttpStatus {                                  // acceptable: numeric enum needs a name/value pair
  Ok = 200,
  NotFound = 404,
}
```

- Default to string-literal unions — no runtime code, no enum-object footguns, tree-shakes cleanly.
- Avoid `const enum` (breaks with isolatedModules/most bundlers). If a real `enum` is required (e.g. bitflags, reverse lookup), use a regular `enum`.
- Never mix a numeric enum with untyped numbers from an external API without validating the value first.

---

## 7) Classes

```ts
class OrderService {
  #retries = 3

  constructor(private readonly http: HttpClient) {}

  async fetchOrder(id: string): Promise<Order> {
    return this.http.get<Order>(`/orders/${id}`)
  }
}
```

- Use `#field` (real private) over TypeScript's `private` keyword when true runtime privacy matters; use `private`/`readonly` constructor parameter properties to avoid boilerplate.
- Prefer composition over deep inheritance chains.
- Implement an `interface` explicitly (`class Foo implements Bar`) to get a compile error the moment the contract changes.

---

## 8) `unknown`, `any` & Type Assertions

```ts
async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url)
  return res.json()
}

function isUser(value: unknown): value is User {
  return typeof value === 'object' && value !== null && 'id' in value && 'name' in value
}

const data = await fetchJson('/api/user')
if (isUser(data)) {
  console.log(data.name)
}
```

- Type external/untrusted input (`fetch`, `JSON.parse`, `localStorage`) as `unknown`, then narrow with a type guard or schema validator (e.g. Zod) — never assume the shape.
- `any` disables checking for that value **and everything derived from it** — scope it to the smallest possible span, and prefer `unknown` + narrowing instead.
- Type assertions (`as T`) don't check anything at runtime — only use them when you have information the compiler cannot infer (e.g. `document.getElementById('app') as HTMLDivElement` right after a null check), never to silence a real mismatch.

---

## 9) Final Self-Check

- `strict: true`; no local loosening (`@ts-ignore`, `any`) without a comment explaining why.
- Object shapes as `interface`; unions/tuples/derived shapes as `type`.
- Finite states are literal unions with exhaustive `switch`, not boolean flag combinations.
- External/untrusted data typed `unknown` and narrowed via guards, not asserted.
- No `const enum`; enums only when a real runtime enum is required.
- Public function signatures have explicit parameter and return types.
- No non-null assertions (`!`) covering up a missing null check.
