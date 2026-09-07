---
name: vite-config
description: Vite configuration patterns — defineConfig, conditional config, loadEnv, key options, TypeScript intellisense.
---

# Vite Configuration

## Basic Setup

```ts
// vite.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
  // config options
})
```

Vite auto-resolves `vite.config.js` / `vite.config.ts` / `vite.config.mjs` / `vite.config.mts` in project root. Specify explicitly with `--config`:

```bash
vite --config my-config.ts
```

## `defineConfig`

Always use `defineConfig` for type safety. Supports three forms:

### Object form

```ts
export default defineConfig({
  plugins: [],
  server: { port: 3000 },
})
```

### Function form (conditional)

```ts
export default defineConfig(({ command, mode, isSsrBuild, isPreview }) => {
  if (command === 'serve') {
    return { /* dev-specific config */ }
  } else {
    // command === 'build'
    return { /* build-specific config */ }
  }
})
```

- `command` — `'serve'` (dev) or `'build'` (production)
- `mode` — `'development'`, `'production'`, or custom (e.g., `'staging'`)
- `isSsrBuild` — `true` if SSR build
- `isPreview` — `true` if `vite preview`

### Async form

```ts
export default defineConfig(async ({ command, mode }) => {
  const data = await asyncFunction()
  return { /* config using data */ }
})
```

## Loading Env Variables in Config

`.env` files are loaded **after** config evaluation. To use env vars inside `vite.config.ts`, use `loadEnv`:

```ts
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // Third param '' loads all env vars (not just VITE_-prefixed)
  const env = loadEnv(mode, process.cwd(), '')

  return {
    define: {
      __APP_ENV__: JSON.stringify(env.APP_ENV),
    },
    server: {
      port: env.APP_PORT ? Number(env.APP_PORT) : 5173,
    },
  }
})
```

## Key Config Options

### `resolve.alias`

```ts
import { resolve } from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
})
```

**Important:** aliases must also be reflected in `tsconfig.json` `compilerOptions.paths`.

### `define`

Compile-time constants, replaced statically at build:

```ts
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify('1.0.0'),
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
})
```

**Rule:** always wrap string values with `JSON.stringify`.

### `plugins`

```ts
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
})
```

Plugins are functions returning objects — always call them.

### `server.proxy`

```ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // WebSocket proxy
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
})
```

### `build.target`

Default: Baseline Widely Available browsers (2.5+ years old).

```ts
export default defineConfig({
  build: {
    target: 'es2020',      // custom target
    outDir: 'dist',        // output directory (default: dist)
    sourcemap: true,       // generate sourcemaps
    minify: 'oxc',         // Vite 8: 'oxc' (default), 'terser', false
  },
})
```

### `css`

```ts
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/styles/variables" as *;`,
      },
    },
    modules: {
      localsConvention: 'camelCaseOnly',
    },
  },
})
```

## TypeScript IntelliSense

### In `.ts` config files

`defineConfig` provides full type inference.

### In `.js` config files

```js
/** @type {import('vite').UserConfig} */
export default {
  // ...
}
```

Or with `satisfies`:

```js
import { defineConfig } from 'vite'

export default defineConfig(/** @satisfies {import('vite').UserConfig} */ ({
  // ...
}))
```

## Config Loader

Vite uses Rolldown to bundle the config by default. Alternative loaders:

```bash
vite --configLoader runner   # module runner (no temp files)
vite --configLoader native   # native runtime (for node --experimental-strip-types)
```

<!-- Source references:
  - https://vite.dev/config/
  - https://vite.dev/guide/#configuring-vite
-->
