# ES Modules

Use native ES modules (`import`/`export`) for all new JavaScript. In Node, set `"type": "module"` in `package.json` or use the `.mjs` extension.

## Named vs default exports

Prefer **named exports**. They are explicit, tree-shakeable, and rename safely across a codebase.

```js
// good
export function formatPrice(value) { /* ... */ }
export function parsePrice(text) { /* ... */ }

// import
import { formatPrice, parsePrice } from './money.js'
```

Use a **default export** only when the module has one clear primary export (a class, a component, a config object):

```js
export default class OrderService { /* ... */ }
```

Avoid mixing one default with many named exports — it confuses import sites and tooling.

## No side effects at import time

A module should define things, not *do* things when imported.

```js
// bad — runs on import
const config = await fetch('/config.json').then((r) => r.json())
export { config }

// good — caller decides when to run
export async function loadConfig() {
  const res = await fetch('/config.json')
  return res.json()
}
```

## Import order

Group and order imports for scannability:

1. Node built-ins (`node:fs`, `node:path`)
2. External packages (`axios`, `lodash-es`)
3. Internal modules / aliases (`@/utils`, `./local.js`)

```js
import { readFile } from 'node:fs/promises'

import axios from 'axios'

import { logger } from '@/lib/logger.js'
import { formatPrice } from './money.js'
```

## Barrel files

Re-export from an `index.js` to simplify imports — but keep them shallow to avoid circular dependencies and bundle bloat.

```js
// features/orders/index.js
export { OrderService } from './order-service.js'
export { formatOrder } from './format.js'
```

## Dynamic import

Use `import()` for lazy-loading heavy or rarely-used code:

```js
async function openEditor() {
  const { Editor } = await import('./editor.js')
  return new Editor()
}
```

## Extensions and specifiers

- Include the file extension in relative imports for Node ESM (`./money.js`).
- Use the `node:` prefix for built-ins (`import { join } from 'node:path'`).
