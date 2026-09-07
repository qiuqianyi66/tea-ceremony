---
name: vite-plugin-api
description: Vite plugin API — hooks, virtual modules, ordering, conditional apply, client-server communication.
---

# Vite Plugin API

Vite plugins extend Rolldown's plugin interface with Vite-specific hooks. A single plugin works for both dev and build.

## Basic Plugin Structure

```ts
// vite-plugin-my-plugin.ts
import type { Plugin } from 'vite'

export default function myPlugin(options?: MyPluginOptions): Plugin {
  return {
    name: 'vite-plugin-my-plugin', // required, shown in warnings/errors
    // hooks go here
  }
}
```

**Convention:** author as a factory function returning the plugin object.

### Plugin usage

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import myPlugin from './vite-plugin-my-plugin'

export default defineConfig({
  plugins: [myPlugin({ /* options */ })],
})
```

## Naming Conventions

- Rolldown-compatible plugins: `rolldown-plugin-` prefix
- Vite-only plugins: `vite-plugin-` prefix
- Framework-specific: `vite-plugin-vue-`, `vite-plugin-react-`, `vite-plugin-svelte-`
- Include `vite-plugin` keyword in `package.json`

---

## Vite-Specific Hooks

### `config`

Modify config before resolution. Runs **before** config is finalized.

```ts
{
  name: 'my-plugin',
  config(config, { command, mode }) {
    if (command === 'serve') {
      return { server: { port: 4000 } }
    }
  },
}
```

Returns a partial config object (deeply merged) or mutates `config` directly.

### `configResolved`

Read the final resolved config. Good for storing config reference.

```ts
{
  name: 'my-plugin',
  configResolved(config) {
    console.log('Resolved base:', config.base)
    console.log('Is build:', config.command === 'build')
  },
}
```

### `configureServer`

Hook into the dev server. Add custom middleware.

```ts
{
  name: 'my-plugin',
  configureServer(server) {
    // Runs BEFORE internal middleware
    server.middlewares.use((req, res, next) => {
      if (req.url === '/my-endpoint') {
        res.end('custom response')
      } else {
        next()
      }
    })
  },
}
```

**Post middleware** (runs AFTER internal middleware):

```ts
{
  name: 'my-plugin',
  configureServer(server) {
    return () => {
      server.middlewares.use((req, res, next) => {
        // This runs after Vite's internal middleware
        next()
      })
    }
  },
}
```

**Store server reference for other hooks:**

```ts
{
  name: 'my-plugin',
  configureServer(server) {
    this._server = server
  },
  transform(code, id) {
    if (this._server) {
      // access server in other hooks
    }
  },
}
```

### `configurePreviewServer`

Same as `configureServer` but for `vite preview`.

### `transformIndexHtml`

Transform HTML entry point files:

```ts
{
  name: 'my-plugin',
  transformIndexHtml(html) {
    return html.replace(/<title>(.*?)<\/title>/, '<title>My App</title>')
  },
}
```

**Inject tags:**

```ts
{
  name: 'my-plugin',
  transformIndexHtml() {
    return [
      {
        tag: 'script',
        attrs: { src: '/analytics.js' },
        injectTo: 'body',
      },
    ]
  },
}
```

**With ordering:**

```ts
{
  name: 'my-plugin',
  transformIndexHtml: {
    order: 'pre', // 'pre' | 'post' | undefined (default)
    handler(html) {
      return html
    },
  },
}
```

### `handleHotUpdate`

Custom HMR handling:

```ts
{
  name: 'my-plugin',
  handleHotUpdate({ file, server, modules, read }) {
    if (file.endsWith('.custom')) {
      // Send custom event instead of default HMR
      server.ws.send({ type: 'custom', event: 'custom-update', data: {} })
      return [] // prevent default HMR
    }
  },
}
```

---

## Universal Rolldown Hooks

Called during both dev and build:

### `resolveId`

Resolve custom module IDs:

```ts
{
  name: 'my-plugin',
  resolveId(source) {
    if (source === 'my-module') {
      return source // signal that we handle this ID
    }
  },
}
```

### `load`

Provide content for a resolved module:

```ts
{
  name: 'my-plugin',
  load(id) {
    if (id === 'my-module') {
      return 'export default "loaded content"'
    }
  },
}
```

### `transform`

Transform module content:

```ts
{
  name: 'my-plugin',
  transform(code, id) {
    if (id.endsWith('.custom')) {
      return {
        code: transformedCode,
        map: null, // provide sourcemap if possible
      }
    }
  },
}
```

---

## Virtual Modules

Provide build-time information via import:

```ts
import { exactRegex } from '@rolldown/pluginutils'

export default function myPlugin(): Plugin {
  const virtualModuleId = 'virtual:my-module'
  const resolvedId = '\0' + virtualModuleId

  return {
    name: 'my-plugin',
    resolveId: {
      filter: { id: exactRegex(virtualModuleId) },
      handler() {
        return resolvedId
      },
    },
    load: {
      filter: { id: exactRegex(resolvedId) },
      handler() {
        return `export const msg = "from virtual module"`
      },
    },
  }
}
```

```ts
// Usage in app code
import { msg } from 'virtual:my-module'
```

**Convention:**
- User-facing path: prefix with `virtual:` (e.g., `virtual:my-plugin`)
- Internal resolved ID: prefix with `\0` (prevents other plugins from processing)

---

## Plugin Ordering

Use `enforce` to control execution order:

```ts
{
  name: 'my-plugin',
  enforce: 'pre', // or 'post'
}
```

**Execution order:**
1. Alias plugins
2. User plugins with `enforce: 'pre'`
3. Vite core plugins
4. User plugins without `enforce`
5. Vite build plugins
6. User plugins with `enforce: 'post'`
7. Vite post-build plugins (minify, manifest)

---

## Conditional Application

Apply plugin only for `serve` or `build`:

```ts
{
  name: 'build-only',
  apply: 'build', // or 'serve'
}
```

Function form for fine-grained control:

```ts
{
  name: 'no-ssr-build',
  apply(config, { command }) {
    return command === 'build' && !config.build.ssr
  },
}
```

---

## Client-Server Communication

### Server → Client

```ts
// Plugin
configureServer(server) {
  server.ws.send('my:event', { msg: 'hello' })
}
```

```ts
// Client
if (import.meta.hot) {
  import.meta.hot.on('my:event', (data) => {
    console.log(data.msg) // 'hello'
  })
}
```

### Client → Server

```ts
// Client
if (import.meta.hot) {
  import.meta.hot.send('my:from-client', { msg: 'Hey!' })
}
```

```ts
// Plugin
configureServer(server) {
  server.ws.on('my:from-client', (data, client) => {
    console.log(data.msg)
    client.send('my:ack', { msg: 'Got it!' })
  })
}
```

**Convention:** always prefix event names to avoid collisions (e.g., `my-plugin:event`).

---

## Hook Filters (Performance)

Reduce unnecessary hook invocations:

```ts
{
  name: 'my-plugin',
  transform: {
    filter: { id: /\.custom$/ },
    handler(code, id) {
      // only called for .custom files
    },
  },
}
```

Supported in Rolldown, Rollup 4.38+, and Vite 6.3+.

---

## Plugin Context

```ts
{
  name: 'my-plugin',
  buildStart() {
    console.log('Vite version:', this.meta.viteVersion)
    // Detect Rolldown (Vite 8+)
    if (this.meta.rolldownVersion) {
      // Rolldown-powered Vite
    }
  },
}
```

---

## Debugging Plugins

Use [vite-plugin-inspect](https://github.com/antfu/vite-plugin-inspect) to inspect plugin transforms:

```ts
import inspect from 'vite-plugin-inspect'

export default defineConfig({
  plugins: [inspect()],
})
```

Visit `localhost:5173/__inspect/` during dev to see module transforms.

<!-- Source references:
  - https://vite.dev/guide/api-plugin
-->
