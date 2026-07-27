<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { teas, getAllTypes, getTeasByType } from '@/data/teas'
import { useTeaStore } from '@/stores/tea'
import { TeaType, type Tea } from '@/types/tea'

const router = useRouter()
const store = useTeaStore()

const selectedType = ref<TeaType | null>(null)
const selectedTea = ref<Tea | null>(null)

function filterTeas(type: TeaType | null) {
  selectedType.value = type
  selectedTea.value = null
}

function selectTea(tea: Tea) {
  selectedTea.value = tea
}

function confirm() {
  if (selectedTea.value) {
    store.selectTea(selectedTea.value)
    router.push('/brew')
  }
}

const types = getAllTypes()
</script>

<template>
  <div class="min-h-screen p-8">
    <h2 class="text-3xl font-bold text-[var(--color-wood)] mb-8">选茶</h2>

    <div class="flex flex-wrap gap-3 mb-8">
      <button @click="filterTeas(null)"
        class="px-4 py-2 rounded-full transition-colors"
        :class="!selectedType ? 'bg-[var(--color-wood)] text-[var(--color-cream)]' : 'bg-[var(--color-paper)] text-[var(--color-wood)]'">
        全部
      </button>
      <button v-for="t in types" :key="t" @click="filterTeas(t)"
        class="px-4 py-2 rounded-full transition-colors"
        :class="selectedType === t ? 'bg-[var(--color-wood)] text-[var(--color-cream)]' : 'bg-[var(--color-paper)] text-[var(--color-wood)]'">
        {{ t }}
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div v-for="tea in (selectedType ? getTeasByType(selectedType) : teas)" :key="tea.id"
        @click="selectTea(tea)"
        class="p-6 rounded-xl cursor-pointer transition-all duration-300 border-2"
        :class="selectedTea?.id === tea.id ? 'border-[var(--color-tea-gold)] shadow-lg scale-105' : 'border-transparent bg-white hover:shadow-md'">
        <div class="w-full h-24 rounded-lg mb-4"
          :style="{ background: `linear-gradient(135deg, ${tea.soupColorMin}, ${tea.soupColorMax})` }"></div>
        <h3 class="text-xl font-bold text-[var(--color-wood)] mb-2">{{ tea.name }}</h3>
        <p class="text-sm text-[var(--color-wood-light)] mb-2">{{ tea.type }} · {{ tea.origin }}</p>
        <p class="text-sm text-[var(--color-wood-light)] opacity-80">{{ tea.description }}</p>
        <div class="flex flex-wrap gap-2 mt-3">
          <span v-for="f in tea.flavor" :key="f" class="px-2 py-1 text-xs bg-[var(--color-paper)] text-[var(--color-wood)] rounded">{{ f }}</span>
        </div>
      </div>
    </div>

    <div class="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-sm border-t">
      <button @click="confirm" :disabled="!selectedTea"
        class="w-full max-w-md mx-auto block py-4 rounded-lg text-xl transition-all"
        :class="selectedTea ? 'bg-[var(--color-wood)] text-[var(--color-cream)] hover:bg-[var(--color-wood-light)]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'">
        {{ selectedTea ? `选择 ${selectedTea.name}` : '请选择一种茶叶' }}
      </button>
    </div>
  </div>
</template>
