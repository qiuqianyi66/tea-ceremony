---
name: typescript-types
description: Use for advanced TypeScript type-level programming — utility types (Partial, Pick, Omit, Record, ReturnType, Awaited), constrained generics, mapped/conditional types, template literals, and discriminated unions. Load when designing reusable types, not basic annotations.
license: MIT
metadata:
  sources:
    - https://www.typescriptlang.org/docs/handbook/utility-types.html (TypeScript Handbook — Utility Types)
    - https://www.typescriptlang.org/docs/handbook/2/mapped-types.html (Mapped & Conditional Types)
  version: "1.0.0"
compatibility: TypeScript 5.x
---

# TypeScript Types — Advanced & Utility Types

> Build types the way you build functions: small, composable, named, and reused — not duplicated inline everywhere.

## Preferences

- Reach for a **built-in utility type** before writing a custom mapped/conditional type
- Name every non-trivial derived type — no anonymous multi-line inline types repeated across files
- Constrain generics (`<T extends X>`) instead of leaving them unbounded
- Prefer discriminated unions over optional-property "kitchen sink" object shapes
- Keep conditional types shallow — extract intermediate steps into named helper types

## Core Principles

- **Derive, don't duplicate:** if type B is "type A minus a few fields," derive it with a utility type, don't retype it.
- **Types should fail early:** a wrong generic argument should error at the call site, not three functions downstream.
- **Prefer composition of small utility types over one giant conditional type.**
- **Readability over cleverness:** a type gymnastics one-liner that nobody can explain in review is a liability.

---

## 1) Built-in Utility Types Cheat Sheet

```ts
interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'member'
}

type DraftUser = Partial<User>                        // all props optional
type NewUser = Omit<User, 'id'>                        // all props except id
type UserPreview = Pick<User, 'id' | 'name'>           // only id and name
type ReadonlyUser = Readonly<User>                     // all props readonly
type UsersById = Record<number, User>                  // uniform key/value map
type AdminOnly = Extract<User['role'], 'admin'>        // 'admin'
type NonAdmin = Exclude<User['role'], 'admin'>         // 'member'
type Nullable<T> = T | null
```

| Utility | Use for |
|---|---|
| `Partial<T>` | Patch/update payloads, form drafts |
| `Required<T>` | Ensuring all optional fields are filled (e.g. after defaults applied) |
| `Readonly<T>` | Immutable snapshots, frozen config |
| `Pick<T, K>` | Narrow a large type to a subset used by one component |
| `Omit<T, K>` | Remove fields (e.g. `id` before creation, `password` before sending to client) |
| `Record<K, V>` | Dictionaries/maps with known key type |
| `Extract<T, U>` | Filter a union down to members assignable to `U` |
| `Exclude<T, U>` | Remove members assignable to `U` from a union |
| `NonNullable<T>` | Strip `null`/`undefined` from a type |
| `ReturnType<F>` | Reuse a function's return shape without re-declaring it |
| `Parameters<F>` | Reuse a function's parameter tuple |
| `Awaited<P>` | Unwrap a `Promise<T>` (including nested promises) to `T` |
| `InstanceType<C>` | The instance type produced by a class constructor |

See [`references/utility-types-catalog.md`](references/utility-types-catalog.md) for the full catalog with more examples.

---

## 2) Generics with Constraints

```ts
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}

interface HasId {
  id: string
}

function findById<T extends HasId>(items: T[], id: string): T | undefined {
  return items.find((item) => item.id === id)
}

function createStore<T extends Record<string, unknown> = Record<string, unknown>>(initial: T) {
  let state = initial
  return {
    get: () => state,
    set: (next: Partial<T>) => { state = { ...state, ...next } },
  }
}
```

- Constrain (`extends`) instead of leaving `T` unbounded whenever the body relies on any property/shape of `T`.
- `K extends keyof T` for functions that access a dynamic property — this is what makes `getProperty` type-safe end to end.
- Give generics a sensible default (`T = Record<string, unknown>`) when most callers won't specify it explicitly.
- Name type parameters meaningfully in public/library APIs (`TItem`, `TKey`) beyond a single letter once there are 2+ params.

---

## 3) Mapped Types

```ts
type Optional<T> = { [K in keyof T]?: T[K] }
type Nullable<T> = { [K in keyof T]: T[K] | null }
type Getters<T> = { [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K] }

type FormErrors<T> = {
  [K in keyof T]?: string
}

const errors: FormErrors<User> = { email: 'Invalid email' }
```

- Mapped types transform every key of an existing type — use them for "same shape, different modifier/wrapper" patterns (all-optional, all-nullable, all-getters).
- Key remapping (`as`) lets you rename/filter keys while mapping — see the `Getters<T>` example.
- Prefer a named mapped type over repeating `{ [K in keyof T]: ... }` inline across the codebase.

See [`references/mapped-and-conditional-types.md`](references/mapped-and-conditional-types.md).

---

## 4) Conditional Types & `infer`

```ts
type ElementType<T> = T extends (infer U)[] ? U : never
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T

type ApiHandler<T> = T extends (...args: unknown[]) => infer R
  ? R extends Promise<infer Data>
    ? Data
    : R
  : never
```

- `infer` extracts a type from within a matched pattern — most commonly to unwrap arrays, promises, or function return types (prefer the built-in `Awaited<T>`/`ReturnType<T>` when they cover the case).
- Keep conditional types to 1–2 levels of nesting; extract intermediate branches into named helper types once it gets harder to read than the code it describes.
- Distributive conditional types (`T extends U ? X : Y` where `T` is a naked type parameter) apply per-union-member — know this before writing `Exclude`/`Extract`-like utilities.

See [`references/mapped-and-conditional-types.md`](references/mapped-and-conditional-types.md).

---

## 5) Template Literal Types

```ts
type Direction = 'top' | 'right' | 'bottom' | 'left'
type Margin = `margin-${Direction}`
// 'margin-top' | 'margin-right' | 'margin-bottom' | 'margin-left'

type EventName<T extends string> = `on${Capitalize<T>}`
type ClickHandler = EventName<'click'>   // 'onClick'

type RouteParam<T extends string> = T extends `${string}:${infer Param}/${infer Rest}`
  ? Param | RouteParam<Rest>
  : T extends `${string}:${infer Param}`
    ? Param
    : never

type Params = RouteParam<'/users/:id/posts/:postId'>  // 'id' | 'postId'
```

Use for generating string-union APIs (CSS property names, event names, route param extraction) instead of hand-maintaining a parallel literal union.

See [`references/template-literal-types.md`](references/template-literal-types.md).

---

## 6) Discriminated Unions for Complex State

```ts
type RequestState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string }

function render<T>(state: RequestState<T>): string {
  switch (state.status) {
    case 'idle': return 'Waiting to start'
    case 'loading': return 'Loading…'
    case 'success': return `Loaded ${JSON.stringify(state.data)}`
    case 'error': return `Failed: ${state.error}`
  }
}
```

Prefer this over `{ data?: T; error?: string; loading: boolean }` — the discriminated version makes `data` and `error` unreachable in the wrong state, both to the type checker and to a human reading the code.

---

## 7) Final Self-Check

- Reached for `Partial`/`Pick`/`Omit`/`Record`/`ReturnType`/`Awaited` before hand-rolling a mapped/conditional type.
- Every non-trivial derived type has a name and is reused, not copy-pasted.
- Generics are constrained (`extends`) whenever the function body relies on the shape of `T`.
- Conditional types are ≤2 levels deep, with named intermediate helpers if more is needed.
- Async/multi-state data modeled as a discriminated union, not independent optional flags.
- No type-level code that the author can't explain line by line in review.
