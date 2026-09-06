<script setup lang="ts">
/**
 * 一键茶歇：忙碌人的 3 秒静心暂停键。
 * - 呼吸引导柔光圆（吸气 4s / 呼气 6s）
 * - 5 分钟倒计时（可暂停/提前结束）
 * - 煮水环境音（Web Audio 合成，零文件依赖）
 * - 结束：茶诗 + 已静心时长 + confetti 撒花
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

/** 呼吸相位切换：0-4s 吸气，4-10s 呼气，每 100ms 检查 */
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

function togglePause() {
  if (isPaused.value) {
    isPaused.value = false
    startTimers()
    if (soundOn.value) startBoiling()
  } else {
    isPaused.value = true
    stopTimers()
    stopBoiling()
  }
}

function finish() {
  stopTimers()
  stopBoiling()
  isFinished.value = true
  // 茶叶金色纸屑
  confetti({
    particleCount: 90,
    spread: 75,
    origin: { y: 0.6 },
    colors: ['#C9A96E', '#9E8050', '#E8D9B8', '#6B8E23', '#5D4E37'],
    scalar: 1.1,
  })
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#C9A96E', '#9E8050', '#E8D9B8'],
    })
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#C9A96E', '#9E8050', '#E8D9B8'],
    })
  }, 250)
}

function toggleSound() {
  soundOn.value = !soundOn.value
  if (soundOn.value && !isPaused.value && !isFinished.value) {
    startBoiling()
  } else {
    stopBoiling()
  }
}

function goHome() {
  router.push('/')
}

onMounted(() => {
  startTimers()
  if (soundOn.value) startBoiling()
})

onUnmounted(() => {
  stopTimers()
  stopBoiling()
})
</script>

<template>
  <main class="break-screen">
    <!-- 进行中 -->
    <div v-if="!isFinished" class="break-content">
      <div class="break-top">
        <span class="break-timer">{{ timeText }}</span>
        <button class="sound-btn" @click="toggleSound" :aria-label="soundOn ? '关闭声音' : '开启声音'">
          {{ soundOn ? '🔊' : '🔇' }}
        </button>
      </div>

      <div class="breath-wrap">
        <div class="breath-circle" :class="breathPhase"></div>
        <p class="breath-text">{{ breathPhase === 'inhale' ? '吸气…' : '呼气…' }}</p>
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
      <p class="finish-label">已静心 {{ elapsedMinutes }} 分钟</p>
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
    radial-gradient(ellipse at 50% 30%, rgba(201, 169, 110, 0.18), transparent 60%),
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
  gap: 2rem;
  width: 100%;
  max-width: 480px;
}

.break-top {
  position: absolute;
  top: 1.5rem;
  left: 0;
  right: 0;
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
  width: 2.5rem;
  height: 2.5rem;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}
.sound-btn:hover { background: rgba(245, 241, 230, 0.15); }

.breath-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 280px;
  height: 280px;
}

.breath-circle {
  position: absolute;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(201, 169, 110, 0.45) 0%, rgba(201, 169, 110, 0.15) 50%, transparent 75%);
  box-shadow: 0 0 60px rgba(201, 169, 110, 0.3), inset 0 0 40px rgba(201, 169, 110, 0.2);
  transition: transform 0.1s linear;
}
.breath-circle.inhale {
  animation: inhale 4s ease-in-out forwards;
}
.breath-circle.exhale {
  animation: exhale 6s ease-in-out forwards;
}

@keyframes inhale {
  from { transform: scale(0.7); opacity: 0.6; }
  to { transform: scale(1.25); opacity: 1; }
}
@keyframes exhale {
  from { transform: scale(1.25); opacity: 1; }
  to { transform: scale(0.7); opacity: 0.6; }
}

.breath-text {
  position: relative;
  z-index: 2;
  font-size: 1.1rem;
  letter-spacing: 0.3em;
  color: rgba(245, 241, 230, 0.85);
  font-weight: 300;
}

.break-hint {
  font-size: 0.85rem;
  letter-spacing: 0.2em;
  color: rgba(245, 241, 230, 0.45);
  text-align: center;
}

.break-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

.break-btn {
  padding: 0.75rem 1.8rem;
  border-radius: 999px;
  font-size: 0.9rem;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all 0.25s;
  border: 1px solid transparent;
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
  letter-spacing: 0.3em;
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
  .breath-wrap { width: 240px; height: 240px; }
  .breath-circle { width: 150px; height: 150px; }
  .finish-poem { font-size: 1.2rem; }
}
</style>
