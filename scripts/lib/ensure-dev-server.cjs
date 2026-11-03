/** ensure-dev-server.cjs — 截图/验证脚本共享 helper：端口未监听时自动拉起 vite dev server，结束可关闭。 */
const { spawn } = require('node:child_process')
const net = require('node:net')
const fs = require('node:fs')

function portListening(port) {
  return new Promise((resolve) => {
    const sock = net.connect({ port, host: '127.0.0.1' })
    sock.once('connect', () => {
      sock.destroy()
      resolve(true)
    })
    sock.once('error', () => resolve(false))
  })
}

async function waitForServer(url, timeoutMs) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return true
    } catch {
      // 未就绪，继续轮询
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  return false
}

/**
 * 结束子进程。Windows 下 child.kill() 只杀 cmd.exe，npm/vite 的实际 node 子进程会活下来继续占端口，
 * 所以必须按进程树杀（taskkill /T）。
 */
function killTree(child) {
  if (!child || child.killed) return
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    child.kill('SIGTERM')
  }
}

/**
 * 端口已监听 → 直接复用（返回 noop stop）。
 * 未监听 → spawn npm run dev（Windows 用 npm.cmd），轮询到就绪。
 * 超时 → 杀进程树并抛错。
 * 注：url 默认绑 127.0.0.1，与 portListening 的探测地址保持一致（vite 只监听 ::1 时不该误判为未启动）。
 */
async function ensureDevServer({ port = 5173, url = `http://127.0.0.1:${port}`, timeoutMs = 60000, logFile = 'dev-server.log' } = {}) {
  if (await portListening(port)) {
    return { stop: async () => {} }
  }
  const out = fs.openSync(logFile, 'a')
  // Windows 下 .cmd 需经 cmd.exe 启动（直接 spawn npm.cmd 会 EINVAL）
  const child = process.platform === 'win32'
    ? spawn('cmd.exe', ['/c', 'npm run dev -- --host 127.0.0.1'], { stdio: ['ignore', out, out] })
    : spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1'], { stdio: ['ignore', out, out] })
  const ok = await waitForServer(url, timeoutMs)
  if (!ok) {
    killTree(child)
    throw new Error(`dev server 未在 ${timeoutMs}ms 内就绪，详见 ${logFile}`)
  }
  return { stop: async () => killTree(child) }
}

module.exports = { ensureDevServer }
