# Mapped & Conditional Types

## Basic mapped types

```ts
type Optional<T> = { [K in keyof T]?: T[K] }
type Nullable<T> = { [K in keyof T]: T[K] | null }
type Mutable<T> = { -readonly [K in keyof T]: T[K] }   // strips readonly
type ReadonlyDeep<T> = { readonly [K in keyof T]: T[K] extends object ? ReadonlyDeep<T[K]> : T[K] }
```

`-readonly` and `-?` remove a modifier; `+readonly`/`+?` (rarely needed, same as bare) add one explicitly.

## Key remapping with `as`

```ts
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K]
}

interface Person {
  name: string
  age: number
}

type PersonGetters = Getters<Person>
// { getName: () => string; getAge: () => number }
```

```ts
type OmitByValue<T, V> = {
  [K in keyof T as T[K] extends V ? never : K]: T[K]
}

interface Form {
  name: string
  age: number
  bio?: string
}

type RequiredOnly<T> = OmitByValue<T, undefined>
```

Mapping a key to `never` in the `as` clause removes it from the result — this is how you filter keys while mapping.

## Conditional types

```ts
type IsString<T> = T extends string ? true : false

type A = IsString<'hello'>  // true
type B = IsString<42>       // false
```

## Distributive conditional types

```ts
type ToArray<T> = T extends unknown ? T[] : never

type StrOrNumArray = ToArray<string | number>
// string[] | number[]  — distributed over each union member
```

When the checked type is a **naked type parameter** (`T`, not `[T]`), the conditional distributes over unions automatically. Wrap in a tuple to opt out:

```ts
type ToArrayNonDistributive<T> = [T] extends [unknown] ? T[] : never

type Combined = ToArrayNonDistributive<string | number>
// (string | number)[] — NOT distributed
```

This distinction is exactly how the built-in `Exclude<T, U>` and `Extract<T, U>` work under the hood.

## `infer` for extraction

```ts
type ElementType<T> = T extends (infer U)[] ? U : T
type FirstArg<F> = F extends (arg: infer A, ...rest: unknown[]) => unknown ? A : never
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T

type Item = ElementType<string[]>          // string
type Arg = FirstArg<(id: number) => void>  // number
type Value = UnwrapPromise<Promise<User>>  // User
```

## Recursive conditional types

```ts
type DeepReadonly<T> = T extends (infer U)[]
  ? DeepReadonlyArray<U>
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T

interface DeepReadonlyArray<T> extends ReadonlyArray<DeepReadonly<T>> {}
```

Recursive types are powerful for nested structures (deep readonly/partial) but are also the easiest way to hit "type instantiation is excessively deep." Add a depth-limiting generic parameter or fall back to a library (e.g. `type-fest`) once a recursive type becomes hard to reason about.

## When to stop and extract a helper

If a conditional type needs more than 2 nested ternaries, split it:

```ts
// Hard to read:
type Result<T> = T extends string ? 'str' : T extends number ? 'num' : T extends boolean ? 'bool' : 'other'

// Easier to read and extend:
type PrimitiveKind<T> =
  T extends string ? 'str' :
  T extends number ? 'num' :
  T extends boolean ? 'bool' :
  'other'
```

Formatting each branch on its own line (as above) is often enough — reach for named intermediate types only when branches themselves contain nested conditionals.
