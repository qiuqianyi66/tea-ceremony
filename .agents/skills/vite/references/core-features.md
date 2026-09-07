---
name: vite-features
description: Vite core features — import.meta.glob, static assets, CSS, env variables, HMR API, Web Workers, WebAssembly.
---

# Vite Core Features

## `import.meta.glob` — Glob Import

Import multiple modules from the filesystem:

### Lazy (default — code-split)

```ts
const modules = import.meta.glob('./dir/*.ts')
// Result: { './dir/foo.ts': () => import('./dir/foo.ts'), ... }

for (const path in modules) {
  modules[path]().then((mod) => {
    console.log(path, mod)
  })
}
```

### Eager (no code-splitting)

```ts
const modules = import.meta.glob('./dir/*.ts', { eager: true })
// Result: { './dir/foo.ts': Module, ... }
```

### Named imports (tree-shakeable with eager)

```ts
const setups = import.meta.glob('./dir/*.ts', { import: 'setup', eager: true })
// Only imports the `setup` export from each module
```

### Default export

```ts
const defaults = import.meta.glob('./dir/*.ts', { import: 'default', eager: true })
```

### Multiple patterns & negative patterns

```ts
const modules = import.meta.glob(['./dir/*.ts', './another/*.ts', '!**/ignored.ts'])
```

### Custom queries (raw, url)

```ts
const svgStrings = import.meta.glob('./icons/*.svg', { query: '?raw', import: 'default' })
const svgUrls = import.meta.glob('./icons/*.svg', { query: '?url', import: 'default' })
```

### With base path

```ts
const modules = import.meta.glob('./**/*.ts', { base: './base' })
```

### Caveats

- Vite-only feature (not a web standard)
- All arguments must be **string literals** — no variables or expressions
- Patterns must be relative (`./`), absolute (`/`), or alias paths
- Matching uses `tinyglobby`

---

## Static Asset Handling

### Import as URL (default)

```ts
import imgUrl from './img.png'
document.getElementById('hero-img').src = imgUrl
```

### Special query suffixes

```ts
import assetUrl from './asset.js?url'        // explicit URL
import assetRaw from './shader.glsl?raw'     // as string
import Worker from './worker.js?worker'       // Web Worker
import InlineWorker from './worker.js?worker&inline'  // inlined worker
```

### `?no-inline` / `?inline`

Force or prevent asset inlining regardless of `assetsInlineLimit`:

```ts
import smallImg from './small.png?inline'      // always inline
import largeImg from './large.png?no-inline'   // never inline
```

---

## CSS

### Basic import

```ts
import './style.css'  // injected via <style> tag with HMR
```

### CSS Modules

```ts
import classes from './component.module.css'
// classes.container, classes.title, etc.
```

Any file ending with `.module.css` is treated as CSS Modules. Works with preprocessors: `.module.scss`, `.module.less`.

### Preprocessors

Sass, Less, Stylus are supported — just install the preprocessor:

```bash
npm install -D sass      # or sass-embedded for better performance
npm install -D less
npm install -D stylus
```

### `@import` and aliases

CSS `@import` is inlined via `postcss-import`. Vite aliases work in CSS `@import`. All `url()` references are automatically rebased.

---

## Environment Variables

### Built-in constants (`import.meta.env`)

| Constant | Type | Description |
|----------|------|-------------|
| `MODE` | `string` | Current mode (`development`, `production`, custom) |
| `BASE_URL` | `string` | Base URL (from `base` config) |
| `PROD` | `boolean` | Production mode |
| `DEV` | `boolean` | Development mode |
| `SSR` | `boolean` | Server-side rendering |

### Custom env variables

Only `VITE_`-prefixed variables are exposed to client code:

```bash
# .env
VITE_API_URL=https://api.example.com   # ✅ available in client
DB_PASSWORD=secret                      # ❌ NOT available in client
```

```ts
console.log(import.meta.env.VITE_API_URL)  // "https://api.example.com"
console.log(import.meta.env.DB_PASSWORD)   // undefined
```

### `.env` file loading order

```
.env                # always loaded
.env.local          # always loaded, git-ignored
.env.[mode]         # only in specified mode
.env.[mode].local   # only in specified mode, git-ignored
```

Mode-specific files take priority over generic ones. Existing `process.env` vars are never overwritten.

### HTML constant replacement

```html
<h1>Running in %MODE%</h1>
<p>API: %VITE_API_URL%</p>
```

### TypeScript declarations

```ts
// src/vite-env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_APP_TITLE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

### `NODE_ENV` vs Mode

| Command | `NODE_ENV` | `MODE` |
|---------|-----------|--------|
| `vite` (dev) | `development` | `development` |
| `vite build` | `production` | `production` |
| `vite build --mode staging` | `production` | `staging` |

---

## HMR API

Available via `import.meta.hot`:

```ts
if (import.meta.hot) {
  // Accept self-updates
  import.meta.hot.accept((newModule) => {
    // handle updated module
  })

  // Clean up side effects
  import.meta.hot.dispose((data) => {
    // cleanup before module is replaced
    // store data for next module instance
  })

  // Force full page reload
  import.meta.hot.invalidate()

  // Custom events (client → server)
  import.meta.hot.send('my:event', { data: 'value' })

  // Listen for server events
  import.meta.hot.on('my:update', (data) => {
    console.log(data)
  })
}
```

---

## Web Workers

### Recommended: `new Worker()` constructor

```ts
const worker = new Worker(new URL('./worker.ts', import.meta.url), {
  type: 'module',
})
```

### Import suffix

```ts
import MyWorker from './worker?worker'
const worker = new MyWorker()
```

---

## WebAssembly

```ts
import init from './example.wasm?init'

init().then((instance) => {
  instance.exports.test()
})
```

---

## JSON Imports

```ts
import pkg from './package.json'          // default: full object
import { version } from './package.json'  // named import (tree-shakeable)
```

---

## TypeScript

- Vite uses **Oxc Transformer** for transpilation (type-strip only, no type checking)
- Run `tsc --noEmit` separately or use `vite-plugin-checker` for type checking
- Use type-only imports: `import type { T } from 'module'`

### Client types

Add to `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["vite/client"]
  }
}
```

Or via triple-slash directive in `src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
```

<!-- Source references:
  - https://vite.dev/guide/features
  - https://vite.dev/guide/env-and-mode
-->
