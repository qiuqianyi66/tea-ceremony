---
name: vite-build-ssr
description: Vite build configuration — library mode, multi-page apps, SSR setup, chunking strategy, JavaScript API.
---

# Build & SSR

## Production Build

```bash
vite build
```

Default entry: `<root>/index.html`. Output: `dist/`.

### Key build options

```ts
export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: true,              // generate sourcemaps
    target: 'es2020',             // browser target
    minify: 'oxc',                // Vite 8: 'oxc' | 'terser' | false
    cssMinify: true,
    assetsInlineLimit: 4096,      // inline assets < 4kb as base64
    rolldownOptions: {
      // Rolldown-specific options
    },
  },
})
```

### Chunking strategy

Configure via `build.rolldownOptions.output.codeSplitting` (Vite 8+) or `build.rollupOptions.output.manualChunks` (Vite ≤7). See [Rolldown docs](https://rolldown.rs/in-depth/manual-code-splitting).

---

## Multi-Page App

```
├── index.html
├── main.js
└── nested/
    ├── index.html
    └── nested.js
```

```ts
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        nested: resolve(import.meta.dirname, 'nested/index.html'),
      },
    },
  },
})
```

During dev, navigate to `/nested/` directly.

---

## Library Mode

### Single entry

```ts
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'lib/main.ts'),
      name: 'MyLib',       // UMD global name
      fileName: 'my-lib',  // output file name
    },
    rolldownOptions: {
      external: ['vue'],   // don't bundle dependencies
      output: {
        globals: {
          vue: 'Vue',      // UMD global mapping
        },
      },
    },
  },
})
```

**Output formats:**
- Single entry: `es` + `umd`
- Multiple entries: `es` + `cjs`

### Multiple entries

```ts
export default defineConfig({
  build: {
    lib: {
      entry: {
        'my-lib': resolve(import.meta.dirname, 'lib/main.ts'),
        secondary: resolve(import.meta.dirname, 'lib/secondary.ts'),
      },
      name: 'MyLib',
    },
    rolldownOptions: {
      external: ['vue'],
    },
  },
})
```

### `package.json` for library (single entry)

```json
{
  "name": "my-lib",
  "type": "module",
  "files": ["dist"],
  "main": "./dist/my-lib.umd.cjs",
  "module": "./dist/my-lib.js",
  "exports": {
    ".": {
      "import": "./dist/my-lib.js",
      "require": "./dist/my-lib.umd.cjs"
    }
  }
}
```

### `package.json` for library (multiple entries)

```json
{
  "name": "my-lib",
  "type": "module",
  "files": ["dist"],
  "main": "./dist/my-lib.cjs",
  "module": "./dist/my-lib.js",
  "exports": {
    ".": {
      "import": "./dist/my-lib.js",
      "require": "./dist/my-lib.cjs"
    },
    "./secondary": {
      "import": "./dist/secondary.js",
      "require": "./dist/secondary.cjs"
    }
  }
}
```

### CSS in library

CSS is bundled as a separate file (e.g., `dist/my-lib.css`). Export in `package.json`:

```json
{
  "exports": {
    ".": { "import": "./dist/my-lib.js" },
    "./style.css": "./dist/my-lib.css"
  }
}
```

### Library notes

- `import.meta.env.*` → statically replaced at build time
- `process.env.*` → NOT replaced (consumers control it)
- For non-browser or advanced builds, consider [tsdown](https://tsdown.dev/) or [Rolldown](https://rolldown.rs/) directly

---

## SSR (Server-Side Rendering)

> For most use cases, prefer meta-frameworks: **Nuxt** (Vue), **SvelteKit** (Svelte), **SolidStart** (Solid), **TanStack Start** (React). For server needs, consider [Nitro](https://nitro.build).

### Dev server with SSR (Express example)

```ts
import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import { createServer as createViteServer } from 'vite'

async function createServer() {
  const app = express()

  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',
  })

  app.use(vite.middlewares)

  app.use('*all', async (req, res, next) => {
    try {
      let template = fs.readFileSync(
        path.resolve(import.meta.dirname, 'index.html'),
        'utf-8',
      )

      template = await vite.transformIndexHtml(req.originalUrl, template)

      const { render } = await vite.ssrLoadModule('/src/entry-server.ts')
      const appHtml = await render(req.originalUrl)
      const html = template.replace(`<!--ssr-outlet-->`, () => appHtml)

      res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
    } catch (e) {
      vite.ssrFixStacktrace(e as Error)
      next(e)
    }
  })

  app.listen(5173)
}

createServer()
```

### Build scripts for SSR

```json
{
  "scripts": {
    "dev": "node server",
    "build:client": "vite build --outDir dist/client",
    "build:server": "vite build --outDir dist/server --ssr src/entry-server.ts"
  }
}
```

### SSR externals

Dependencies are externalized by default in SSR. Override:

```ts
export default defineConfig({
  ssr: {
    noExternal: ['my-lib-that-needs-transform'],
    external: ['linked-dep-to-externalize'],
  },
})
```

### SSR in plugins

```ts
{
  name: 'my-ssr-plugin',
  transform(code, id, options) {
    if (options?.ssr) {
      // SSR-specific transform
    }
  },
}
```

### SSR target

```ts
export default defineConfig({
  ssr: {
    target: 'node',       // default
    // target: 'webworker', // for edge/worker runtimes
  },
})
```

---

## JavaScript API

### `createServer` — programmatic dev server

```ts
import { createServer } from 'vite'

const server = await createServer({
  configFile: false,
  root: import.meta.dirname,
  server: { port: 1337 },
})

await server.listen()
server.printUrls()
server.bindCLIShortcuts({ print: true })
```

### `build` — programmatic build

```ts
import { build } from 'vite'

await build({
  root: './project',
  base: '/foo/',
  build: { rolldownOptions: { /* ... */ } },
})
```

### `preview` — programmatic preview server

```ts
import { preview } from 'vite'

const previewServer = await preview({
  preview: { port: 8080, open: true },
})

previewServer.printUrls()
```

### `resolveConfig` — resolve config programmatically

```ts
import { resolveConfig } from 'vite'

const config = await resolveConfig({}, 'serve')
```

### `loadEnv` — load env files

```ts
import { loadEnv } from 'vite'

const env = loadEnv('production', process.cwd(), '')
// Loads .env, .env.local, .env.production, .env.production.local
```

Third param: prefix filter (`'VITE_'` by default, `''` for all).

<!-- Source references:
  - https://vite.dev/guide/build
  - https://vite.dev/guide/ssr
  - https://vite.dev/guide/api-javascript
-->
