# Template Literal Types

Template literal types build string-literal unions from other string-literal unions, the same way template literal strings build strings from values.

## Basic composition

```ts
type Direction = 'top' | 'right' | 'bottom' | 'left'
type Size = 'sm' | 'md' | 'lg'

type MarginClass = `margin-${Direction}`
// 'margin-top' | 'margin-right' | 'margin-bottom' | 'margin-left'

type ButtonClass = `btn-${Size}-${Direction}`
// all 12 combinations, generated automatically
```

Combining two unions of length M and N produces M × N literal combinations — useful for CSS utility classes, i18n keys, or CSS variable names.

## Intrinsic string manipulation types

```ts
type Shout = Uppercase<'hello'>       // 'HELLO'
type Whisper = Lowercase<'HELLO'>     // 'hello'
type Title = Capitalize<'hello'>      // 'Hello'
type Camel = Uncapitalize<'Hello'>    // 'hello'
```

## Event-name style APIs

```ts
type EventMap = {
  click: MouseEvent
  focus: FocusEvent
  input: InputEvent
}

type OnHandlers = {
  [K in keyof EventMap as `on${Capitalize<string & K>}`]: (event: EventMap[K]) => void
}
// { onClick: (event: MouseEvent) => void; onFocus: (event: FocusEvent) => void; ... }
```

## Extracting parts of a string type with `infer`

```ts
type RouteParam<T extends string> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? Param | RouteParam<Rest>
    : T extends `${string}:${infer Param}`
      ? Param
      : never

type Params = RouteParam<'/users/:userId/posts/:postId'>
// 'userId' | 'postId'
```

This pattern extracts route param names at the type level — pair it with a runtime router that reads the same `:param` syntax so types and behavior can't drift apart.

## CSS-in-TS style validation

```ts
type PixelValue = `${number}px`
type PercentValue = `${number}%`
type CssLength = PixelValue | PercentValue | 'auto'

function setWidth(value: CssLength) { /* ... */ }

setWidth('100px')   // ok
setWidth('50%')     // ok
setWidth('wide')    // ❌ compile error
```

## Practical guidance

- Use template literal types for **generated string unions** (event names, CSS variables, route params) — not as a substitute for real runtime string validation of user input.
- Keep the source unions (`Direction`, `Size`, event maps) as the single source of truth; derive the template literal type from them instead of hand-writing every combination.
- Large cartesian products (many unions combined) can slow down the compiler on huge codebases — keep combined unions to what's actually used, not every theoretical combination.
