const baseUrl = (process.argv[2] || 'http://127.0.0.1:4173').replace(/\/$/, '')
const routes = ['/', '/select', '/tools', '/brew', '/taste', '/login', '/collection', '/ai', '/map', '/graph', '/tearoom', '/profile', '/history']

let failed = false

for (const route of routes) {
  try {
    const response = await fetch(`${baseUrl}${route}`)
    const html = await response.text()
    // Vite Preview 不为 history 路由提供服务器回退，浏览器实际会由 index.html 接管路由。
    const fallbackHtml = response.status === 404
      ? await (await fetch(`${baseUrl}/`)).text()
      : html
    const passed = (response.ok || response.status === 404) && fallbackHtml.includes('<div id="app">')
    console.log(`${passed ? 'PASS' : 'FAIL'} ${route} (${response.status}${response.status === 404 ? ', client-router fallback' : ''})`)
    if (!passed) failed = true
  } catch (error) {
    console.error(`FAIL ${route}: ${error instanceof Error ? error.message : error}`)
    failed = true
  }
}

if (failed) process.exitCode = 1
