<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTeaStore } from '@/stores/tea'
import { getScoreLevel } from '@/services/scoring'

const router = useRouter()
const store = useTeaStore()

const showResult = ref(false)
const finalScore = computed(() => store.calculateScore())
const scoreLevel = computed(() => getScoreLevel(finalScore.value))

function submit() {
  store.saveRecord()
  showResult.value = true
}

const dimensions = [
  { key: 'bitterness' as const, label: '苦涩度', left: '清淡', right: '浓烈' },
  { key: 'sweetness' as const, label: '甜度', left: '无甜', right: '甘甜' },
  { key: 'aftertaste' as const, label: '回甘', left: '无回甘', right: '持久' },
  { key: 'body' as const, label: '醇厚度', left: '单薄', right: '醇厚' },
  { key: 'aroma' as const, label: '香气持久度', left: '短暂', right: '持久' },
]
</script>

<template>
  <div class="min-h-screen p-8 flex flex-col items-center">
    <h2 class="text-3xl font-bold text-[var(--color-wood)] mb-8">品鉴</h2>

    <p v-if="store.currentTea" class="text-lg text-[var(--color-wood)] mb-8">
      {{ store.currentTea.name }} · 第 {{ store.brewState.infusionsDone }} 泡
    </p>

    <div v-if="!showResult" class="w-full max-w-md space-y-6 mb-8">
      <div v-for="d in dimensions" :key="d.key">
        <label class="block text-sm text-[var(--color-wood)] mb-2">
          {{ d.label }} ({{ store.tasteDimensions[d.key] }})
        </label>
        <input type="range" v-model.number="store.tasteDimensions[d.key]" min="1" max="5"
          class="w-full h-2 bg-[var(--color-paper)] rounded-lg appearance-none cursor-pointer" />
        <div class="flex justify-between text-xs text-[var(--color-wood-light)]">
          <span>{{ d.left }}</span>
          <span>{{ d.right }}</span>
        </div>
      </div>

      <button @click="submit"
        class="w-full py-4 bg-[var(--color-wood)] text-[var(--color-cream)] text-xl rounded-lg hover:bg-[var(--color-wood-light)] transition-colors">
        完成品鉴
      </button>
    </div>

    <div v-else class="text-center">
      <p class="text-6xl font-bold mb-2" :style="{ color: scoreLevel.color }">{{ finalScore }}</p>
      <p class="text-xl text-[var(--color-wood)] mb-4">{{ scoreLevel.text }}</p>
      <p class="text-sm text-[var(--color-wood-light)] mb-8">
        工艺系数 {{ (store.processFactor * 100).toFixed(0) }}%
      </p>

      <button @click="router.push('/select')"
        class="w-full max-w-md block py-4 bg-[var(--color-wood)] text-[var(--color-cream)] text-xl rounded-lg hover:bg-[var(--color-wood-light)] transition-colors mb-4">
        再品一款
      </button>
      <button @click="router.push('/')"
        class="w-full max-w-md block py-4 border-2 border-[var(--color-wood)] text-[var(--color-wood)] text-xl rounded-lg hover:bg-[var(--color-paper)] transition-colors">
        返回首页
      </button>
    </div>
  </div>
</template>
