# Type Narrowing

Narrowing is how TypeScript proves that a broader type is actually a specific type inside a branch.

## `typeof` guards

```ts
function toDisplay(value: string | number): string {
  if (typeof value === 'string') return value.trim()
  return value.toFixed(2)
}
```

Works for `string`, `number`, `boolean`, `symbol`, `bigint`, `function`, `undefined`, `object`.

## `instanceof` guards

```ts
function handle(error: unknown): string {
  if (error instanceof ValidationError) return `Invalid: ${error.field}`
  if (error instanceof Error) return error.message
  return 'Unknown error'
}
```

## `in` operator guards

```ts
type Circle = { kind: 'circle'; radius: number }
type Square = { kind: 'square'; side: number }

function area(shape: Circle | Square): number {
  if ('radius' in shape) return Math.PI * shape.radius ** 2
  return shape.side ** 2
}
```

## Discriminated unions (preferred over `in`/`instanceof` for custom shapes)

```ts
type Shape = Circle | Square

function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle': return Math.PI * shape.radius ** 2
    case 'square': return shape.side ** 2
  }
}
```

A shared literal discriminant (`kind`) is the most reliable narrowing mechanism — it works with `switch`, autocompletes the remaining cases, and requires no runtime helper.

## Custom type guards (`value is T`)

```ts
interface User {
  id: number
  name: string
}

function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value
  )
}

function process(input: unknown) {
  if (isUser(input)) {
    console.log(input.name) // narrowed to User
  }
}
```

Use for validating `unknown` data (API responses, `JSON.parse` output) at runtime — the guard body is the single source of truth for the shape check.

## Assertion functions

```ts
function assertIsUser(value: unknown): asserts value is User {
  if (!isUser(value)) throw new Error('Not a user')
}

function handle(input: unknown) {
  assertIsUser(input)
  console.log(input.name) // narrowed after the call, no `if` needed
}
```

Use when the alternative to a valid shape is throwing, not branching.

## Exhaustiveness checking

```ts
function assertNever(value: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(value)}`)
}

function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle': return Math.PI * shape.radius ** 2
    case 'square': return shape.side ** 2
    default: return assertNever(shape)
  }
}
```

Adding a new member to the `Shape` union without adding a `case` now fails to compile — the `default` branch's argument is no longer assignable to `never`.

## Truthiness pitfalls

```ts
function trim(value?: string): string {
  if (!value) return ''    // also filters out '' — may not be intended
  return value.trim()
}

function trimStrict(value?: string): string {
  if (value === undefined) return ''
  return value.trim()
}
```

Prefer explicit `=== undefined` / `=== null` checks over truthiness when `0`, `''`, or `false` are valid values.
