<script setup lang="ts">
/**
 * 茶味通感：把每款茶的风味翻译成声音 + 视觉粒子。
 * - 基于茶类的五声音阶（宫商角徵羽）随机旋律，古琴泛音感
 * - 汤色粒子从底部升起，每个音符触发时粒子律动扩散
 * - 30 秒视听体验，结束后显示"这就是XX的味道"
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getTeaById } from '@/data/teas'
import type { Tea } from '@/types/tea'

const route = useRoute()
const router = useRouter()

const tea = computed<Tea | null>(() => getTeaById(String(route.params.id)) ?? null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const isPlaying = ref(true)
const isFinished = ref(false)
const elapsed = ref(0)

const DURATION = 30 // 秒
let rafId: number | null = null
let audioCtx: AudioContext | null = null
let masterGain: GainNode | null = null
let analyser: AnalyserNode | null = null
let noteTimer: ReturnType<typeof setTimeout> | null = null
let startTime = 0

// 粒子
interface Particle { x: number; y: number; vx: number; vy: number; size: number; alpha: number; color: string; pulse: number }
let particles: Particle[] = []
let lastNoteTime = 0

/** 五声音阶（宫商角徵羽）频率，按八度偏移 */
const PENTATONIC = [1, 1.125, 1.25, 1.5, 1.6875] // C D E G A 比例
const BASE_FREQ = 261.63 // C4

/** 茶类→音高八度 + 音符间隔 + 波形 */
function getTeaAudioProfile(type: string) {
  switch (type) {
    case '绿茶': return { octave: 1, minGap: 1100, maxGap: 1800, wave: 'sine' as OscillatorType, drift: 0.6 }
    case '白茶': return { octave: 0.5, minGap: 1300, maxGap: 2000, wave: 'triangle' as OscillatorType, drift: 0.4 }
    case '黄茶': return { octave: 0.3, minGap: 1200, maxGap: 1900, wave: 'triangle' as OscillatorType, drift: 0.5 }
    case '青茶': return { octave: 0, minGap: 900, maxGap: 1500, wave: 'sine' as OscillatorType, drift: 0.8 }
    case '红茶': return { octave: -0.5, minGap: 800, maxGap: 1400, wave: 'sine' as OscillatorType, drift: 1.0 }
    case '黑茶': return { octave: -1, minGap: 700, maxGap: 1300, wave: 'sine' as OscillatorType, drift: 1.2 }
    default: return { octave: 0, minGap: 1000, maxGap: 1600, wave: 'sine' as OscillatorType, drift: 0.7 }
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

function initParticles(w: number, h: number, tea: Tea) {
  const [r1, g1, b1] = hexToRgb(tea.soupColorMin)
  const [r2, g2, b2] = hexToRgb(tea.soupColorMax)
  particles = []
  for (let i = 0; i < 90; i++) {
    const t = Math.random()
    const r = Math.round(r1 + (r2 - r1) * t)
    const g = Math.round(g1 + (g2 - g1) * t)
    const b = Math.round(b1 + (b2 - b1) * t)
    particles.push({
      x: Math.random() * w,
      y: h + Math.random() * h * 0.3,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -(0.2 + Math.random() * 0.5),
      size: 1.5 + Math.random() * 3.5,
      alpha: 0.3 + Math.random() * 0.5,
      color: `rgb(${r},${g},${b})`,
      pulse: 0,
    })
  }
}

function playNote() {
  if (!audioCtx || !masterGain || !tea.value || isFinished.value) return
  const profile = getTeaAudioProfile(tea.value.type)
  const scaleIdx = Math.floor(Math.random() * PENTATONIC.length)
  const freq = BASE_FREQ * Math.pow(2, profile.octave) * (PENTATONIC[scaleIdx] ?? 1)

  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = profile.wave
  osc.frequency.value = freq
  // 古琴泛音感：快速起音 + 指数衰减
  gain.gain.setValueAtTime(0, audioCtx.currentTime)
  gain.gain.linearRampToValueAtTime(0.18, audioCtx.currentTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2.5)
  osc.connect(gain)
  gain.connect(masterGain)
  osc.start()
  osc.stop(audioCtx.currentTime + 2.6)

  // 偶尔叠加一个高八度泛音
  if (Math.random() > 0.5) {
    const osc2 = audioCtx.createOscillator()
    const gain2 = audioCtx.createGain()
    osc2.type = 'sine'
    osc2.frequency.value = freq * 2
    gain2.gain.setValueAtTime(0, audioCtx.currentTime)
    gain2.gain.linearRampToValueAtTime(0.06, audioCtx.currentTime + 0.03)
    gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.8)
    osc2.connect(gain2)
    gain2.connect(masterGain)
    osc2.start()
    osc2.stop(audioCtx.currentTime + 1.9)
  }

  lastNoteTime = Date.now()
  // 粒子律动
  particles.forEach(p => { p.pulse = 1; p.vy -= 0.3 })

  // 下一个音符
  const gap = profile.minGap + Math.random() * (profile.maxGap - profile.minGap)
  noteTimer = setTimeout(playNote, gap)
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
    if (tea.value) initParticles(w, h, tea.value)
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  // 背景渐变
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#0d1410')
  bg.addColorStop(1, '#1a2420')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  // 底部光晕
  if (tea.value) {
    const glow = ctx.createRadialGradient(w / 2, h, 0, w / 2, h, h * 0.6)
    glow.addColorStop(0, tea.value.soupColorMax + '30')
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, w, h)
  }

  // 粒子
  particles.forEach(p => {
    p.pulse *= 0.94
    p.x += p.vx + Math.sin(Date.now() / 1000 + p.y) * 0.15
    p.y += p.vy
    if (p.y < -20) { p.y = h + 10; p.x = Math.random() * w }
    if (p.x < -20) p.x = w + 20
    if (p.x > w + 20) p.x = -20
    const size = p.size * (1 + p.pulse * 0.8)
    ctx.beginPath()
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2)
    ctx.globalAlpha = p.alpha * (0.7 + p.pulse * 0.3)
    ctx.fillStyle = p.color
    ctx.fill()
  })
  ctx.globalAlpha = 1

  rafId = requestAnimationFrame(render)
}

function startExperience() {
  if (!tea.value) return
  audioCtx = new AudioContext()
  masterGain = audioCtx.createGain()
  masterGain.gain.value = 0.8
  analyser = audioCtx.createAnalyser()
  masterGain.connect(analyser)
  analyser.connect(audioCtx.destination)
  startTime = Date.now()
  playNote()
  // 时长控制
  const checkEnd = () => {
    elapsed.value = Math.floor((Date.now() - startTime) / 1000)
    if (elapsed.value >= DURATION) {
      finish()
    } else if (!isFinished.value) {
      setTimeout(checkEnd, 500)
    }
  }
  checkEnd()
}

function finish() {
  isFinished.value = true
  isPlaying.value = false
  if (noteTimer) clearTimeout(noteTimer)
  if (masterGain && audioCtx) {
    masterGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.8)
  }
  setTimeout(() => {
    if (audioCtx) audioCtx.close().catch(() => {})
  }, 1500)
}

function goBack() {
  if (noteTimer) clearTimeout(noteTimer)
  if (audioCtx) audioCtx.close().catch(() => {})
  router.push(`/tea/${route.params.id}`)
}

onMounted(() => {
  rafId = requestAnimationFrame(render)
  // 延迟启动音频，等待用户交互上下文
  setTimeout(startExperience, 300)
})

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId)
  if (noteTimer) clearTimeout(noteTimer)
  if (audioCtx) audioCtx.close().catch(() => {})
})
</script>

<template>
  <main class="synth-screen">
    <canvas ref="canvasRef" class="synth-canvas"></canvas>

    <!-- 进行中 -->
    <div v-if="!isFinished" class="synth-overlay">
      <div class="synth-info">
        <p class="synth-label">听 · 茶之味</p>
        <h1 class="synth-name">{{ tea?.name ?? '未知茶' }}</h1>
        <div class="synth-flavors">
          <span v-for="f in tea?.flavor ?? []" :key="f" class="flavor-tag">{{ f }}</span>
        </div>
      </div>
      <div class="synth-bottom">
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: (elapsed / DURATION * 100) + '%' }"></div>
        </div>
        <p class="synth-hint">闭上眼睛，听这杯茶的味道</p>
        <button class="synth-btn" @click="goBack">← 返回</button>
      </div>
    </div>

    <!-- 结束态 -->
    <div v-else class="synth-overlay finish">
      <p class="finish-eyebrow">30 秒通感</p>
      <h2 class="finish-title">这就是<br/>{{ tea?.name }}的味道</h2>
      <p class="finish-desc">{{ tea?.description }}</p>
      <div class="finish-actions">
        <button class="synth-btn primary" @click="goBack">了解这款茶 →</button>
      </div>
    </div>
  </main>
</template>

<style scoped>
.synth-screen {
  position: fixed;
  inset: 0;
  background: #0d1410;
  overflow: hidden;
}
.synth-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.synth-overlay {
  position: relative;
  z-index: 2;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 3rem 1.5rem 2rem;
  color: #f5f1e6;
  pointer-events: none;
}
.synth-overlay > * { pointer-events: auto; }

.synth-info { text-align: center; margin-top: 2rem; }
.synth-label {
  font-size: 0.75rem;
  letter-spacing: 0.4em;
  color: rgba(201, 169, 110, 0.7);
  margin: 0 0 1rem;
}
.synth-name {
  font-size: 2.4rem;
  font-weight: 300;
  letter-spacing: 0.15em;
  margin: 0 0 1.2rem;
  text-shadow: 0 2px 20px rgba(0,0,0,0.5);
}
.synth-flavors { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
.flavor-tag {
  font-size: 0.75rem;
  padding: 0.3rem 0.9rem;
  border-radius: 999px;
  background: rgba(201, 169, 110, 0.12);
  border: 1px solid rgba(201, 169, 110, 0.25);
  color: rgba(245, 241, 230, 0.75);
  letter-spacing: 0.1em;
}

.synth-bottom { display: flex; flex-direction: column; align-items: center; gap: 1rem; }
.progress-track {
  width: 200px;
  height: 2px;
  background: rgba(245, 241, 230, 0.12);
  border-radius: 999px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #c9a96e, #e8d9b8);
  border-radius: 999px;
  transition: width 0.5s linear;
}
.synth-hint {
  font-size: 0.8rem;
  letter-spacing: 0.2em;
  color: rgba(245, 241, 230, 0.4);
  margin: 0;
}
.synth-btn {
  background: rgba(245, 241, 230, 0.06);
  border: 1px solid rgba(245, 241, 230, 0.2);
  color: rgba(245, 241, 230, 0.7);
  padding: 0.5rem 1.4rem;
  border-radius: 999px;
  font-size: 0.8rem;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all 0.25s;
  font-family: inherit;
}
.synth-btn:hover { background: rgba(245, 241, 230, 0.12); color: #f5f1e6; }
.synth-btn.primary {
  background: rgba(201, 169, 110, 0.9);
  border-color: rgba(201, 169, 110, 0.9);
  color: #1a2420;
  font-weight: 500;
}
.synth-btn.primary:hover { background: #c9a96e; }

/* 结束态 */
.synth-overlay.finish {
  justify-content: center;
  align-items: center;
  text-align: center;
  animation: fadeUp 1s ease-out;
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
.finish-eyebrow {
  font-size: 0.75rem;
  letter-spacing: 0.4em;
  color: rgba(201, 169, 110, 0.7);
  margin: 0 0 1.5rem;
}
.finish-title {
  font-size: 2rem;
  font-weight: 300;
  line-height: 1.6;
  letter-spacing: 0.1em;
  margin: 0 0 1.5rem;
}
.finish-desc {
  font-size: 0.85rem;
  line-height: 1.8;
  color: rgba(245, 241, 230, 0.55);
  max-width: 320px;
  margin: 0 0 2rem;
}

@media (max-width: 480px) {
  .synth-name { font-size: 1.8rem; }
  .finish-title { font-size: 1.6rem; }
}
</style>
