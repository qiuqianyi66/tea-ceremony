# `interface` vs `type` — Decision Guide

Both declare the shape of a value. The differences that matter in practice:

| Capability | `interface` | `type` |
|---|---|---|
| Object shape | ✅ | ✅ |
| Extends / merges declarations | ✅ (`extends`, declaration merging) | ❌ |
| Union types | ❌ | ✅ |
| Tuple types | ❌ | ✅ |
| Mapped / conditional types | ❌ | ✅ |
| `implements` in a class | ✅ | ✅ (object types only) |
| Primitives / function types | ❌ | ✅ |

## When to use `interface`

```ts
interface User {
  id: number
  name: string
  email: string
}

interface AdminUser extends User {
  permissions: string[]
}

class ApiUser implements User {
  constructor(public id: number, public name: string, public email: string) {}
}
```

- Public API shapes a consumer might want to extend.
- Class contracts (`implements`).
- Declaration merging for augmenting third-party/global types:

```ts
// augmenting a library's type from your own module
declare module 'some-lib' {
  interface Options {
    myCustomFlag?: boolean
  }
}
```

## When to use `type`

```ts
type Role = 'admin' | 'member' | 'guest'
type Point = [x: number, y: number]
type Handler = (event: MouseEvent) => void
type ApiResult<T> = { data: T; error: null } | { data: null; error: string }
type PartialUser = Partial<User>
```

- Unions and discriminated unions.
- Tuples with named elements.
- Function type aliases.
- Derived/mapped types built from `Partial`, `Pick`, `Omit`, conditional types, etc.

## Declaration merging gotcha

```ts
interface Window {
  myGlobal: string
}
// Later, elsewhere in the codebase:
interface Window {
  anotherGlobal: number
}
// Both merge into one Window interface — can be surprising in large codebases.
```

This is a feature for augmenting ambient/global types, but avoid relying on it for your own domain types — prefer a single, explicit definition.

## Practical rule

Default to `interface` for anything that is "an object with these properties." Reach for `type` the moment you need a union, tuple, function signature, or a type derived via utility/mapped/conditional types. Don't fight the language by forcing one style everywhere.
