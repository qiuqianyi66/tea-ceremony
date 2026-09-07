---
name: vite-environment-migration
description: Vite Environment API (v6+) and Rolldown migration guide (v8) — multi-environment config, custom environments, migration steps.
---

# Environment API & Rolldown Migration

## Environment API (Vite 6+)

Vite 6 introduced the Environment API to formalize multiple runtime targets beyond client/SSR.

### Default behavior (no change for SPA/MPA)

Standard projects don't need to change anything. The Environment API is mainly for framework and plugin authors.

### Concept

Each "environment" represents a different runtime target:
- `client` — browser (default)
- `ssr` — Node.js server
- Custom: `edge`, `workerd`, etc.

### Multi-environment config

```ts
export default defineConfig({
  environments: {
    client: {
      // client-specific options
    },
    ssr: {
      // SSR-specific options
      resolve: {
        conditions: ['node'],
      },
    },
    edge: {
      // custom environment
      resolve: {
        conditions: ['edge-light', 'worker'],
        noExternal: true,
      },
    },
  },
})
```

### Plugin environment access

```ts
{
  name: 'my-plugin',
  transform(code, id, options) {
    if (options?.ssr) {
      // SSR environment
    }
    // For Vite 6+ environment API:
    if (options?.environment?.name === 'edge') {
      // edge environment
    }
  },
}
```

### Custom environment instances

For platforms like Cloudflare Workers:

```ts
import { DevEnvironment } from 'vite'

class WorkerdEnvironment extends DevEnvironment {
  // Custom implementation for workerd runtime
}
```

### Who should use it

| Role | Action |
|------|--------|
| End users | No action needed for SPA/MPA |
| Plugin authors | Use `options?.ssr` for compatibility, environment API for advanced cases |
| Framework authors | Define custom environments, handle module execution |

---

## Rolldown Migration (Vite 8)

Vite 8 replaces esbuild + Rollup with Oxc + Rolldown.

### What changed

| Component | Before (Vite ≤7) | After (Vite 8) |
|-----------|-------------------|----------------|
| Transpiler | esbuild | Oxc Transformer |
| Bundler | Rollup | Rolldown |
| Minifier | esbuild / terser | Oxc / terser |

### Performance

- **10–30× faster builds** compared to Rollup-based Vite
- Same dev experience — Rolldown is drop-in compatible

### Config migration

#### `rollupOptions` → `rolldownOptions`

```ts
// Vite ≤7
export default defineConfig({
  build: {
    rollupOptions: {
      input: { main: 'index.html' },
      external: ['vue'],
    },
  },
})

// Vite 8+
export default defineConfig({
  build: {
    rolldownOptions: {
      input: { main: 'index.html' },
      external: ['vue'],
    },
  },
})
```

#### `esbuild` → `oxc`

```ts
// Before (Vite ≤7)
export default defineConfig({
  esbuild: {
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
    target: 'es2020',
  },
})

// After (Vite 8)
export default defineConfig({
  oxc: {
    jsx: {
      runtime: 'classic',
      pragma: 'h',
      pragmaFrag: 'Fragment',
    },
  },
  build: {
    target: 'es2020',
  },
})
```

### JSX config under `oxc`

```ts
export default defineConfig({
  oxc: {
    jsx: {
      runtime: 'automatic',     // or 'classic'
      importSource: 'react',    // or 'preact'
    },
  },
})
```

### Custom transform targets

```ts
export default defineConfig({
  oxc: {
    include: ['**/*.ts'],
    exclude: ['node_modules/**'],
  },
})
```

### Plugin compatibility

Most Rollup plugins work with Rolldown. Exceptions:
- Plugins using `moduleParsed` hook (not called in dev)
- Plugins with strong coupling between bundle/output phase hooks
- Plugins relying on Rollup-specific internal APIs

### New Rolldown capabilities

| Feature | Description |
|---------|-------------|
| Full bundle mode | Bundle even in dev for edge/worker environments |
| Persistent cache | Faster rebuilds with cross-session caching |
| Module Federation | Native support for micro-frontend module sharing |

### Gradual migration path

1. **Test with `rolldown-vite`** (Vite 6/7 compatible package):

```bash
# package.json
{
  "overrides": {
    "vite": "npm:rolldown-vite@latest"
  }
}
```

2. **Upgrade to Vite 8** when ready:

```bash
npm install vite@latest
```

3. **Update config**: rename `rollupOptions` → `rolldownOptions`, `esbuild` → `oxc`

### Override Vite version in frameworks

```json
// pnpm
{
  "pnpm": {
    "overrides": {
      "vite": "npm:rolldown-vite@latest"
    }
  }
}
```

```json
// npm
{
  "overrides": {
    "vite": "npm:rolldown-vite@latest"
  }
}
```

<!-- Source references:
  - https://vite.dev/guide/api-environment
  - https://vite.dev/blog/announcing-vite6
  - https://github.com/vitejs/vite (Rolldown migration docs)
  - https://github.com/antfu/skills/blob/main/skills/vite/references/rolldown-migration.md
-->
