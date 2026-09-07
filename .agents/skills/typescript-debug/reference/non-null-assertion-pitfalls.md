# Non-Null Assertion (`!`) Pitfalls

```ts
function getUser(id: string): User | undefined {
  return users.find((u) => u.id === id)
}

const user = getUser('123')!  // "trust me, it's defined"
console.log(user.name)         // crashes at runtime if the user doesn't exist
```

`!` tells the compiler "treat this as non-null," but performs **no runtime check** — if the value actually is `null`/`undefined`, the crash just moves a line or two later with a less obvious stack trace (`Cannot read properties of undefined`) instead of a clear compiler error at the source.

## When `!` is (rarely) acceptable

```ts
const input = document.getElementById('app')!
// acceptable ONLY when you are certain the element exists (e.g. it's in the static HTML shell)
// and a crash-on-missing is genuinely the desired behavior during development
```

Even here, prefer an explicit check with a clear error message over a silent `!`:

```ts
const input = document.getElementById('app')
if (!input) throw new Error('#app element not found in DOM')
```

## Common misuse: silencing a real narrowing gap

```ts
function process(items?: Item[]) {
  items!.forEach((item) => { /* ... */ }) // hides a real "what if items is undefined" question
}
```

Fix by handling the actual case instead of asserting it away:

```ts
function process(items: Item[] = []) {
  items.forEach((item) => { /* ... */ })
}
```

## Non-null assertion on object properties after `Object.freeze`/external mutation

```ts
interface Cache {
  value?: string
}

const cache: Cache = {}

function warm() {
  cache.value = 'loaded'
}

warm()
console.log(cache.value!.length) // works today, breaks the moment warm() timing changes
```

A `!` here encodes an assumption about **call order** that the type system (correctly) can't verify — refactor so the dependency is explicit (pass the loaded value as a parameter) instead of relying on assumed side-effect ordering.

## Better alternatives to `!`

| Instead of | Use |
|---|---|
| `value!` | `if (value === undefined) throw new Error(...)` then use `value` |
| `arr.find(...)!` | `arr.find(...)` and handle the `undefined` branch, or `arr.filter(...)[0]` with a default |
| `map.get(key)!` | Check `map.has(key)` first, or use `??` with a sensible default |
| Repeated `x!.y!.z!` chains | Fix the source type to not be optional, or use a validated/asserted type guard once |
