---
name: typescript-testing
description: Use when writing Vitest tests in TypeScript — typing mocks (vi.fn<T>, Mocked<T>), expectTypeOf/assertType, typed fixtures, and avoiding `any` in test doubles. For plain-JS Vitest use javascript-testing; for Vue components use vue-testing.
license: MIT
metadata:
  sources:
    - https://vitest.dev/guide/mocking.html (Vitest Mocking Guide)
    - https://vitest.dev/api/expect-typeof.html (Vitest Type Testing API)
  version: "1.0.0"
compatibility: Vitest >=1.x / TypeScript 5.x
---

# TypeScript Testing — Typed Vitest Patterns

> Tests are consumers of your types too — a test with `any` mocks can hide the exact bug the type system would have caught in production code.

## Preferences

- `vi.fn<(...args) => ReturnType>()` typed explicitly, or infer from `vi.mocked(realFn)`
- `Mocked<T>` / `MockedFunction<T>` / `MockedObject<T>` from `vitest` over hand-rolled mock interfaces
- `expectTypeOf` / `assertType` for testing exported types themselves, not just runtime values
- Typed factory functions (`makeUser(overrides?: Partial<User>): User`) over untyped object literals in fixtures
- Narrow `unknown` test inputs the same way production code would — don't cast fixtures with `as any`

## Core Principles

- **A test double must satisfy the real interface** — a mock typed as `any` can silently drift from the thing it replaces.
- **Type tests catch API regressions runtime tests can't** — a generic function returning the wrong inferred type won't necessarily throw, but it will break every consumer's inference.
- **Fixtures are code:** typed factories catch a renamed/removed field at compile time, before the test even runs.

---

## 1) Typing `vi.fn()`

```ts
import { vi, expect, it } from 'vitest'

interface SendEmail {
  (to: string, subject: string): Promise<{ ok: boolean }>
}

const sendEmail = vi.fn<SendEmail>().mockResolvedValue({ ok: true })

it('sends an email', async () => {
  await sendEmail('a@b.com', 'Welcome')
  expect(sendEmail).toHaveBeenCalledWith('a@b.com', 'Welcome')
})
```

- `vi.fn<Signature>()` types both the parameters and return type of the mock — calling it with the wrong argument types is now a compile error, same as the real function.
- For a function that already exists, prefer deriving the type instead of re-declaring it: `vi.fn<typeof realSendEmail>()`.

## 2) `vi.mocked` for module mocks

```ts
import { vi, it, expect } from 'vitest'
import { fetchUser } from './api'

vi.mock('./api')

it('loads a user', async () => {
  vi.mocked(fetchUser).mockResolvedValue({ id: 1, name: 'Ann' })

  const user = await fetchUser(1)

  expect(user.name).toBe('Ann')
})
```

`vi.mocked(fn)` returns the same function with its type narrowed to include Vitest's mock methods (`mockResolvedValue`, `mockReturnValue`, etc.) — this is the type-safe alternative to casting `fetchUser as any`.

## 3) `Mocked<T>` for object/class dependencies

```ts
import { vi, it, expect, type Mocked } from 'vitest'

interface HttpClient {
  get<T>(url: string): Promise<T>
  post<T>(url: string, body: unknown): Promise<T>
}

function createHttpClientMock(): Mocked<HttpClient> {
  return {
    get: vi.fn(),
    post: vi.fn(),
  }
}

it('creates an order', async () => {
  const http = createHttpClientMock()
  http.post.mockResolvedValue({ id: '1' })

  const service = new OrderService(http)
  const order = await service.create({ items: [] })

  expect(http.post).toHaveBeenCalledWith('/orders', { items: [] })
  expect(order.id).toBe('1')
})
```

`Mocked<HttpClient>` requires every method to be provided as a mock function — if `HttpClient` gains a new method, the factory fails to compile until it's added, keeping the test double in sync with the real interface.

## 4) Typed Fixture Factories

```ts
interface User {
  id: number
  name: string
  role: 'admin' | 'member'
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    name: 'Ann',
    role: 'member',
    ...overrides,
  }
}

it('flags admins', () => {
  const admin = makeUser({ role: 'admin' })
  expect(isAdmin(admin)).toBe(true)
})
```

- `Partial<User>` overrides keeps the factory call sites short while still type-checking every field a test actually customizes.
- Prefer factories over shared mutable fixture objects — each test gets an independent object, and renamed fields fail at the factory's return type, not at some unrelated assertion.

## 5) Type-Only Testing with `expectTypeOf` / `assertType`

```ts
import { expectTypeOf, it } from 'vitest'
import { groupBy } from './group-by'

it('groupBy return type matches input element type', () => {
  const result = groupBy([{ id: 1 }], (x) => x.id)
  expectTypeOf(result).toEqualTypeOf<Record<number, { id: number }[]>>()
})

it('mergeConfig requires matching option shape', () => {
  assertType<{ retries: number }>(mergeConfig({ retries: 3 }))
})
```

- `expectTypeOf` runs at compile time (via `vitest --typecheck` or the TS language service) — it fails the build if a generic function's inferred return type drifts, even if no runtime assertion would catch it.
- Use for library-grade utilities (generic helpers, composables, utility types) where the *type* of the output is as important as its runtime value.

## 6) Testing Discriminated Union Handlers

```ts
type RequestState<T> =
  | { status: 'idle' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string }

it.each<[RequestState<number>, string]>([
  [{ status: 'idle' }, 'Waiting'],
  [{ status: 'success', data: 42 }, 'Loaded 42'],
  [{ status: 'error', error: 'Network' }, 'Failed: Network'],
])('renders %j as %s', (state, expected) => {
  expect(render(state)).toBe(expected)
})
```

Typing the `it.each` tuple (`[RequestState<number>, string][]`) catches a malformed fixture (e.g. `{ status: 'success' }` missing `data`) before the test even runs, instead of failing with a confusing runtime message.

## 7) Avoid `any` in Test Doubles

```ts
// avoid — silently allows a shape mismatch with the real dependency
const repo: any = { findById: vi.fn().mockResolvedValue({ id: 1 }) }

// prefer — a partial-but-typed stub, extended only as needed
const repo: Pick<UserRepository, 'findById'> = {
  findById: vi.fn().mockResolvedValue({ id: 1, name: 'Ann', role: 'member' }),
}
```

`Pick<Interface, 'methodUsed'>` types exactly the slice of the dependency the test needs, without requiring a full mock of every method on a large interface.

---

## 8) Final Self-Check

- Mocks are typed via `vi.fn<Signature>()`, `vi.mocked()`, or `Mocked<T>` — never `vi.fn() as any`.
- Fixture data comes from typed factory functions with `Partial<T>` overrides, not untyped object literals.
- Generic/library utilities have at least one `expectTypeOf`/`assertType` test locking down their inferred type.
- `it.each` tables are typed so malformed fixtures fail to compile, not just fail at runtime.
- No test double is typed `any` — use `Pick<T, K>` or `Mocked<T>` to type exactly what's needed.
