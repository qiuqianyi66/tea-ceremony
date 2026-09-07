# Functions & Classes — Typing Patterns

## Optional & default parameters

```ts
function greet(name: string, greeting = 'Hello'): string {
  return `${greeting}, ${name}!`
}

function createUser(name: string, options?: { role?: Role; active?: boolean }): User {
  return { name, role: options?.role ?? 'member', active: options?.active ?? true }
}
```

- Required params first, optional/defaulted params last.
- 3+ optional params → switch to a single options object with an inline type.

## Rest parameters & tuples

```ts
function sum(...values: number[]): number {
  return values.reduce((total, v) => total + v, 0)
}

function connect(...args: [host: string, port: number, secure?: boolean]): void {
  /* ... */
}
```

## `this` parameter typing

```ts
interface Button {
  label: string
  onClick(this: Button, event: MouseEvent): void
}

const button: Button = {
  label: 'Save',
  onClick(event) {
    console.log(this.label) // `this` is typed as Button
  },
}
```

Use a `this` parameter (always first, never counted as a real argument) when a function's `this` binding is meaningful — common in DOM callbacks and object-method APIs.

## Overloads — only when the return type changes with the input type

```ts
function getElement(id: string): HTMLElement | null
function getElement(id: string, required: true): HTMLElement
function getElement(id: string, required?: boolean): HTMLElement | null {
  const el = document.getElementById(id)
  if (required && !el) throw new Error(`Element #${id} not found`)
  return el
}
```

If the body doesn't fork behavior based on the overload distinction, use a union parameter type instead — overloads add maintenance cost for no benefit.

## Generic functions

```ts
function firstOrDefault<T>(items: T[], fallback: T): T {
  return items.length > 0 ? items[0] : fallback
}

function groupBy<T, K extends PropertyKey>(items: T[], keyFn: (item: T) => K): Record<K, T[]> {
  const result = {} as Record<K, T[]>
  for (const item of items) {
    const key = keyFn(item)
    ;(result[key] ??= []).push(item)
  }
  return result
}
```

Let TypeScript infer the type parameter from the call site (`groupBy(users, (u) => u.role)`) — don't make callers pass `<T>` explicitly unless inference genuinely can't determine it.

## Classes: constructor parameter properties

```ts
class OrderService {
  constructor(
    private readonly http: HttpClient,
    private readonly logger: Logger = console,
  ) {}
}
```

Collapses field declaration + assignment into the constructor signature — use for dependencies injected once and never reassigned.

## Abstract classes vs interfaces

```ts
abstract class Repository<T> {
  abstract findById(id: string): Promise<T | null>

  async exists(id: string): Promise<boolean> {
    return (await this.findById(id)) !== null
  }
}

class UserRepository extends Repository<User> {
  async findById(id: string): Promise<User | null> {
    /* ... */
  }
}
```

Use an `abstract class` when subclasses share real implementation (like `exists` above); use an `interface` when there's no shared behavior to inherit — only a contract.

## Static, readonly, and access modifiers

```ts
class Cache<T> {
  static readonly DEFAULT_TTL_MS = 60_000
  #store = new Map<string, T>()

  get(key: string): T | undefined {
    return this.#store.get(key)
  }
}
```

Prefer `#private` fields for true encapsulation (enforced at runtime); use `private`/`protected` keywords mainly for constructor parameter properties and when interop with decorators/reflection requires it.
