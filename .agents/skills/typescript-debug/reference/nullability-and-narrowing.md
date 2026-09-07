# TS18048 / TS2532 — Possibly `undefined`/`null`

## "X is possibly undefined" after what looks like a null check

```ts
interface State {
  user?: { name: string }
}

function greet(state: State) {
  if (state.user) {
    setTimeout(() => {
      console.log(state.user.name) // TS18048: 'state.user' is possibly 'undefined'
    }, 100)
  }
}
```

The narrowing from `if (state.user)` only holds **inside that synchronous block** — TypeScript can't prove `state.user` is still defined inside a callback that runs later, since `state.user` could theoretically be reassigned to `undefined` before the callback runs (even though in this exact snippet it can't be, TS can't see that).

### Fix — capture the narrowed value in a local variable

```ts
function greet(state: State) {
  const user = state.user
  if (user) {
    setTimeout(() => {
      console.log(user.name) // fine — `user` is a stable local binding
    }, 100)
  }
}
```

## `noUncheckedIndexedAccess` — array/object index access

```ts
// tsconfig.json: "noUncheckedIndexedAccess": true
const names = ['Ann', 'Bob']
const first = names[0]
console.log(first.toUpperCase())
// TS2532: Object is possibly 'undefined'
```

Array access can't be proven in-bounds at compile time — `names[0]` is typed `string | undefined`. Fix with a check, a default, or `.at()` combined with a guard:

```ts
const first = names[0]
if (first !== undefined) console.log(first.toUpperCase())

const firstOrDefault = names[0] ?? 'Unknown'
```

## Optional chaining + nullish coalescing combo

```ts
function getCity(user?: { address?: { city?: string } }): string {
  return user?.address?.city ?? 'Unknown'
}
```

`?.` short-circuits to `undefined` at the first missing link; `??` only substitutes for `null`/`undefined` (not `''`/`0`/`false`), unlike `||`.

## Class fields narrowed then invalidated by another method

```ts
class Uploader {
  file: File | null = null

  setFile(file: File) {
    this.file = file
  }

  upload() {
    if (this.file) {
      doSomethingAsync().then(() => {
        send(this.file) // TS18048 — a getter/method call between the check and use can reassign `this.file`
      })
    }
  }
}
```

Same root cause as the callback example — capture into a local `const file = this.file` right after the check when the use happens inside a callback or after an `await`.
