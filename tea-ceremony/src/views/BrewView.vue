<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTeaStore } from '@/stores/tea'
import { getSoupColor } from '@/data/teas'
import { BrewPhase } from '@/types/brewing'

const router = useRouter()
const store = useTeaStore()

const heatInterval = ref<number | null>(null)
const steepInterval = ref<number | null>(null)

const soupColor = computed(() => {
  if (!store.currentTea) return '#F5F0E8'
  return getSoupColor(store.currentTea, store.brewState.steepTime)
})

const flameHeight = computed(() => {
  if (store.brewState.phase !== BrewPhase.HEATING) return 0
  return Math.min(1, (store.brewState.currentTemp / store.brewState.targetTemp) * 1.5)
})

function startHeating() {
  store.startHeating()
  heatInterval.value = window.setInterval(() => {
    if (store.brewState.currentTemp < store.brewState.targetTemp) {
      store.updateTemp(store.brewState.currentTemp + 1)
    } else {
      stopHeating()
    }
  }, 50)
}

function stopHeating() {
  if (heatInterval.value) {
    clearInterval(heatInterval.value)
    heatInterval.value = null
  }
}

function startSteeping() {
  store.startSteeping()
  steepInterval.value = window.setInterval(() => {
    store.updateSteepTime(store.brewState.steepTime + 1)
  }, 1000)
}

function stopSteeping() {
  if (steepInterval.value) {
    clearInterval(steepInterval.value)
    steepInterval.value = null
  }
  store.stopSteeping()
}

function handleAction() {
  if (store.brewState.phase === BrewPhase.IDLE) {
    startHeating()
  } else if (store.brewState.phase === BrewPhase.READY) {
    startSteeping()
  } else if (store.brewState.phase === BrewPhase.STEEPING) {
    stopSteeping()
  } else if (store.brewState.phase === BrewPhase.DONE) {
    if (store.brewState.infusionsDone < (store.currentTea?.infusions ?? 0)) {
      store.nextInfusion()
    } else {
      router.push('/taste')
    }
  }
}

const actionLabel = computed(() => {
  switch (store.brewState.phase) {
    case BrewPhase.IDLE: return '开始烧水'
    case BrewPhase.HEATING: return `${store.brewState.currentTemp}°C`
    case BrewPhase.READY: return '开始浸泡'
    case BrewPhase.STEEPING: return '出汤'
    case BrewPhase.DONE: return store.brewState.infusionsDone < (store.currentTea?.infusions ?? 0) ? '继续冲泡' : '开始品鉴'
  }
})

onUnmounted(() => {
  stopHeating()
  stopSteeping()
})
</script>

<template>
  <div class="min-h-screen p-8 flex flex-col items-center">
    <h2 class="text-3xl font-bold text-[var(--color-wood)] mb-4">冲泡</h2>

    <p v-if="store.currentTea" class="text-lg text-[var(--color-wood)] mb-2">{{ store.currentTea.name }}</p>
    <p v-if="store.currentTea" class="text-sm text-[var(--color-wood-light)] mb-8">
      最佳 {{ store.currentTea.bestTemp }}°C · {{ store.currentTea.bestTime }}秒
    </p>

    <div class="relative w-64 h-64 mb-8">
      <div class="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-10">
        <div v-for="i in 3" :key="i"
          class="absolute bottom-0 w-3 bg-gradient-to-t from-orange-500 to-yellow-300 rounded-full animate-flame"
          :style="{ left: `${(i-1)*14}px`, height: `${40 * flameHeight}px`, animationDelay: `${i*0.1}s` }">
        </div>
      </div>

      <div class="absolute bottom-10 left-1/2 -translate-x-1/2 w-20 h-14 bg-[var(--color-wood)] rounded-t-lg">
        <div class="absolute inset-x-1.5 bottom-1.5 top-3 bg-blue-200 rounded-t-sm transition-all duration-300"
          :style="{ height: '70%' }">
          <div v-if="store.brewState.currentTemp > 80" class="absolute inset-0 flex items-end justify-center">
            <div v-for="i in 3" :key="i" class="w-1.5 h-1.5 bg-white rounded-full animate-bounce" :style="{ animationDelay: `${i*0.2}s` }"></div>
          </div>
        </div>
      </div>

      <div class="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-1">
        <div v-for="i in 3" :key="i" class="w-0.5 h-6 bg-[var(--color-wood-light)] opacity-20 rounded-full animate-steam" :style="{ animationDelay: `${i*0.5}s` }"></div>
      </div>

      <div class="absolute bottom-4 left-1/2 -translate-x-1/2 w-16 h-10 bg-[var(--color-wood)] rounded-b-full">
        <div class="absolute inset-x-1.5 top-1.5 bottom-1.5 rounded-b-full transition-colors duration-500" :style="{ backgroundColor: soupColor }"></div>
      </div>
    </div>

    <div class="text-center mb-4">
      <p class="text-5xl font-bold text-[var(--color-wood)]">{{ store.brewState.currentTemp }}°C</p>
      <p class="text-sm text-[var(--color-wood-light)]">目标 {{ store.brewState.targetTemp }}°C</p>
    </div>

    <div v-if="store.brewState.phase === BrewPhase.STEEPING" class="text-center mb-8">
      <p class="text-4xl font-bold text-[var(--color-tea-gold)]">{{ store.brewState.steepTime }}s</p>
    </div>

    <div v-if="store.brewState.phase === BrewPhase.DONE" class="text-center mb-8">
      <p class="text-lg text-[var(--color-wood-light)]">第 {{ store.brewState.infusionsDone }} 泡完成</p>
    </div>

    <button @click="handleAction"
      class="px-8 py-4 bg-[var(--color-wood)] text-[var(--color-cream)] text-xl rounded-lg hover:bg-[var(--color-wood-light)] transition-colors">
      {{ actionLabel }}
    </button>
  </div>
</template>
