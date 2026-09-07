# Strict Flags — Before/After

## `strictNullChecks`

```ts
// off: compiles, crashes at runtime
function getLength(value: string) {
  return value.length
}
getLength(null) // no compile error without strictNullChecks

// on: caught at compile time
function getLength(value: string | null) {
  if (value === null) return 0
  return value.length
}
```

## `strictFunctionTypes`

```ts
// unsound without the flag: a handler for a narrower event type
// is wrongly accepted where a wider one is expected
type Handler<E> = (event: E) => void

let handler: Handler<MouseEvent> = (e: Event) => {}
// with strictFunctionTypes: error — Event is not assignable to MouseEvent parameter
```

## `strictPropertyInitialization`

```ts
// off: silently undefined at runtime
class UserForm {
  name: string  // never assigned — reading it returns undefined despite the `string` type
}

// on: forces a fix
class UserForm {
  name = ''                          // default value, or:
  email: string
  constructor(email: string) {
    this.email = email               // assigned in constructor, or:
  }
  role?: string                      // explicitly optional
}
```

## `noImplicitAny`

```ts
// off: parameter silently becomes `any`
function process(data) {
  return data.value
}

// on: forces an explicit type
function process(data: { value: string }) {
  return data.value
}
```

## `noUncheckedIndexedAccess`

```ts
interface Config { [key: string]: string }

// off: TypeScript claims this is always a string
const config: Config = {}
const value: string = config.missingKey  // runtime: undefined, but types say string!

// on: forces a check
const config2: Config = {}
const value2 = config2.missingKey        // type: string | undefined
if (value2 !== undefined) { /* safe to use as string */ }
```

Also applies to array access: `arr[i]` becomes `T | undefined` instead of `T`.

## `exactOptionalPropertyTypes`

```ts
interface Options {
  timeout?: number
}

// off: allowed, but semantically different from omitting the key entirely
const opts: Options = { timeout: undefined }

// on: compile error — must omit the key rather than set it to undefined explicitly
const opts2: Options = {}
```

Matters when downstream code distinguishes "not provided" (`in` check / spread merge) from "explicitly set to undefined."

## `noImplicitOverride`

```ts
class Base {
  save(): void { /* ... */ }
}

// off: typo in method name silently creates an unrelated method instead of overriding
class Derived extends Base {
  saev(): void { /* ... */ }  // no error, but this was meant to override `save`
}

// on: must mark real overrides explicitly
class Derived extends Base {
  override save(): void { /* ... */ }
  // renaming/typoing `save` while keeping `override` now errors immediately
}
```

## `noFallthroughCasesInSwitch`

```ts
function label(status: 'draft' | 'published' | 'archived') {
  switch (status) {
    case 'draft':
    // off: silently falls through to 'published' case — likely a bug
    case 'published':
      return 'Live'
    case 'archived':
      return 'Archived'
  }
}
```

Fallthrough is still allowed for empty cases stacked together (`case 'draft':` immediately followed by another `case`) — the flag only flags fallthrough with executable code in between.
