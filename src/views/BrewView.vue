<script setup lang="ts">
import { ref, computed, watch, onUnmounted, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTeaStore } from '@/stores/tea'
import { getSoupColor } from '@/data/teas'
import { WATER_TYPES } from '@/data/constants'
import { teawares } from '@/data/teawares'
import { BrewPhase } from '@/types/brewing'
import type { TeaWare } from '@/types/teaware'
import { useParticleSystem } from '@/composables/useParticles'
import { startAmbient, stopAmbient, startBoiling, stopBoiling, startCrackle, stopCrackle, playPourWater, playPourTea, stopAll } from '@/composables/useAudio'

const router = useRouter()
const store = useTeaStore()

// ============ Canvas 粒子系统 ============
const particleCanvas = useParticleSystem({ width: 256, height: 256 })

let particlesStarted = false

function syncParticlesToPhase(phase: BrewPhase) {
  if (!particlesStarted) return

  // 先停止所有
  particleCanvas.stopFire()
  particleCanvas.stopSteam()
  particleCanvas.stopRipple()
  stopAmbient()
  stopBoiling()
  stopCrackle()

  switch (phase) {
    case BrewPhase.HEATING:
      particleCanvas.startFire()
      startBoiling()
      startCrackle()
      if (store.brewState.currentTemp > 60) {
        particleCanvas.startSteam()
      }
      break
    case BrewPhase.WARMING:
    case BrewPhase.RINSING:
      particleCanvas.startSteam()
      startAmbient()
      break
    case BrewPhase.READY:
      particleCanvas.startSteam()
      startAmbient()
      break
    case BrewPhase.STEEPING:
      particleCanvas.startSteam()
      particleCanvas.startRipple()
      startAmbient()
      break
    case BrewPhase.DONE:
      particleCanvas.startSteam()
      startAmbient()
      break
  }
}

watch(() => store.brewState.phase, (newPhase, oldPhase) => {
  // 离开 HEATING 时清理加热定时器
  if (oldPhase === BrewPhase.HEATING && newPhase !== BrewPhase.HEATING) {
    stopHeating()
  }
  syncParticlesToPhase(newPhase)
})

watch(() => store.brewState.currentTemp, (temp) => {
  const target = store.brewState.targetTemp
  const intensity = target > 20 ? Math.min(1, temp / target) : 0
  particleCanvas.setFlameIntensity(Math.min(1, intensity * 1.5))
  if (particlesStarted && store.brewState.phase === BrewPhase.HEATING) {
    if (temp > 60) particleCanvas.startSteam()
    else particleCanvas.stopSteam()
  }
})

let mountedTimer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  // 给 canvas 一点时间挂载
  mountedTimer = setTimeout(() => {
    particleCanvas.start()
    particlesStarted = true
    syncParticlesToPhase(store.brewState.phase)
  }, 100)
})

onUnmounted(() => {
  // 清理粒子系统、音效、定时器
  if (mountedTimer) {
    clearTimeout(mountedTimer)
    mountedTimer = null
  }
  particleCanvas.stop()
  stopAll()
  stopHeating()
  if (warmTimer) clearTimeout(warmTimer)
  if (steepInterval) clearInterval(steepInterval)
  if (rinseInterval) clearInterval(rinseInterval)
})

// ============ 定时器 ============
let warmTimer: ReturnType<typeof setTimeout> | null = null
let heatInterval: ReturnType<typeof setInterval> | null = null
let steepInterval: ReturnType<typeof setInterval> | null = null
let rinseInterval: ReturnType<typeof setInterval> | null = null
const rinseCountdown = ref(0)

// ============ 计算属性 ============
const soupColor = computed(() => {
  if (!store.currentTea) return '#F5F0E8'
  return getSoupColor(store.currentTea, store.brewState.steepTime)
})

const flameHeight = computed(() => {
  if (store.brewState.phase !== BrewPhase.HEATING) return 0
  return Math.min(1, (store.brewState.currentTemp / Math.max(store.brewState.targetTemp, 1)) * 1.5)
})

const currentInfusion = computed(() => store.brewState.infusionsDone + 1)
const totalInfusions = computed(() => store.currentTea?.infusions ?? 1)

const recommendedSteepTime = computed(() => {
  if (!store.currentTea) return 0
  return store.currentTea.bestTime + store.brewState.infusionsDone * 5
})

// 当前阶段是否为 IDLE
const isIdle = computed(() => store.brewState.phase === BrewPhase.IDLE)
const hasTeaWare = computed(() => store.selectedTeaWare !== null)

// ============ 温度控制 ============
function onTempSlider(value: string) {
  store.setTargetTemp(parseInt(value))
}

function onWeightSlider(value: string) {
  store.setTeaWeight(parseFloat(value))
}

function startHeating() {
  if (store.brewState.currentTemp >= store.brewState.targetTemp) {
    store.updateTemp(store.brewState.targetTemp)
    return
  }
  store.startHeating()
  heatInterval = window.setInterval(() => {
    const current = store.brewState.currentTemp
    const target = store.brewState.targetTemp
    if (current < target) {
      store.updateTemp(Math.min(current + 1, target))
    }
  }, 80)
}

function stopHeating() {
  if (heatInterval) {
    clearInterval(heatInterval)
    heatInterval = null
  }
}

// ============ 茶器选择 ============
function selectWare(ware: TeaWare) {
  if (!store.isTeaWareUnlocked(ware.id)) return  // 未解锁不可选
  store.selectTeaWare(ware)
}

// ============ 冲泡阶段控制 ============
function handleWarming() {
  playPourWater(1.0)  // 先播音效
  store.completeWarming()  // 再切换阶段
  if (warmTimer) clearTimeout(warmTimer)
  warmTimer = setTimeout(() => startRinsing(), 800)
}

function startRinsing() {
  if (rinseInterval) clearInterval(rinseInterval)
  rinseCountdown.value = 5
  rinseInterval = window.setInterval(() => {
    rinseCountdown.value--
    if (rinseCountdown.value <= 0) {
      if (rinseInterval) {
        clearInterval(rinseInterval)
        rinseInterval = null
      }
      store.completeRinsing()
    }
  }, 1000)
}

function startSteeping() {
  store.startSteeping()
  steepInterval = window.setInterval(() => {
    store.updateSteepTime(store.brewState.steepTime + 1)
  }, 1000)
}

function stopSteeping() {
  if (steepInterval) {
    clearInterval(steepInterval)
    steepInterval = null
  }
  store.stopSteeping()
  playPourTea(1.5)  // 出汤声
}

function handleMainAction() {
  const phase = store.brewState.phase

  if (phase === BrewPhase.IDLE) {
    startHeating()
  } else if (phase === BrewPhase.WARMING) {
    handleWarming()
  } else if (phase === BrewPhase.READY) {
    startSteeping()
  } else if (phase === BrewPhase.STEEPING) {
    stopSteeping()
  } else if (phase === BrewPhase.DONE) {
    if (store.brewState.infusionsDone < (store.currentTea?.infusions ?? 0)) {
      store.nextInfusion()
      startSteeping()
    } else {
      router.push('/taste')
    }
  }
}

// ============ 按钮标签 ============
const mainActionLabel = computed(() => {
  switch (store.brewState.phase) {
    case BrewPhase.IDLE:
      return hasTeaWare.value ? '开始煮水' : '请选择茶器'
    case BrewPhase.HEATING:
      return `${store.brewState.currentTemp}°C`
    case BrewPhase.WARMING:
      return '🫖 温杯'
    case BrewPhase.RINSING:
      return `醒茶中 ${rinseCountdown.value}s`
    case BrewPhase.READY:
      return `第${currentInfusion.value}泡 · 开始冲泡`
    case BrewPhase.STEEPING:
      return `出汤 (${store.brewState.steepTime}s)`
    case BrewPhase.DONE:
      return store.brewState.infusionsDone < (store.currentTea?.infusions ?? 0)
        ? '继续冲泡'
        : '开始品鉴 →'
  }
})

const phaseDescription = computed(() => {
  switch (store.brewState.phase) {
    case BrewPhase.IDLE:
      return '选择茶器，设定水温与投茶量'
    case BrewPhase.HEATING:
      return `电陶炉加热中... 目标 ${store.brewState.targetTemp}°C`
    case BrewPhase.WARMING:
      return '用热水温润茶器，提升茶汤品质'
    case BrewPhase.RINSING:
      return '醒茶（洗茶）中，唤醒茶香'
    case BrewPhase.READY:
      return `水已沸，茶器已备，推荐浸泡 ${recommendedSteepTime.value} 秒`
    case BrewPhase.STEEPING:
      return `第${currentInfusion.value}泡 · 推荐 ${recommendedSteepTime.value} 秒`
    case BrewPhase.DONE:
      return `第${currentInfusion.value}泡（${store.brewState.steepTime}s）完成`
  }
})


</script>

<template>
  <div class="min-h-screen p-4 sm:p-8 flex flex-col items-center">
    <h2 class="text-3xl font-bold text-[var(--color-wood)] mb-2">冲泡</h2>
    <p v-if="store.currentTea" class="text-lg text-[var(--color-wood)] mb-1">
      {{ store.currentTea.name }}
    </p>
    <p class="text-sm text-[var(--color-wood-light)] mb-6">{{ phaseDescription }}</p>

    <!-- ======== IDLE：茶器选择 + 参数设定 ======== -->
    <div v-if="isIdle" class="w-full max-w-lg mb-6">
      <p class="text-sm text-[var(--color-wood)] mb-3">选择茶器：</p>
      <div class="grid grid-cols-3 gap-3">
        <button
          v-for="ware in teawares" :key="ware.id"
          @click="selectWare(ware)"
          class="p-3 rounded-xl border-2 transition-all text-center relative"
          :class="[
            !store.isTeaWareUnlocked(ware.id)
              ? 'border-transparent bg-gray-100 opacity-60 cursor-not-allowed'
              : store.selectedTeaWare?.id === ware.id
                ? 'border-[var(--color-tea-gold)] bg-[var(--color-paper)] shadow-md scale-105'
                : 'border-transparent bg-white hover:shadow-md'
          ]"
        >
          <div v-if="!store.isTeaWareUnlocked(ware.id)" class="absolute inset-0 flex items-center justify-center bg-white/40 rounded-xl z-10">
            <span class="text-lg">🔒</span>
          </div>
          <div class="text-2xl mb-1">
            {{ ware.id === 'gaiwan' ? '🍵' : ware.id === 'yixing' ? '🫖' : ware.id === 'glass' ? '🥛' : ware.id === 'celadon' ? '🍶' : ware.id === 'duanning' ? '🫖' : '🏺' }}
          </div>
          <p class="text-sm font-bold text-[var(--color-wood)]">{{ ware.name }}</p>
          <p class="text-xs text-[var(--color-wood-light)] mt-1">{{ ware.material }}</p>
          <p class="text-xs text-[var(--color-wood-light)]">{{ ware.capacity }}ml</p>
          <p v-if="!store.isTeaWareUnlocked(ware.id)" class="text-[10px] text-[var(--color-tea-gold)] mt-1">{{ ware.unlockHint }}</p>
        </button>
      </div>

      <!-- 温度滑块 -->
      <div class="mt-6">
        <label class="block text-sm text-[var(--color-wood)] mb-2">
          目标水温：<strong>{{ store.brewState.targetTemp }}°C</strong>
          <span v-if="store.currentTea" class="text-[var(--color-tea-gold)]">
            （建议 {{ store.currentTea.bestTemp }}°C）
          </span>
        </label>
        <input
          type="range" min="20" max="100" step="1"
          :value="store.brewState.targetTemp"
          @input="onTempSlider(($event.target as HTMLInputElement).value)"
          class="w-full h-2 bg-[var(--color-paper)] rounded-lg appearance-none cursor-pointer"
        />
        <div class="flex justify-between text-xs text-[var(--color-wood-light)] mt-1">
          <span>20°C</span>
          <span class="text-[var(--color-tea-gold)]">{{ store.currentTea?.bestTemp }}°C 最佳</span>
          <span>100°C</span>
        </div>
      </div>

      <!-- 水源选择 -->
      <div class="mt-4">
        <label class="block text-sm text-[var(--color-wood)] mb-2">水源：</label>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="w in WATER_TYPES" :key="w.id"
            @click="store.waterType = w.id"
            class="p-2 rounded-lg text-center transition-all text-sm"
            :class="store.waterType === w.id
              ? 'bg-[var(--color-wood)] text-[var(--color-cream)]'
              : 'bg-[var(--color-paper)] text-[var(--color-wood)] hover:shadow-sm'"
          >
            <p class="font-bold">{{ w.name }}</p>
            <p class="text-[10px] opacity-70">{{ w.description }}</p>
          </button>
        </div>
      </div>

      <!-- 投茶量 -->
      <div class="mt-4">
        <label class="block text-sm text-[var(--color-wood)] mb-2">
          投茶量：<strong>{{ store.brewState.teaWeight }}g</strong>
          <span class="text-[var(--color-tea-gold)]">（建议 3g）</span>
        </label>
        <input
          type="range" min="1" max="8" step="0.5"
          :value="store.brewState.teaWeight"
          @input="onWeightSlider(($event.target as HTMLInputElement).value)"
          class="w-full h-2 bg-[var(--color-paper)] rounded-lg appearance-none cursor-pointer"
        />
        <div class="flex justify-between text-xs text-[var(--color-wood-light)]">
          <span>1g</span>
          <span>8g</span>
        </div>
      </div>

      <!-- 茶器推荐提示 -->
      <div v-if="store.selectedTeaWare" class="mt-4 p-3 bg-[var(--color-paper)] rounded-lg">
        <p class="text-sm text-[var(--color-wood)]">
          ✅ 已选 <strong>{{ store.selectedTeaWare.name }}</strong>（{{ store.selectedTeaWare.material }}）
        </p>
        <p class="text-xs text-[var(--color-wood-light)] mt-1">{{ store.selectedTeaWare.description }}</p>
      </div>
    </div>

    <!-- ======== 冲泡动画区域（非 IDLE）======== -->
    <div v-if="!isIdle" class="relative w-64 h-64 mb-6">
      <!-- Canvas 粒子层 -->
      <canvas
        ref="(el) => { particleCanvas.canvasRef!.value = el as HTMLCanvasElement | null }"
        class="absolute inset-0 w-full h-full pointer-events-none z-10"
        :width="256"
        :height="256"
      ></canvas>
      <!-- 火焰粒子 -->
      <div class="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-14">
        <div
          v-for="i in 5" :key="i"
          class="absolute bottom-0 rounded-full"
          :style="{
            width: `${6 + i * 2}px`,
            height: store.brewState.phase === BrewPhase.HEATING ? `${20 * flameHeight + i * 5}px` : '0px',
            left: `${i * 5 - 4}px`,
            background: 'linear-gradient(to top, #ff4500, #ff8c00, #ffd700)',
            animation: 'flame 0.3s ease-in-out infinite',
            animationDelay: `${i * 0.08}s`,
            transition: 'height 0.3s',
          }"
        ></div>
      </div>

      <!-- 炉 + 壶 -->
      <div class="absolute bottom-10 left-1/2 -translate-x-1/2 w-24 h-16 bg-[var(--color-wood)] rounded-t-lg">
        <div
          class="absolute inset-x-2 bottom-2 top-3 rounded-t-sm transition-all duration-500 overflow-hidden"
          :style="{
            backgroundColor: store.brewState.phase === BrewPhase.STEEPING || store.brewState.phase === BrewPhase.DONE
              ? soupColor
              : store.brewState.currentTemp > 60 ? '#87CEEB' : '#B0E0E6',
            height: store.brewState.phase === BrewPhase.STEEPING ? '80%' : '70%',
          }"
        >
          <div
            v-if="store.brewState.phase === BrewPhase.HEATING && store.brewState.currentTemp > 70"
            v-for="i in 3" :key="i"
            class="absolute w-1.5 h-1.5 bg-white/60 rounded-full"
            :style="{
              bottom: `${i * 25}%`,
              left: `${i * 30}%`,
              animation: 'bounce 1s ease-in-out infinite',
              animationDelay: `${i * 0.3}s`,
            }"
          ></div>
        </div>
      </div>

      <!-- 蒸汽 -->
      <div class="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-1">
        <div
          v-for="i in 3" :key="i"
          class="w-1 h-8 rounded-full bg-[var(--color-wood-light)]"
          :style="{ opacity: 0.2, animation: `steam 2s ease-out infinite`, animationDelay: `${i * 0.4}s` }"
        ></div>
      </div>

      <!-- 茶汤色展示（浸泡/出汤时）-->
      <div
        v-if="store.brewState.phase === BrewPhase.STEEPING || store.brewState.phase === BrewPhase.DONE"
        class="absolute -right-8 bottom-4 w-20 h-24 bg-white/80 rounded-lg shadow-sm flex flex-col items-center justify-center p-2"
      >
        <div class="w-12 h-12 rounded-full mb-1 transition-colors duration-500"
          :style="{ backgroundColor: soupColor }"></div>
        <p class="text-xs text-[var(--color-wood-light)]">茶汤</p>
      </div>

      <!-- 醒茶提示 -->
      <div
        v-if="store.brewState.phase === BrewPhase.RINSING"
        class="absolute -left-8 bottom-4 w-20 text-center"
      >
        <p class="text-xs text-[var(--color-wood-light)]">醒茶倒计时</p>
        <p class="text-2xl font-bold text-[var(--color-tea-gold)]">{{ rinseCountdown }}</p>
      </div>
    </div>

    <!-- ======== 信息展示 ======== -->
    <div v-if="!isIdle" class="text-center mb-4">
      <p class="text-4xl font-bold text-[var(--color-wood)]">
        {{ store.brewState.phase === BrewPhase.STEEPING ? store.brewState.steepTime + 's' : store.brewState.currentTemp + '°C' }}
      </p>
      <p class="text-sm text-[var(--color-wood-light)]">
        <template v-if="store.brewState.phase === BrewPhase.WARMING">点击按钮用热水温润茶器</template>
        <template v-else-if="store.brewState.phase === BrewPhase.RINSING">醒茶中，倒去第一泡</template>
        <template v-else-if="store.brewState.phase === BrewPhase.STEEPING">
          目标 {{ recommendedSteepTime }}s · 投茶 {{ store.brewState.teaWeight }}g
        </template>
        <template v-else-if="store.brewState.phase === BrewPhase.DONE">
          实际浸泡 {{ store.brewState.steepTime }}s
        </template>
        <template v-else>
          目标 {{ store.brewState.targetTemp }}°C · {{ store.selectedTeaWare?.name }}
        </template>
      </p>
    </div>

    <!-- ======== 主按钮 ======== -->
    <button
      @click="handleMainAction"
      :disabled="store.brewState.phase === BrewPhase.HEATING || store.brewState.phase === BrewPhase.RINSING"
      class="mt-4 px-10 py-4 rounded-lg text-xl transition-all duration-300"
      :class="isIdle && !store.selectedTeaWare
        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
        : store.brewState.phase === BrewPhase.STEEPING
          ? 'bg-[var(--color-tea-gold)] text-white hover:bg-[#B89450]'
          : 'bg-[var(--color-wood)] text-[var(--color-cream)] hover:bg-[var(--color-wood-light)]'"
    >
      {{ mainActionLabel }}
    </button>

    <!-- ======== 茶器信息 ======== -->
    <div v-if="store.selectedTeaWare && !isIdle" class="mt-4 text-xs text-[var(--color-wood-light)]">
      {{ store.selectedTeaWare.name }} · {{ store.selectedTeaWare.material }} · {{ store.selectedTeaWare.capacity }}ml
    </div>

    <!-- ======== 冲泡进度 ======== -->
    <div v-if="!isIdle && store.currentTea" class="mt-6 flex gap-2">
      <div
        v-for="i in store.currentTea.infusions" :key="i"
        class="w-6 h-6 rounded-full text-xs flex items-center justify-center transition-all"
        :class="i <= store.brewState.infusionsDone
          ? 'bg-[var(--color-tea-gold)] text-white'
          : i === store.brewState.infusionsDone + 1 && store.brewState.phase !== BrewPhase.DONE
            ? 'border-2 border-[var(--color-tea-gold)] text-[var(--color-tea-gold)]'
            : 'bg-gray-200 text-gray-400'"
      >
        {{ i }}
      </div>
    </div>
  </div>
</template>
