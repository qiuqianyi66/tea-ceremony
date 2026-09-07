# Generic Inference Gotchas

## Inference fails silently, falling back to `unknown`

```ts
function firstOrDefault<T>(items: T[], fallback: T): T {
  return items.length > 0 ? items[0] : fallback
}

const result = firstOrDefault([], undefined)
// T inferred as `undefined` — not `never` or an error, just an unhelpful narrow type
```

When there's nothing in the arguments to anchor `T` to a meaningful type, TypeScript infers whatever it can from what's given — often `unknown` or a too-narrow type. Fix by supplying the type argument explicitly at the call site when inference has nothing to go on:

```ts
const result = firstOrDefault<number>([], 0)
```

## Multiple constraints pulling `T` in different directions

```ts
function merge<T>(a: T, b: T): T {
  return { ...a, ...b }
}

const merged = merge({ name: 'Ann' }, { age: 30 })
// TS2345 — `{ age: number }` is not assignable to `{ name: string }`
// TypeScript infers T from the FIRST argument, then checks the second against it
```

### Fix — use two type parameters when the shapes can differ

```ts
function merge<A, B>(a: A, b: B): A & B {
  return { ...a, ...b }
}

const merged = merge({ name: 'Ann' }, { age: 30 }) // { name: string } & { age: number }
```

## Generic return type not narrowing at the call site

```ts
function identity<T>(value: T): T {
  return value
}

const arr = identity([1, 2, 3])
// arr: number[] — fine

function wrapInPromise<T>(value: T): Promise<T> {
  return Promise.resolve(value)
}

async function run() {
  const value = await wrapInPromise('hello')
  // value: string — fine, Awaited<Promise<T>> resolves back to T
}
```

Generic inference through `Promise`/array/object wrappers usually works — when it doesn't, it's often because the generic parameter only appears in the return type, not in any parameter (nothing to infer `T` from):

```ts
function makeEmpty<T>(): T[] {
  return []
}

const empty = makeEmpty() // T inferred as `unknown` — nothing to infer from!
const numbers = makeEmpty<number>() // must specify explicitly
```

## Conditional type not resolving because `T` isn't concrete yet

```ts
type Unwrap<T> = T extends Promise<infer U> ? U : T

function process<T>(value: T): Unwrap<T> {
  // inside a generic function body, T is not yet a concrete type,
  // so `Unwrap<T>` doesn't resolve to a concrete branch here — this often requires a cast
  return value as Unwrap<T>
}
```

This is a known TypeScript limitation ("conditional types don't resolve on generic type parameters until instantiated") — an internal `as` cast at the point of return is a reasonable, contained workaround as long as the function's public signature stays accurate.
