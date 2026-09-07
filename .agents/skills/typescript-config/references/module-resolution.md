# Module Resolution Strategies

## `bundler` (TypeScript 5+) — recommended for Vite/webpack/esbuild apps

```jsonc
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowImportingTsExtensions": false
  }
}
```

- Matches real bundler behavior: supports `package.json#exports`/`#imports`, no requirement to write file extensions on relative imports.
- Use when the bundler (not `tsc`) does the actual transpiling/emitting — `tsc` is only checking types.
- Do not use for code that will be executed directly by Node.js without a bundler — Node has stricter resolution rules than bundlers.

## `NodeNext` — for published npm packages / Node scripts

```jsonc
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022"
  }
}
```

- Enforces Node.js's actual ESM resolution rules: relative imports need explicit extensions (`import './util.js'`, even though the source file is `util.ts`).
- Respects `package.json#type` (`"module"` vs `"commonjs"`) and `#exports` maps — required for any library published to npm that supports both ESM and CJS consumers.
- Picking this for an app bundled by Vite is usually wrong — it will demand `.js` extensions the bundler doesn't need.

## `Node10` (legacy, formerly `"node"`) — CommonJS-only legacy projects

```jsonc
{
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node10"
  }
}
```

Only for pre-ESM Node.js codebases still on `require`/`module.exports`. New projects should not choose this.

## Quick decision table

| You are building... | `module` | `moduleResolution` |
|---|---|---|
| Vue 3 / React app via Vite | `ESNext` | `bundler` |
| Library published to npm (dual ESM/CJS) | `NodeNext` | `NodeNext` |
| CLI tool run directly with `node` | `NodeNext` | `NodeNext` |
| Legacy CommonJS backend | `CommonJS` | `Node10` |

## `verbatimModuleSyntax`

```ts
// with verbatimModuleSyntax: true, type-only imports must be explicit
import type { User } from './types'
import { fetchUser } from './api'

// mixing a type and a value from the same module:
import { type User, fetchUser } from './api'
```

This flag ensures the compiler never has to guess whether an import is type-only (which affects whether it's erased at build time) — required when `isolatedModules` is on, which is required for Vite/esbuild/SWC single-file transpilation.

## `isolatedModules`

Required whenever files are transpiled one-at-a-time without full program knowledge (Vite, esbuild, SWC, Babel). It forbids patterns that need cross-file type information to erase correctly, e.g.:

```ts
// not allowed with isolatedModules — re-exporting a type without `export type`
export { User } from './types'

// required form:
export type { User } from './types'
```
