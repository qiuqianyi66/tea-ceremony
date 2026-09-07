---
name: typescript-config
description: Use when creating or editing tsconfig.json, choosing strict-mode flags, configuring module resolution/path aliases, project references, or authoring .d.ts files. Load for tsconfig.json, jsconfig.json, or env.d.ts.
license: MIT
metadata:
  sources:
    - https://www.typescriptlang.org/tsconfig/ (TSConfig Reference)
    - https://www.typescriptlang.org/docs/handbook/project-references.html (Project References)
  version: "1.0.0"
compatibility: TypeScript 5.x
---

# TypeScript Config — tsconfig, Strictness & Module Resolution

> A correctly configured `tsconfig.json` catches more bugs than any linter rule. Start strict; never start loose and "tighten later."

## Preferences

- `"strict": true` from day one — never add a project with strict flags disabled
- `"moduleResolution": "bundler"` for Vite/webpack/esbuild-based apps; `"NodeNext"` for published Node.js packages
- `"skipLibCheck": true` to avoid type errors inside third-party `.d.ts` files you don't control
- `"isolatedModules": true` whenever the toolchain transpiles files independently (Vite, esbuild, SWC, Babel)
- Path aliases (`@/*`) mirrored in both `tsconfig.json` and the bundler config — never defined in only one place

## Core Principles

- **Strictness is a project-wide contract**, not a per-file opt-in — configure it once at the root.
- **The compiler config should match the runtime** it actually ships to (`target`, `lib`, `module`).
- **Declaration files (`.d.ts`) are part of the public API** for a library — treat them with the same review rigor as code.
- **One `tsconfig.json` per build target** (app vs. node scripts vs. tests) via `references`/`extends`, not one config trying to satisfy every environment.

---

## 1) Minimal Strict `tsconfig.json` (Vite/Vue app)

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "moduleDetection": "force",
    "useDefineForClassFields": true,

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,

    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowJs": false,
    "noEmit": true,

    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "vite-env.d.ts"]
}
```

- `noEmit: true` — the bundler (Vite/esbuild) does the actual transpiling; `tsc` is used only for type checking.
- `verbatimModuleSyntax` forces explicit `import type` for type-only imports — prevents accidentally importing a type as a value that then breaks at runtime after erasure.

---

## 2) Strict Flags — What Each One Catches

| Flag | Catches |
|---|---|
| `strict` | Umbrella for all flags below — always on |
| `strictNullChecks` | `null`/`undefined` not assignable to other types unless declared |
| `strictFunctionTypes` | Unsound parameter bivariance in function type comparisons |
| `strictPropertyInitialization` | Class fields declared but never assigned in the constructor |
| `noImplicitAny` | Untyped parameters/variables silently becoming `any` |
| `noUncheckedIndexedAccess` | `obj[key]` returns `T \| undefined`, not `T`, for index signatures |
| `exactOptionalPropertyTypes` | `{ a?: string }` rejects explicit `undefined` assignment, only allows omission |
| `noImplicitOverride` | Requires `override` keyword when overriding a base class method |
| `noFallthroughCasesInSwitch` | `switch` cases that fall through without `break`/`return` |

See [`references/strict-flags.md`](references/strict-flags.md) for before/after examples of each.

---

## 3) Module Resolution

| Environment | `module` | `moduleResolution` |
|---|---|---|
| Vite / webpack / esbuild app | `ESNext` | `bundler` |
| Published npm library (ESM+CJS) | `NodeNext` | `NodeNext` |
| Node.js script (ESM only) | `NodeNext` | `NodeNext` |
| Legacy CommonJS Node | `CommonJS` | `Node10` |

```jsonc
// Library shipping both ESM and CJS
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "declarationMap": true
  }
}
```

`"bundler"` resolution (TS 5+) matches how Vite/webpack actually resolve imports (no explicit file extensions required, `package.json#exports` supported) — use it for any app that never runs `tsc` to emit JS directly.

See [`references/module-resolution.md`](references/module-resolution.md).

---

## 4) Path Aliases

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@components/*": ["./src/components/*"]
    }
  }
}
```

```ts
// vite.config.ts — MUST mirror the same aliases
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
      '@components': resolve(import.meta.dirname, 'src/components'),
    },
  },
})
```

`tsconfig.json` paths only affect type checking/IDE resolution — they do **not** rewrite imports at build time. The bundler alias config is what actually resolves the import at runtime; both must exist and match.

---

## 5) Project References (Monorepos)

```jsonc
// tsconfig.json (root, solution file)
{
  "files": [],
  "references": [
    { "path": "./packages/shared" },
    { "path": "./packages/app" }
  ]
}
```

```jsonc
// packages/app/tsconfig.json
{
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist"
  },
  "references": [{ "path": "../shared" }]
}
```

- `composite: true` is required on every referenced project — enables incremental builds (`tsc --build`) and cross-project "go to definition."
- Use project references when a monorepo package imports another package's **source** (not just its published `dist`) — this keeps type checking fast and incremental instead of one giant `tsc` run.

---

## 6) Declaration Files (`.d.ts`)

```ts
// env.d.ts — augmenting import.meta.env (Vite)
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

```ts
// global.d.ts — ambient module for an untyped package
declare module 'untyped-legacy-lib' {
  export function doThing(input: string): number
}
```

- Ambient `.d.ts` files must **not** contain `import`/`export` of runtime values at the top level unless intentionally scoping — a file with no top-level `import`/`export` is treated as a global/ambient script.
- Ship `declaration: true` + `declarationMap: true` for any published library so consumers get types and "go to source" support.

See [`references/declaration-files.md`](references/declaration-files.md).

---

## 7) Final Self-Check

- `strict: true` plus `noUncheckedIndexedAccess`/`exactOptionalPropertyTypes` enabled for new projects.
- `moduleResolution` matches the actual runtime (`bundler` for Vite apps, `NodeNext` for published packages).
- Path aliases exist identically in `tsconfig.json` **and** the bundler config.
- `skipLibCheck: true` so third-party `.d.ts` issues don't block the build.
- Monorepo packages importing each other's source use `composite`/project references, not relative `../../` reaching into `src`.
- Declaration files reviewed like code — they are the library's actual public contract.
