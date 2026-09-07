# TS2345 / TS2322 / TS2769 — Assignability Errors

## TS2345 — Argument not assignable to parameter

```ts
function greet(name: string): string {
  return `Hello, ${name}`
}

greet(42)
// TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.
```

Read bottom-up: TypeScript names the **source** type first (`number`, what you passed) and the **target** type second (`string`, what was expected). Fix by converting at the call site (`greet(String(42))`) or widening the parameter type if `number` is actually valid input.

## TS2322 — Type not assignable in a declaration/assignment

```ts
interface User {
  role: 'admin' | 'member'
}

const user: User = {
  role: 'owner', // TS2322: Type '"owner"' is not assignable to type '"admin" | "member"'
}
```

Same direction as TS2345 but for `const x: T = value` / `obj.prop = value` instead of a function call. The fix is either to correct the value or to widen the declared union to include the new literal.

## TS2769 — No overload matches this call

```ts
function process(value: string): string
function process(value: number): number
function process(value: string | number): string | number {
  return value
}

process(true)
// TS2769: No overload matches this call.
//   Overload 1 of 2, '(value: string): string', gave the following error.
//     Argument of type 'boolean' is not assignable to parameter of type 'string'.
//   Overload 2 of 2, '(value: number): number', gave the following error.
//     Argument of type 'boolean' is not assignable to parameter of type 'number'.
```

- TypeScript tries every overload in order and reports **all** of their individual failures — this makes the message long and can obscure the real problem.
- Read the **last** overload's failure first; TS generally considers the last-declared, most general overload the "best effort" match, and its error is usually the most informative.
- Fix by adding a matching overload, or by fixing the caller to pass one of the accepted types.

## General debugging move

Extract the failing call/argument into its own typed variable to shrink the error to exactly the mismatched piece:

```ts
const arg: string | number = true  // now the error is isolated to this one line
process(arg)
```
