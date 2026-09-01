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

function confirm() {
  if (store.selectedTeaWare) {
    router.push('/brew')
  }
}
</script>

<template>
  <div class="min-h-screen p-4 sm:p-8 flex flex-col items-center">
    <h2 class="text-3xl font-bold text-[var(--color-wood)] mb-2">备器 · 择水</h2>
    <p class="text-lg text-[var(--color-wood)] mb-1">
      {{ currentTeaName }}
      <span class="text-sm text-[var(--color-wood-light)]">（{{ currentTeaType }}）</span>
    </p>
    <p class="text-sm text-[var(--color-wood-light)] mb-8">选择茶器与水源，开始你的茶席</p>

    <!-- 茶器选择 -->
    <div class="w-full max-w-lg mb-8">
      <h3 class="text-base font-bold text-[var(--color-wood)] mb-3">🫖 茶器</h3>
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
    </div>

    <!-- 水源选择 -->
    <div class="w-full max-w-lg mb-8">
      <h3 class="text-base font-bold text-[var(--color-wood)] mb-3">💧 水源</h3>
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

    <!-- 选中预览 -->
    <div v-if="store.selectedTeaWare" class="glass-panel rounded-xl p-3 mb-6 w-full max-w-lg text-sm">
      <p class="text-[var(--color-wood)]">
        ✅ {{ store.selectedTeaWare.name }} · {{ store.selectedTeaWare.material }}
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
