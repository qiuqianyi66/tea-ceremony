<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTeaStore } from '@/stores/tea'
import { teawares } from '@/data/teawares'
import { WATER_TYPES } from '@/data/constants'
import type { TeaWare } from '@/types/teaware'

const router = useRouter()
const store = useTeaStore()

const currentTeaName = computed(() => store.currentTea?.name ?? '未知')
const currentTeaType = computed(() => store.currentTea?.type ?? '')

function selectWare(ware: TeaWare) {
  if (!store.isTeaWareUnlocked(ware.id)) return
  store.selectTeaWare(ware)
}

// 备器页是冲泡前唯一的参数设定入口：水温 / 投茶量在此调整后带入冲泡页
function onTempSlider(value: string) {
  store.setTargetTemp(parseInt(value))
}

function onWeightSlider(value: string) {
  store.setTeaWeight(parseFloat(value))
}

function backToSelect() {
  router.push('/select')
}

function confirm() {
  if (!store.selectedTeaWare) return
  // 确认备器即开始煮水，再进入全屏冲泡页（冲泡页挂载后接续升温计时）
  store.startHeating()
  router.push('/brew')
}
</script>

<template>
  <div class="min-h-screen p-4 sm:p-8 flex flex-col items-center">
    <button
      @click="backToSelect"
      class="self-start mb-2 text-sm text-[var(--color-wood-light)] hover:text-[var(--color-wood)] transition-colors"
    >
      ← 返回选茶
    </button>
    <h2 class="text-3xl font-bold text-[var(--color-wood)] mb-2">备器 · 择水</h2>
    <p class="text-lg text-[var(--color-wood)] mb-1">
      {{ currentTeaName }}
      <span class="text-sm text-[var(--color-wood-light)]">（{{ currentTeaType }}）</span>
    </p>
    <p class="text-sm text-[var(--color-wood-light)] mb-8">选择茶器与水源，开始你的茶席</p>

    <!-- 茶器选择 -->
    <div class="w-full max-w-lg mb-8">
      <h3 class="text-base font-bold text-[var(--color-wood)] mb-3"><IconCupSoda class="inline-block -mt-1" /> 茶器</h3>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <button
          v-for="ware in teawares" :key="ware.id"
          @click="selectWare(ware)"
          class="p-4 rounded-xl border-2 transition-all text-center relative"
          :class="[
            !store.isTeaWareUnlocked(ware.id)
              ? 'border-transparent bg-gray-100 opacity-60 cursor-not-allowed'
              : store.selectedTeaWare?.id === ware.id
                ? 'border-[var(--color-tea-gold)] bg-[var(--color-paper)] shadow-md scale-105'
                : 'border-transparent bg-white hover:shadow-md'
          ]"
        >
          <div v-if="!store.isTeaWareUnlocked(ware.id)" class="absolute inset-0 flex items-center justify-center bg-white/40 rounded-xl z-10">
            <IconLock class="w-5 h-5 text-[var(--color-wood-light)]" />
          </div>
          <component :is="`Icon${ware.icon}`" class="w-8 h-8 mx-auto" />
          <p class="text-sm font-bold text-[var(--color-wood)]">{{ ware.name }}</p>
          <p class="text-xs text-[var(--color-wood-light)] mt-1">{{ ware.material }}</p>
          <p class="text-xs text-[var(--color-wood-light)]">{{ ware.capacity }}ml</p>
          <p v-if="!store.isTeaWareUnlocked(ware.id)" class="text-[10px] text-[var(--color-tea-gold)] mt-1">{{ ware.unlockHint }}</p>
        </button>
      </div>
    </div>

    <!-- 水源选择 -->
    <div class="w-full max-w-lg mb-8">
      <h3 class="text-base font-bold text-[var(--color-wood)] mb-3"><IconDroplet class="inline-block -mt-1" /> 水源</h3>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <button
          v-for="w in WATER_TYPES" :key="w.id"
          @click="store.waterType = w.id"
          class="p-4 rounded-xl border-2 transition-all text-center"
          :class="store.waterType === w.id
            ? 'border-[var(--color-tea-gold)] bg-[var(--color-paper)] shadow-md'
            : 'border-transparent bg-white hover:shadow-md'"
        >
          <p class="text-sm font-bold text-[var(--color-wood)]">{{ w.name }}</p>
          <p class="text-xs text-[var(--color-wood-light)] mt-1">{{ w.description }}</p>
        </button>
      </div>
    </div>

    <!-- 目标水温 -->
    <div class="w-full max-w-lg mb-8">
      <h3 class="text-base font-bold text-[var(--color-wood)] mb-3"><IconThermometer class="inline-block -mt-1" /> 目标水温</h3>
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

    <!-- 投茶量 -->
    <div class="w-full max-w-lg mb-8">
      <h3 class="text-base font-bold text-[var(--color-wood)] mb-3"><IconLeaf class="inline-block -mt-1" /> 投茶量</h3>
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

    <!-- 选中预览 -->
    <div v-if="store.selectedTeaWare" class="glass-panel rounded-xl p-3 mb-6 w-full max-w-lg text-sm">
      <p class="text-[var(--color-wood)]">
        <IconCheckCircle class="inline-block -mt-0.5 text-[var(--color-tea-gold)]" /> {{ store.selectedTeaWare.name }} · {{ store.selectedTeaWare.material }}
      </p>
      <p class="text-xs text-[var(--color-wood-light)] mt-1">{{ store.selectedTeaWare.description }}</p>
    </div>

    <!-- 按钮 -->
    <button @click="confirm" :disabled="!store.selectedTeaWare"
      class="w-full max-w-md py-4 rounded-lg text-xl transition-all"
      :class="store.selectedTeaWare
        ? 'bg-[var(--color-wood)] text-[var(--color-cream)] hover:bg-[var(--color-wood-light)]'
        : 'bg-gray-200 text-gray-400 cursor-not-allowed'">
      {{ store.selectedTeaWare ? '开始冲泡 →' : '请选择茶器' }}
    </button>
  </div>
</template>
