# Declaration Files (`.d.ts`)

## Generating declarations for a published library

```jsonc
{
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "outDir": "dist"
  }
}
```

```json
// package.json
{
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  }
}
```

`declarationMap: true` lets consumers "go to definition" and land in your original `.ts` source instead of the generated `.d.ts` — enable it for any library shipped with source maps.

## Ambient declaration files (no imports/exports)

```ts
// global.d.ts — a script file (ambient), adds to the global scope
declare const __APP_VERSION__: string

interface Window {
  dataLayer?: unknown[]
}
```

A `.d.ts` file with **no top-level `import`/`export`** is treated as a global script — everything declared in it is available everywhere without importing. Use sparingly, for genuinely global values (build-time constants, `window` augmentations).

## Module declaration files (typing an untyped package)

```ts
// types/untyped-legacy-lib.d.ts
declare module 'untyped-legacy-lib' {
  export interface Options {
    retries?: number
  }
  export function connect(url: string, options?: Options): Promise<void>
}
```

```jsonc
// tsconfig.json — make sure the folder is included
{
  "include": ["src", "types"]
}
```

Use when a dependency ships no types and has no `@types/*` package available — write just enough of the surface you actually use, not the entire library API.

## Augmenting an existing module's types

```ts
// vue-router-augment.d.ts
import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    roles?: string[]
  }
}
```

The `import 'vue-router'` (side-effect import) is required — without it, TypeScript treats the file as ambient/global instead of augmenting the specific module.

## Vite client env typing

```ts
// vite-env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_APP_TITLE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

Keep this in sync with the actual `VITE_*` variables defined in `.env` files — it's the only thing giving `import.meta.env.VITE_API_URL` a real type instead of `any`.

## Rules of thumb

- Treat hand-written `.d.ts` files as public API surface — review changes to them as carefully as code, since consumers compile against them directly.
- Prefer generating declarations from source (`tsc --declaration`) over hand-writing them for your own code — hand-written `.d.ts` is for third-party/untyped packages and global augmentation only.
- Keep ambient globals to an absolute minimum — they bypass module boundaries and are easy to forget about.
