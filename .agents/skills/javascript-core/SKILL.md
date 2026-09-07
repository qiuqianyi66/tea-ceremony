---
name: javascript-core
description: Use for modern JavaScript (ES2020+) — declarations, naming, ES modules, async/await, immutable updates, array methods, and language pitfalls. Load for plain JS or Node scripts that are not framework-specific.
license: MIT
metadata:
  sources:
    - https://mcpmarket.com/tools/skills/javascript-best-practices (JavaScript Best Practices skill)
    - https://developer.mozilla.org/en-US/docs/Web/JavaScript (MDN reference)
  version: "1.0.0"
compatibility: ECMAScript 2020+ / Node.js >=18
---

# JavaScript Core — Best Practices

> Modern ESNext. Prioritize clarity and maintainability over clever one-liners.

## Preferences

- `const` by default, `let` only when reassigned — never `var`
- ES modules (`import`/`export`) — never CommonJS in new code
- `async/await` over raw `.then()` chains
- Strict equality `===` — never `==`
- Pure functions and immutable updates over in-place mutation
- JSDoc for public APIs when not using TypeScript

## Core Principles

- **Readability first:** self-documenting names beat clever syntax and comments.
- **No hidden side effects:** a function either returns a value or performs effects — not both silently.
- **Fail loud, fail early:** validate inputs and throw real `Error` objects.
- **Immutability by default:** derive new data instead of mutating shared state.
- **One responsibility per function/module.**

---

## 1) Variable Declarations

```js
const MAX_RETRIES = 3
let attempt = 0

while (attempt < MAX_RETRIES) {
  attempt += 1
}
```

Rules:
- Default to `const`; reach for `let` only when a binding is reassigned.
- Never use `var` (function-scoped, hoisted, error-prone).
- One declaration per concept — avoid comma-chained declarations.
- Declare close to first use, not at the top of the function.

---

## 2) Naming Conventions

| Kind | Convention | Example |
|------|-----------|---------|
| Variables / functions | `camelCase` | `userCount`, `fetchOrders` |
| Classes / constructors | `PascalCase` | `OrderService` |
| Module-level constants | `UPPER_SNAKE_CASE` | `MAX_RETRIES`, `API_BASE_URL` |
| Private (convention) | `#field` or `_prefix` | `#token`, `_cache` |
| Booleans | `is/has/can/should` prefix | `isActive`, `hasAccess` |
| Async functions | verb describing the action | `loadUser`, `saveDraft` |

- Names describe intent, not type (`users`, not `userArray`).
- Avoid abbreviations except universally known ones (`id`, `url`, `db`).

See [`references/naming-conventions.md`](references/naming-conventions.md).

---

## 3) Equality & Coercion

```js
if (value === undefined) { /* ... */ }

const count = Number(input)
if (Number.isNaN(count)) throw new Error('Invalid count')
```

- Always `===` / `!==`. The single exception: `value == null` to match `null` **or** `undefined`.
- Convert types explicitly: `Number()`, `String()`, `Boolean()`.
- Use `Number.isNaN` / `Number.isInteger`, never the global `isNaN`.
- Avoid truthy checks for numbers (`0`) and strings (`''`) — be explicit.

---

## 4) Functions

```js
const toFullName = ({ first, last }) => `${first} ${last}`

function createUser(name, { role = 'member', active = true } = {}) {
  return { name, role, active }
}
```

- Prefer arrow functions for callbacks and short pure helpers.
- Use named `function` declarations for top-level, reusable, or recursive logic.
- Default parameters and an options object instead of long positional arg lists (max ~3 positional).
- Avoid nested ternaries — use early returns or a lookup map.

```js
const label = {
  draft: 'Draft',
  published: 'Live',
  archived: 'Archived',
}[status] ?? 'Unknown'
```

---

## 5) Objects & Destructuring

```js
const { id, name, role = 'guest' } = user
const updated = { ...user, role: 'admin' }
const { password, ...safeUser } = user
```

- Destructure to pull out only what you use.
- Spread to copy/merge; never mutate the source.
- Use optional chaining `?.` and nullish coalescing `??` together: `user?.address?.city ?? 'N/A'`.
- Avoid `delete` on hot objects — prefer rest destructuring to omit keys.

---

## 6) Async Patterns

```js
async function loadDashboard(userId) {
  const [profile, stats] = await Promise.all([
    fetchProfile(userId),
    fetchStats(userId),
  ])
  return { profile, stats }
}
```

- `async/await` for sequential logic; `Promise.all` for independent work.
- Wrap awaits that can fail in `try/catch`; rethrow or return a typed result.
- Never leave a promise unhandled — `await` it, return it, or `.catch()` it.
- Use `Promise.allSettled` when partial failure is acceptable.
- Don't `await` inside a loop for independent iterations — map to promises and `Promise.all`.

See [`references/async-patterns.md`](references/async-patterns.md).

---

## 7) Immutability & Arrays

```js
const active = users.filter((u) => u.isActive)
const names = active.map((u) => u.name)
const total = orders.reduce((sum, o) => sum + o.amount, 0)

const sorted = [...users].sort((a, b) => a.age - b.age)
```

- Use `map` / `filter` / `reduce` / `find` / `some` / `every` over manual loops for transformations.
- Copy before `sort`/`reverse`/`splice` — they mutate in place.
- Build new arrays/objects with spread instead of `push`/`Object.assign` on shared state.
- Reserve `for...of` for side effects or early `break`.

See [`references/immutability-and-arrays.md`](references/immutability-and-arrays.md).

---

## 8) ES Modules

```js
// utils/format.js
export function formatPrice(value, currency = 'USD') { /* ... */ }
export const DEFAULT_LOCALE = 'en-US'

// one default only when the module has a single primary export
export default class OrderService { /* ... */ }
```

- Prefer named exports — they tree-shake and refactor cleanly.
- One default export max; avoid mixing many named + default.
- No side effects at import time (no network calls / DOM access on load).
- Keep import order: built-ins → external → internal, with internal using path aliases.

See [`references/modules.md`](references/modules.md).

---

## 9) Error Handling

```js
class ValidationError extends Error {
  constructor(message, field) {
    super(message)
    this.name = 'ValidationError'
    this.field = field
  }
}

try {
  await save(form)
} catch (error) {
  if (error instanceof ValidationError) {
    showFieldError(error.field, error.message)
    return
  }
  throw error
}
```

- Throw `Error` (or subclasses), never strings or plain objects.
- Catch narrowly; rethrow what you can't handle.
- Don't swallow errors with empty `catch {}`.

---

## 10) Final Self-Check

- `const`/`let` only, no `var`.
- Strict equality everywhere (except deliberate `== null`).
- Names express intent; constants in `UPPER_SNAKE_CASE`.
- No nested ternaries or implicit coercion.
- Async code awaited/handled; independent work parallelized.
- Data updated immutably; array methods over manual loops.
- Named ES module exports; no import-time side effects.
- Errors are real `Error` objects, caught narrowly.
