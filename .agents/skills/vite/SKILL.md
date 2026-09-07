---
name: vite
description: Vite build tool configuration, plugin API, SSR, library mode, and Vite 8 Rolldown migration. Use when working with Vite projects, vite.config.ts, Vite plugins, env variables, or building libraries/SSR apps with Vite. Load for any vite.config.* file or Vite-related task.
license: MIT
metadata:
  sources:
    - https://vite.dev/guide/
    - https://github.com/vitejs/vite
    - https://github.com/antfu/skills (vite skill reference)
  version: "1.0.0"
---

# Vite — Build Tool Skill

> Based on Vite 6+ / Vite 8 (Rolldown). Always use ESM. Prefer TypeScript.

## Version Compatibility

| Vite version | Bundler config key | Transpiler config |
|---|---|---|
| Vite ≤7 | `build.rollupOptions` | `esbuild` |
| Vite 8+ | `build.rolldownOptions` | `oxc` |

Most projects today run Vite 5–7. Examples in this skill show **Vite 8 / Rolldown** syntax by default — replace `rolldownOptions` with `rollupOptions` when targeting Vite ≤7.

## Preferences

- TypeScript (`vite.config.ts`) over JavaScript
- ESM only — no CommonJS in source code
- `defineConfig` — always wrap config for type safety
- Prefer `import.meta.env` over `process.env` in client code
- Use `VITE_` prefix for client-exposed environment variables only

## Core Principles

- **Dev speed matters:** Vite uses native ESM + HMR in dev, Rolldown for production builds.
- **Convention over configuration:** sensible defaults, configure only what you need.
- **Plugin-first extensibility:** use the plugin API for custom behavior, not hacks.
- **Security by default:** only `VITE_`-prefixed env vars are exposed to client code.

---

## References

### Core

| Topic | Description | Reference |
|-------|-------------|-----------|
| Configuration | `defineConfig`, conditional config, `loadEnv`, key options | [core-config.md](references/core-config.md) |
| Features | `import.meta.glob`, assets, CSS, env vars, HMR API, workers | [core-features.md](references/core-features.md) |

### Plugins & Build

| Topic | Description | Reference |
|-------|-------------|-----------|
| Plugin API | Hooks, virtual modules, ordering, conditional apply | [plugin-api.md](references/plugin-api.md) |
| Build & SSR | Library mode, multi-page apps, SSR setup, JS API | [build-and-ssr.md](references/build-and-ssr.md) |

### Advanced

| Topic | Description | Reference |
|-------|-------------|-----------|
| Environment & Migration | Environment API (Vite 6+), Rolldown migration (Vite 8) | [environment-and-migration.md](references/environment-and-migration.md) |

---

## Quick Reference

### CLI Commands

```bash
# Create project
npm create vite@latest my-app -- --template vue-ts

# Dev server
npx vite              # start dev server (default port 5173)
npx vite --host       # expose to network
npx vite --port 3000  # custom port

# Build
npx vite build                    # production build
npx vite build --mode staging     # custom mode build

# Preview
npx vite preview      # preview production build locally
```

### Minimal Config

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
```

### Conditional Config

```ts
import { defineConfig } from 'vite'

export default defineConfig(({ command, mode }) => {
  if (command === 'serve') {
    return { /* dev config */ }
  } else {
    return { /* build config */ }
  }
})
```

### Env Variables

```bash
# .env
VITE_API_URL=https://api.example.com    # exposed to client
SECRET_KEY=abc123                       # NOT exposed to client
```

```ts
// In app code
const apiUrl = import.meta.env.VITE_API_URL
const isProd = import.meta.env.PROD
const mode = import.meta.env.MODE
```

### TypeScript Env Types

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

---

## Official Plugins

| Plugin | Package |
|--------|---------|
| Vue 3 SFC | `@vitejs/plugin-vue` |
| Vue JSX | `@vitejs/plugin-vue-jsx` |
| React (Babel) | `@vitejs/plugin-react` |
| React (SWC) | `@vitejs/plugin-react-swc` |
| Legacy browsers | `@vitejs/plugin-legacy` |

---

## Common Patterns

### Proxy API Requests

```ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
```

### Path Aliases with TypeScript

```ts
// vite.config.ts
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

```json
// tsconfig.json — must match aliases
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@components/*": ["./src/components/*"]
    }
  }
}
```

### Loading Env in Config

```ts
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    server: {
      port: env.APP_PORT ? Number(env.APP_PORT) : 5173,
    },
    define: {
      __APP_VERSION__: JSON.stringify(env.APP_VERSION),
    },
  }
})
```
