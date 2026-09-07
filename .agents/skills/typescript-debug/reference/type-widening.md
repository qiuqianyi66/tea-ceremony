# Type Widening Surprises

## `let` widens literal types, `const` doesn't

```ts
let status = 'idle'          // widened to type: string
const status2 = 'idle'       // kept as literal type: 'idle'

function setStatus(s: 'idle' | 'loading' | 'done') { /* ... */ }

setStatus(status)   // TS2345 — `string` is not assignable to the union
setStatus(status2)  // fine — 'idle' is assignable to the union
```

`let` widens because the variable could be reassigned to any `string` later — TypeScript can't keep it narrowed to the literal without more information.

### Fix — annotate the union explicitly

```ts
let status: 'idle' | 'loading' | 'done' = 'idle'
```

## Object literal properties widen too

```ts
const config = { mode: 'production' }
// config.mode inferred as `string`, not the literal 'production'

function build(options: { mode: 'production' | 'development' }) { /* ... */ }

build(config) // TS2345 — property 'mode' widened to string
```

### Fix — `as const` or explicit type

```ts
const config = { mode: 'production' } as const
// config.mode is now the literal type 'production'

const config2: { mode: 'production' | 'development' } = { mode: 'production' }
```

## Function return type widening

```ts
function getMode() {
  return 'production' // inferred return type: string, not 'production'
}
```

Annotate the return type explicitly on any exported/public function whose literal return value matters to callers:

```ts
function getMode(): 'production' | 'development' {
  return 'production'
}
```

## Array literal widening

```ts
const roles = ['admin', 'member']       // string[]
const roles2 = ['admin', 'member'] as const  // readonly ['admin', 'member']

type Role = typeof roles2[number]       // 'admin' | 'member'
```

`as const` on an array both locks each element to its literal type and makes the array `readonly` — the standard pattern for deriving a union type from a list of allowed values.

## Enum-like object widening

```ts
const STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
}
// without `as const`, STATUS.IDLE is typed `string`

const STATUS_CONST = {
  IDLE: 'idle',
  LOADING: 'loading',
} as const
// STATUS_CONST.IDLE is typed 'idle'

type Status = typeof STATUS_CONST[keyof typeof STATUS_CONST] // 'idle' | 'loading'
```
