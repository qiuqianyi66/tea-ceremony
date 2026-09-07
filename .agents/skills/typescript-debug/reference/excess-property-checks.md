# Excess Property Checks

```ts
interface Config {
  retries: number
  timeout?: number
}

const config: Config = {
  retries: 3,
  timout: 5000, // typo — TS2322/TS2345: Object literal may only specify known properties
}
```

TypeScript only runs this stricter check for **object literals assigned or passed directly** — not for variables:

```ts
const draft = { retries: 3, timout: 5000 } // no error here — `draft` is its own inferred type
const config: Config = draft               // still no error! `draft` has extra prop but is assignable
```

This is a common source of confusion: assigning a literal directly catches typos; assigning through a variable does not, because structural typing only requires *at least* the needed properties, not *exactly* the needed properties.

## Fix

- Keep the literal inline when you want the strict check, or
- Explicitly type the intermediate variable so the typo is caught at its own declaration:

```ts
const draft: Config = { retries: 3, timout: 5000 } // now caught here instead
```
