---
name: javascript-node
description: Node.js (>=18) best practices with ES modules. Covers node: built-in imports, fs/promises, path handling, process.env and configuration, CLI scripts, child processes, streams and pipeline, AbortController timeouts, graceful shutdown, error handling for unhandledRejection, and worker threads. Load when writing Node.js scripts, servers, CLI tools, build tooling, or anything running outside the browser.
license: MIT
metadata:
  sources:
    - https://nodejs.org/docs/latest/api/ (Node.js official documentation)
  version: "1.0.0"
compatibility: Node.js >=18, ESM ("type": "module")
---

# Node.js — Best Practices

> Node ≥18, ES modules. Use `node:` prefixed built-ins and promise-based APIs.

## Core Rules

- **`node:` prefix for built-ins** — `import { readFile } from 'node:fs/promises'`.
- **Promise APIs over callbacks** — `fs/promises`, `stream/promises`, `timers/promises`.
- **Never block the event loop** — no sync I/O (`readFileSync`) in servers/hot paths.
- **Always handle `unhandledRejection`** — in Node it crashes the process.
- **Build paths with `node:path`** — never concatenate with `/`.
- **Validate `process.env` once at startup** — fail fast on missing config.

---

## 1) Module Setup

`package.json`:

```json
{
  "type": "module",
  "engines": { "node": ">=18" }
}
```

```js
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
```

- Relative imports include the extension: `./utils.js`.
- Node ≥20.11: `import.meta.dirname` / `import.meta.filename` replace the `fileURLToPath` dance.

---

## 2) File System

```js
import { readFile, writeFile, mkdir, readdir, stat, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const config = JSON.parse(await readFile(join(__dirname, 'config.json'), 'utf8'))

await mkdir(outDir, { recursive: true })
await writeFile(join(outDir, 'report.json'), JSON.stringify(report, null, 2))
```

- Always pass `'utf8'` when you want a string — otherwise you get a `Buffer`.
- `mkdir` with `recursive: true` never throws on existing dirs.
- Check existence with `existsSync` only for CLI ergonomics; in async flows prefer try/catch on the operation itself (avoids TOCTOU races).
- Large files → streams (section 5), not `readFile`.

---

## 3) Configuration & Environment

```js
const required = ['DATABASE_URL', 'API_KEY']
const missing = required.filter((key) => !process.env[key])
if (missing.length > 0) {
  console.error(`Missing env vars: ${missing.join(', ')}`)
  process.exit(1)
}

export const config = {
  databaseUrl: process.env.DATABASE_URL,
  apiKey: process.env.API_KEY,
  port: Number(process.env.PORT ?? 3000),
  isProd: process.env.NODE_ENV === 'production',
}
```

- Validate and normalize env **once** at startup; import `config` everywhere else.
- Env values are always strings — convert numbers/booleans explicitly.
- Node ≥20.6 loads `.env` natively: `node --env-file=.env app.js`.

---

## 4) CLI Scripts

```js
import { parseArgs } from 'node:util'

const { values, positionals } = parseArgs({
  options: {
    output: { type: 'string', short: 'o', default: 'dist' },
    verbose: { type: 'boolean', short: 'v', default: false },
  },
  allowPositionals: true,
})
```

- `node:util` `parseArgs` for flags — no dependency needed for simple CLIs.
- Exit codes: `0` success, non-zero failure; set `process.exitCode = 1` instead of `process.exit(1)` when cleanup must finish.
- Write errors to `console.error` (stderr), results to `console.log` (stdout) — keeps piping clean.

---

## 5) Streams

Use `pipeline` — it propagates errors and cleans up:

```js
import { createReadStream, createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { createGzip } from 'node:zlib'

await pipeline(
  createReadStream('access.log'),
  createGzip(),
  createWriteStream('access.log.gz'),
)
```

Process huge files line by line:

```js
import { createInterface } from 'node:readline'

const rl = createInterface({ input: createReadStream('big.csv') })
for await (const line of rl) {
  processLine(line)
}
```

- Never `.pipe()` manually without error handling — use `pipeline`.
- Web Streams (`ReadableStream`) interop: `Readable.fromWeb()` / `.toWeb()`.

---

## 6) Child Processes

```js
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'])
```

- `execFile` (args array) over `exec` (shell string) — no shell injection.
- Pass user input only as array arguments, never interpolated into a command string.
- Long-running processes → `spawn` with stream handling.
- Set `timeout` and `maxBuffer` for untrusted/long commands.

---

## 7) Timeouts & Cancellation

```js
import { setTimeout as sleep } from 'node:timers/promises'

await sleep(1000)

const response = await fetch(url, {
  signal: AbortSignal.timeout(5000),
})
```

- `AbortSignal.timeout(ms)` for any fetch/operation deadline.
- Combine signals: `AbortSignal.any([userSignal, AbortSignal.timeout(5000)])`.
- `timers/promises` for awaitable sleep — never promisify `setTimeout` manually.

---

## 8) Process Lifecycle & Errors

```js
process.on('unhandledRejection', (reason) => {
  logger.fatal('Unhandled rejection', reason)
  process.exit(1)
})

process.on('uncaughtException', (error) => {
  logger.fatal('Uncaught exception', error)
  process.exit(1)
})
```

Graceful shutdown:

```js
const server = app.listen(config.port)

async function shutdown(signal) {
  logger.info(`${signal} received, shutting down`)
  server.close()
  await db.disconnect()
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
```

- After `uncaughtException` the process state is unreliable — log and exit; let the orchestrator restart.
- Finish in-flight requests, close connections, then exit.
- Add a hard deadline: force-exit if shutdown hangs (`setTimeout(() => process.exit(1), 10_000).unref()`).

---

## 9) Worker Threads

Offload CPU-heavy work (parsing, crypto, image processing) — the main thread must stay free for I/O:

```js
// main.js
import { Worker } from 'node:worker_threads'

function runWorker(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker.js', import.meta.url), {
      workerData: data,
    })
    worker.once('message', resolve)
    worker.once('error', reject)
  })
}

// worker.js
import { parentPort, workerData } from 'node:worker_threads'
parentPort.postMessage(heavyComputation(workerData))
```

Rule of thumb: anything that blocks > ~50ms in a server belongs in a worker.

---

## 10) Final Self-Check

- ESM with `node:` prefixed built-ins, extensions in relative imports.
- No sync I/O in request/hot paths.
- Env validated at startup, single `config` export.
- Paths via `node:path`, child processes via `execFile`/`spawn` with arg arrays.
- Streams use `pipeline`; big files never fully buffered.
- Every external call has a timeout (`AbortSignal.timeout`).
- `unhandledRejection`/`uncaughtException` handlers + graceful shutdown wired.
