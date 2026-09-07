---
name: javascript-testing
description: Vitest testing best practices for plain JavaScript (no framework components). Covers test structure (AAA), describe/it naming, vi.fn/vi.spyOn/vi.mock, fake timers, async testing with rejects/resolves, parametrized tests with it.each, setup/teardown, and what NOT to test. Load when writing unit tests, *.test.js / *.spec.js files, mocking modules, or testing async logic with Vitest or Jest-style APIs.
license: MIT
metadata:
  sources:
    - https://vitest.dev/guide/ (Vitest official documentation)
  version: "1.0.0"
compatibility: Vitest >=1.x (API is Jest-compatible)
---

# JavaScript Testing — Best Practices (Vitest)

> Test behavior, not implementation. One logical assertion focus per test.
> For Vue component testing use `vue-testing` — this skill covers plain JS logic.

## Core Rules

- **AAA structure** — Arrange, Act, Assert; visible in every test.
- **Test names describe behavior** — "returns null when user not found", not "test getUser 2".
- **No logic in tests** — no `if`/loops in a test body; use `it.each` instead.
- **Mock boundaries, not internals** — mock I/O (HTTP, fs, time), keep pure logic real.
- **Reset state between tests** — `vi.restoreAllMocks()`, fresh fixtures per test.
- **Async tests always await** — a forgotten `await` makes a test pass vacuously.

---

## 1) Structure & Naming

```js
import { describe, it, expect } from 'vitest'
import { calculateDiscount } from './pricing.js'

describe('calculateDiscount', () => {
  it('applies 10% discount for orders over 100', () => {
    const order = { total: 200, customer: 'regular' }

    const result = calculateDiscount(order)

    expect(result).toBe(20)
  })

  it('returns 0 for empty orders', () => {
    expect(calculateDiscount({ total: 0 })).toBe(0)
  })
})
```

- `describe` per unit (function/class), `it` per behavior.
- Blank lines separate Arrange / Act / Assert.
- Build test data with factory helpers, override only what matters:

```js
const makeOrder = (overrides = {}) => ({ total: 100, items: [], ...overrides })
```

## 2) Assertions

| Goal | Matcher |
|------|---------|
| primitives, references | `toBe` |
| objects/arrays by value | `toEqual` / `toStrictEqual` |
| partial object match | `toMatchObject`, `expect.objectContaining` |
| floats | `toBeCloseTo` |
| arrays | `toContain`, `toHaveLength` |
| errors | `toThrow(/message/)` |
| async errors | `await expect(p).rejects.toThrow()` |

```js
expect(user).toEqual({ id: 1, name: 'Ann' })
expect(users).toContainEqual(expect.objectContaining({ role: 'admin' }))
expect(() => parsePrice('abc')).toThrow('Invalid price')
```

- Prefer the most specific matcher — failure messages are better.
- Avoid `toBeTruthy` for concrete values — assert the actual value.

---

## 3) Mocks & Spies

```js
import { vi, beforeEach, afterEach } from 'vitest'

const sendEmail = vi.fn().mockResolvedValue({ ok: true })

const spy = vi.spyOn(logger, 'warn').mockImplementation(() => {})

afterEach(() => {
  vi.restoreAllMocks()
})
```

Module mock (hoisted — declare at top level):

```js
vi.mock('./api.js', () => ({
  fetchUser: vi.fn().mockResolvedValue({ id: 1 }),
}))

import { fetchUser } from './api.js'
```

Assertions on calls:

```js
expect(sendEmail).toHaveBeenCalledOnce()
expect(sendEmail).toHaveBeenCalledWith('a@b.com', expect.any(String))
expect(sendEmail).not.toHaveBeenCalled()
```

Rules:
- `vi.fn()` for injected dependencies; `vi.spyOn` to observe existing objects (restore after!).
- `vi.mock` only for true boundaries (HTTP clients, fs, SDKs).
- Don't assert call counts on internal helpers — that's testing implementation.

---

## 4) Async Testing

```js
it('loads user data', async () => {
  const user = await loadUser(1)
  expect(user.name).toBe('Ann')
})

it('rejects for unknown id', async () => {
  await expect(loadUser(999)).rejects.toThrow('Not found')
})

it('resolves with defaults', async () => {
  await expect(loadConfig()).resolves.toMatchObject({ retries: 3 })
})
```

- **Always `await` the `expect(...).rejects/resolves` chain** — without `await` the test exits early and passes.
- Never use the `done` callback style — return/await promises.

---

## 5) Fake Timers

```js
import { vi } from 'vitest'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

it('debounces calls', () => {
  const fn = vi.fn()
  const debounced = debounce(fn, 300)

  debounced()
  debounced()
  vi.advanceTimersByTime(300)

  expect(fn).toHaveBeenCalledOnce()
})

it('retries after delay', async () => {
  const promise = retryWithBackoff(failingTask)
  await vi.advanceTimersByTimeAsync(1000)
  await expect(promise).rejects.toThrow()
})
```

- `advanceTimersByTimeAsync` when timer callbacks contain awaits.
- Freeze "now": `vi.setSystemTime(new Date('2026-01-01'))` — date logic becomes deterministic.

---

## 6) Parametrized Tests

```js
it.each([
  ['', 0],
  ['a', 1],
  ['hello world', 2],
])('countWords(%j) → %i', (input, expected) => {
  expect(countWords(input)).toBe(expected)
})

it.each([
  { status: 400, retry: false },
  { status: 429, retry: true },
  { status: 503, retry: true },
])('status $status → retry: $retry', ({ status, retry }) => {
  expect(shouldRetry(status)).toBe(retry)
})
```

Use instead of copy-pasted tests or loops inside a test.

---

## 7) Setup / Teardown

```js
describe('UserRepository', () => {
  let repo

  beforeEach(() => {
    repo = new UserRepository(createInMemoryDb())
  })
})
```

- Fresh state in `beforeEach` — never share mutable fixtures across tests.
- `beforeAll` only for expensive read-only setup.
- Cleanup in `afterEach` must run even when a test fails — that's why it's a hook, not the test tail.
- Tests must pass in isolation and in any order: `vitest --sequence.shuffle`.

---

## 8) What NOT to Test

- Third-party libraries (axios works, lodash works).
- Private helpers directly — test through the public API.
- Exact log/message wording that changes often — assert on error class/code.
- Snapshot-everything — snapshots only for stable serializable output, reviewed like code.

---

## 9) Final Self-Check

- Names read as behavior specs; AAA visible.
- Most specific matcher used; no `toBeTruthy` on concrete values.
- Mocks only at boundaries; all restored after each test.
- Every async assertion awaited (`rejects`/`resolves` included).
- Time-dependent logic uses fake timers + `setSystemTime`.
- Repeated cases via `it.each`; zero logic in test bodies.
- Suite passes shuffled and in isolation.
