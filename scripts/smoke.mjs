const baseUrl = (process.argv[2] || 'http://127.0.0.1:4173').replace(/\/$/, '')
const routes = ['/', '/select', '/tools', '/brew', '/taste', '/login', '/collection', '/ai', '/map', '/graph', '/tearoom', '/profile', '/history']

let failed = false

for (const route of routes) {
  try {
    const response = await fetch(`${baseUrl}${route}`)
    const html = await response.text()
    const passed = response.ok && html.includes('<div id="app">')
    console.log(`${passed ? 'PASS' : 'FAIL'} ${route} (${response.status})`)
    if (!passed) failed = true
  } catch (error) {
    console.error(`FAIL ${route}: ${error instanceof Error ? error.message : error}`)
    failed = true
  }
}

if (failed) process.exitCode = 1
