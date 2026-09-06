<script setup lang="ts">
/**
 * 一键茶歇 · 呼吸种茶：忙碌人的 3 秒静心暂停键。
 * - 中央 Canvas 分形茶树，随时间从种子慢慢长成（5分钟）
 * - 点击屏幕：茶树摇曳 + 额外冒一片嫩叶（养成正反馈）
 * - 呼吸引导文字（吸气4s/呼气6s）+ 柔和呼吸光晕
 * - 煮水环境音（Web Audio 合成）
 * - 结束：茶树长成 + 茶诗 + 已静心时长 + confetti 撒花
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import confetti from 'canvas-confetti'
import { TEA_POEMS } from '@/data/teaPoems'
import { startBoiling, stopBoiling } from '@/composables/useAudio'

const router = useRouter()

const TOTAL_SECONDS = 300 // 5 分钟
const remaining = ref(TOTAL_SECONDS)
const isPaused = ref(false)
const isFinished = ref(false)
const breathPhase = ref<'inhale' | 'exhale'>('inhale')
const soundOn = ref(true)
// 声音泡茶模式：环境安静→茶树长得快且绿，吵→长得慢且黄
const soundMode = ref(false)
const micLevel = ref(0) // 0-1 环境音量
let audioCtx: AudioContext | null = null
let analyser: AnalyserNode | null = null
let mediaStream: MediaStream | null = null
let micRafId: number | null = null

// 茶树生长
const canvasRef = ref<HTMLCanvasElement | null>(null)
const treeSeed = ref(Math.floor(Math.random() * 100000))
const growthBoost = ref(0) // 点击带来的额外生长
const sway = ref(0) // 摇曳强度
let rafId: number | null = null
let startTime = 0
let pausedElapsed = 0 // 暂停时累计已过时间
let pauseStart = 0

let timer: ReturnType<typeof setInterval> | null = null
let breathTimer: ReturnType<typeof setInterval> | null = null

const timeText = computed(() => {
  const m = Math.floor(remaining.value / 60)
  const s = remaining.value % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

const elapsedMinutes = computed(() => Math.max(1, Math.round((TOTAL_SECONDS - remaining.value) / 60)))

const endingPoem = computed(() => {
  const idx = Math.floor(Math.random() * TEA_POEMS.length)
  return TEA_POEMS[idx] ?? { content: '山静无人，水自流。', author: '古谚' }
})

function tick() {
  if (remaining.value > 0) {
    remaining.value -= 1
  } else {
    finish()
  }
}

function updateBreathPhase() {
  const cyclePos = (Date.now() / 1000) % 10
  breathPhase.value = cyclePos < 4 ? 'inhale' : 'exhale'
}

function startTimers() {
  if (timer) clearInterval(timer)
  if (breathTimer) clearInterval(breathTimer)
  timer = setInterval(tick, 1000)
  breathTimer = setInterval(updateBreathPhase, 100)
}

function stopTimers() {
  if (timer) { clearInterval(timer); timer = null }
  if (breathTimer) { clearInterval(breathTimer); breathTimer = null }
}

/** 伪随机：基于种子的可复现随机 */
function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

/** 递归画分形茶树 */
function drawBranch(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  len: number, angle: number,
  depth: number, maxDepth: number,
  rand: () => number,
  swayOffset: number,
  leafProgress: number,
  leafColor: string,
) {
  if (depth <= 0 || len < 3) return
  // 当前深度是否已生长出来
  const depthProgress = (maxDepth - depth) / maxDepth
  if (depthProgress > leafProgress + 0.15) return

  const swayAngle = swayOffset * (depth / maxDepth) * 0.3
  const a = angle + swayAngle
  const x2 = x + len * Math.cos(a)
  const y2 = y + len * Math.sin(a)

  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x2, y2)
  const isTrunk = depth > maxDepth - 2
  ctx.strokeStyle = isTrunk ? '#5d4e37' : '#6b7f3a'
  ctx.lineWidth = Math.max(0.8, depth * 1.1)
  ctx.lineCap = 'round'
  ctx.stroke()

  // 末端嫩叶
  if (depth <= 2 && leafProgress > 0.55) {
    const leafSize = 2.5 + rand() * 2.5
    const leafAlpha = Math.min(1, (leafProgress - 0.55) / 0.3)
    ctx.beginPath()
    ctx.arc(x2, y2, leafSize, 0, Math.PI * 2)
    ctx.fillStyle = leafColor.replace('ALPHA', String(leafAlpha * 0.85))
    ctx.fill()
    // 嫩芽点
    if (rand() > 0.5) {
      ctx.beginPath()
      ctx.arc(x2 + (rand() - 0.5) * 6, y2 + (rand() - 0.5) * 6, 1.5, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(200, 220, 130, ${leafAlpha * 0.9})`
      ctx.fill()
    }
  }

  const branchAngle = 0.35 + rand() * 0.2
  const lenRatio = 0.72 + rand() * 0.08
  drawBranch(ctx, x2, y2, len * lenRatio, a - branchAngle, depth - 1, maxDepth, rand, swayOffset, leafProgress, leafColor)
  drawBranch(ctx, x2, y2, len * lenRatio, a + branchAngle, depth - 1, maxDepth, rand, swayOffset, leafProgress, leafColor)
}

function render() {
  const canvas = canvasRef.value
  if (!canvas) { rafId = requestAnimationFrame(render); return }
  const ctx = canvas.getContext('2d')
  if (!ctx) { rafId = requestAnimationFrame(render); return }

  const dpr = window.devicePixelRatio || 1
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr
    canvas.height = h * dpr
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  // 生长进度：时间占 85%，最后 15% 树已长成可欣赏
  const elapsed = isPaused.value
    ? pausedElapsed
    : (Date.now() - startTime) / 1000 + pausedElapsed
  let progress = Math.min(1, elapsed / (TOTAL_SECONDS * 0.85)) + growthBoost.value * 0.3
  // 声音模式：安静→加速生长，吵→减速
  if (soundMode.value) {
    const quietBonus = (1 - micLevel.value) * 0.15 // 最安静时 +15% 进度
    const noisePenalty = micLevel.value * 0.1 // 最吵时 -10%
    progress += quietBonus - noisePenalty
  }
  progress = Math.min(1, Math.max(0, progress))

  // 叶子颜色：声音模式下安静翠绿、吵时偏黄
  const leafColor = soundMode.value
    ? `rgba(${Math.round(124 + micLevel.value * 77)}, ${Math.round(179 - micLevel.value * 69)}, ${Math.round(66 + micLevel.value * 44)}, ALPHA)`
    : 'rgba(124, 179, 66, ALPHA)'

  // 摇曳衰减
  sway.value *= 0.92

  // 呼吸光晕（树背后）
  const breathScale = breathPhase.value === 'inhale' ? 1.15 : 0.9
  const glowR = Math.min(w, h) * 0.42 * breathScale
  const glow = ctx.createRadialGradient(w / 2, h * 0.55, 0, w / 2, h * 0.55, glowR)
  glow.addColorStop(0, 'rgba(201, 169, 110, 0.18)')
  glow.addColorStop(0.6, 'rgba(201, 169, 110, 0.06)')
  glow.addColorStop(1, 'transparent')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)

  // 画茶树
  const rand = seededRandom(treeSeed.value)
  const maxDepth = 8
  const trunkLen = Math.min(w, h) * 0.22
  const baseX = w / 2
  const baseY = h * 0.88
  drawBranch(ctx, baseX, baseY, trunkLen, -Math.PI / 2, maxDepth, maxDepth, rand, sway.value, progress, leafColor)

  // 地面
  ctx.beginPath()
  ctx.ellipse(baseX, baseY + 4, w * 0.18, 6, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(93, 78, 55, 0.3)'
  ctx.fill()

  rafId = requestAnimationFrame(render)
}

function handleTap() {
  if (isPaused.value || isFinished.value) return
  growthBoost.value = Math.min(0.5, growthBoost.value + 0.012)
  sway.value = 1
}

function togglePause() {
  if (isPaused.value) {
    isPaused.value = false
    pausedElapsed += (Date.now() - pauseStart) / 1000
    startTimers()
    if (soundOn.value) startBoiling()
  } else {
    isPaused.value = true
    pauseStart = Date.now()
    stopTimers()
    stopBoiling()
  }
}

function finish() {
  stopTimers()
  stopBoiling()
  isFinished.value = true
  growthBoost.value = 0.5 // 结束时确保树完全长成
  confetti({
    particleCount: 90, spread: 75, origin: { y: 0.6 },
    colors: ['#C9A96E', '#9E8050', '#E8D9B8', '#6B8E23', '#5D4E37'], scalar: 1.1,
  })
  setTimeout(() => {
    confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#C9A96E', '#9E8050', '#E8D9B8'] })
    confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#C9A96E', '#9E8050', '#E8D9B8'] })
  }, 250)
}

function toggleSound() {
  soundOn.value = !soundOn.value
  if (soundOn.value && !isPaused.value && !isFinished.value) startBoiling()
  else stopBoiling()
}

/** 声音泡茶模式：开启麦克风检测环境音量 */
async function toggleSoundMode() {
  if (soundMode.value) {
    stopMic()
    soundMode.value = false
    return
  }
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    audioCtx = new AudioContext()
    const source = audioCtx.createMediaStreamSource(mediaStream)
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)
    soundMode.value = true
    micLoop()
  } catch {
    // 用户拒绝授权或不支持，静默关闭
    soundMode.value = false
  }
}

function micLoop() {
  if (!analyser) return
  const data = new Uint8Array(analyser.frequencyBinCount)
  analyser.getByteFrequencyData(data)
  let sum = 0
  for (let i = 0; i < data.length; i++) sum += data[i] ?? 0
  const avg = sum / data.length / 255 // 0-1
  micLevel.value = Math.min(1, avg * 3) // 放大使变化可感知
  micRafId = requestAnimationFrame(micLoop)
}

function stopMic() {
  if (micRafId) cancelAnimationFrame(micRafId)
  micRafId = null
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop())
    mediaStream = null
  }
  if (audioCtx) {
    audioCtx.close().catch(() => {})
    audioCtx = null
  }
  analyser = null
  micLevel.value = 0
}

function goHome() { router.push('/') }

onMounted(() => {
  startTime = Date.now()
  startTimers()
  if (soundOn.value) startBoiling()
  rafId = requestAnimationFrame(render)
})

onUnmounted(() => {
  stopTimers()
  stopBoiling()
  stopMic()
  if (rafId) cancelAnimationFrame(rafId)
})
</script>

<template>
  <main class="break-screen">
    <!-- 进行中 -->
    <div v-if="!isFinished" class="break-content">
      <div class="break-top">
        <span class="break-timer">{{ timeText }}</span>
        <div class="top-btns">
          <button
            class="sound-btn"
            :class="{ active: soundMode }"
            @click="toggleSoundMode"
            :aria-label="soundMode ? '关闭声音模式' : '开启声音模式'"
            title="声音模式：环境越安静茶长得越好"
          >
            🎤
          </button>
          <button class="sound-btn" @click="toggleSound" :aria-label="soundOn ? '关闭环境音' : '开启环境音'">
            {{ soundOn ? '🔊' : '🔇' }}
          </button>
        </div>
      </div>
      <div v-if="soundMode" class="mic-indicator">
        <div class="mic-bar"><div class="mic-fill" :style="{ width: (micLevel * 100) + '%' }"></div></div>
        <span class="mic-label">{{ micLevel < 0.2 ? '很安静·茶在疯长' : micLevel < 0.5 ? '还好·慢慢长' : '有点吵·长得慢' }}</span>
      </div>

      <div class="tree-wrap" @click="handleTap">
        <canvas ref="canvasRef" class="tree-canvas"></canvas>
        <p class="breath-text">{{ breathPhase === 'inhale' ? '吸气…' : '呼气…' }}</p>
        <p class="tap-hint">轻触屏幕，助它生长</p>
      </div>

      <p class="break-hint">给忙碌的一天，留五分钟茶歇</p>

      <div class="break-actions">
        <button class="break-btn secondary" @click="togglePause">
          {{ isPaused ? '继续' : '暂停' }}
        </button>
        <button class="break-btn primary" @click="finish">结束茶歇</button>
      </div>
    </div>

    <!-- 结束态 -->
    <div v-else class="finish-content">
      <p class="finish-label">你用 {{ elapsedMinutes }} 分钟种出了这棵茶</p>
      <blockquote class="finish-poem">“{{ endingPoem.content }}”</blockquote>
      <p class="finish-poet">—— {{ endingPoem.author }}</p>
      <button class="break-btn primary finish-btn" @click="goHome">回到首页</button>
    </div>
  </main>
</template>

<style scoped>
.break-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(ellipse at 50% 30%, rgba(201, 169, 110, 0.15), transparent 60%),
    linear-gradient(160deg, #0f1a14 0%, #1a2420 50%, #0d1410 100%);
  color: #f5f1e6;
  padding: 2rem 1rem;
  position: relative;
  overflow: hidden;
}

.break-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.2rem;
  width: 100%;
  max-width: 480px;
}

.break-top {
  position: absolute;
  top: 1.5rem; left: 0; right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 1.5rem;
}

.break-timer {
  font-size: 1.5rem;
  font-weight: 300;
  letter-spacing: 0.15em;
  color: rgba(245, 241, 230, 0.7);
  font-variant-numeric: tabular-nums;
}

.sound-btn {
  background: rgba(245, 241, 230, 0.08);
  border: 1px solid rgba(245, 241, 230, 0.15);
  border-radius: 999px;
  width: 2.5rem; height: 2.5rem;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}
.sound-btn:hover { background: rgba(245, 241, 230, 0.15); }
.sound-btn.active {
  background: rgba(201, 169, 110, 0.3);
  border-color: rgba(201, 169, 110, 0.6);
}
.top-btns { display: flex; gap: 0.5rem; }

.mic-indicator {
  position: absolute;
  top: 4.2rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  width: 160px;
}
.mic-bar {
  width: 100%;
  height: 4px;
  background: rgba(245, 241, 230, 0.12);
  border-radius: 999px;
  overflow: hidden;
}
.mic-fill {
  height: 100%;
  background: linear-gradient(90deg, #7cb342, #c9a96e);
  border-radius: 999px;
  transition: width 0.15s ease-out;
}
.mic-label {
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  color: rgba(245, 241, 230, 0.5);
}

.tree-wrap {
  position: relative;
  width: 100%;
  max-width: 380px;
  height: 380px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.tree-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.breath-text {
  position: absolute;
  top: 38%;
  font-size: 1rem;
  letter-spacing: 0.3em;
  color: rgba(245, 241, 230, 0.6);
  font-weight: 300;
  pointer-events: none;
  z-index: 2;
}

.tap-hint {
  position: absolute;
  bottom: 0.5rem;
  font-size: 0.72rem;
  letter-spacing: 0.2em;
  color: rgba(245, 241, 230, 0.3);
  pointer-events: none;
}

.break-hint {
  font-size: 0.85rem;
  letter-spacing: 0.2em;
  color: rgba(245, 241, 230, 0.45);
  text-align: center;
  margin: 0;
}

.break-actions {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
}

.break-btn {
  padding: 0.75rem 1.8rem;
  border-radius: 999px;
  font-size: 0.9rem;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all 0.25s;
  border: 1px solid transparent;
  font-family: inherit;
}
.break-btn.primary {
  background: rgba(201, 169, 110, 0.9);
  color: #1a2420;
  font-weight: 500;
}
.break-btn.primary:hover { background: #c9a96e; transform: translateY(-1px); }
.break-btn.secondary {
  background: transparent;
  border-color: rgba(245, 241, 230, 0.25);
  color: rgba(245, 241, 230, 0.8);
}
.break-btn.secondary:hover { border-color: rgba(245, 241, 230, 0.5); background: rgba(245, 241, 230, 0.05); }

/* 结束态 */
.finish-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  text-align: center;
  max-width: 480px;
  animation: fadeUp 0.8s ease-out;
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
.finish-label {
  font-size: 0.9rem;
  letter-spacing: 0.25em;
  color: #c9a96e;
  margin: 0;
}
.finish-poem {
  font-size: 1.4rem;
  line-height: 2;
  color: #f5f1e6;
  margin: 0;
  font-weight: 300;
}
.finish-poet {
  font-size: 0.85rem;
  color: rgba(245, 241, 230, 0.5);
  margin: 0;
  letter-spacing: 0.1em;
}
.finish-btn { margin-top: 1.5rem; }

@media (max-width: 480px) {
  .tree-wrap { max-width: 320px; height: 320px; }
  .finish-poem { font-size: 1.2rem; }
}
</style>
