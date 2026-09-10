<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { teas, getAllTypes } from '@/data/teas'
import { useTeaStore } from '@/stores/tea'
import { TeaType, type Tea } from '@/types/tea'
import { getTeaMastersForTea } from '@/data/teaMasters'
import { teasApi } from '@/services/api'

const router = useRouter()
const store = useTeaStore()

const selectedType = ref<TeaType | null>(null)
const selectedTea = ref<Tea | null>(null)
const catalog = ref<Tea[]>(teas)
const isLoading = ref(false)

// 茶图加载失败记录：失败后降级为渐变色块
const imgFailed = reactive<Record<string, boolean>>({})
function markImgFailed(id: string) { imgFailed[id] = true }

const visibleTeas = computed(() => selectedType.value
  ? catalog.value.filter(tea => tea.type === selectedType.value)
  : catalog.value)

onMounted(async () => {
  isLoading.value = true
  try {
    const remoteTeas = await teasApi.list()
    if (remoteTeas.length > 0) {
      // 远程数据负责更新数据库字段，本地资料保留视觉细节、故事和茶人关联。
      const localByName = new Map(teas.map(tea => [tea.name, tea]))
      catalog.value = remoteTeas.map(remoteTea => {
        const localTea = localByName.get(remoteTea.name)
        return localTea
          ? { ...localTea, ...remoteTea, id: localTea.id }
          : remoteTea
      })
    }
  } catch (error) {
    // API 不可用时保留内置目录，保证离线仍可开始品茶。
    console.warn('[SelectView] 茶叶目录同步失败，使用本地目录:', error)
  } finally {
    isLoading.value = false
  }
})

function filterTeas(type: TeaType | null) {
  selectedType.value = type
  selectedTea.value = null
}

function selectTea(tea: Tea) {
  selectedTea.value = tea
}

function teaMasters(tea: Tea) {
  return getTeaMastersForTea(tea.id)
}

function confirm() {
  if (selectedTea.value) {
    store.selectTea(selectedTea.value)
    router.push('/tools')
  }
}

const types = getAllTypes()
</script>

<template>
  <div class="min-h-[100dvh] p-4 sm:p-8 pb-28">
    <h2 class="text-3xl font-bold text-[var(--color-wood)] mb-8">选茶</h2>

    <div class="flex flex-wrap gap-3 mb-8">
      <button @click="filterTeas(null)"
        class="px-4 py-3 rounded-full transition-colors"
        :class="!selectedType ? 'bg-[var(--color-wood)] text-[var(--color-cream)]' : 'bg-[var(--color-paper)] text-[var(--color-wood)]'">
        全部
      </button>
      <button v-for="t in types" :key="t" @click="filterTeas(t)"
        class="px-4 py-3 rounded-full transition-colors"
        :class="selectedType === t ? 'bg-[var(--color-wood)] text-[var(--color-cream)]' : 'bg-[var(--color-paper)] text-[var(--color-wood)]'">
        {{ t }}
      </button>
    </div>

    <template v-if="visibleTeas.length > 0">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div v-for="tea in visibleTeas" :key="tea.id"
          @click="selectTea(tea)"
          class="p-6 rounded-xl cursor-pointer transition-all duration-300 border-2"
        :class="selectedTea?.id === tea.id ? 'border-[var(--color-tea-gold)] shadow-lg scale-105' : 'border-transparent bg-white hover:shadow-md'">
        <img v-if="tea.image && !imgFailed[tea.id]" :src="tea.image" loading="lazy" @error="markImgFailed(tea.id)"
          class="w-full h-24 object-cover rounded-lg mb-4" :alt="tea.name" />
        <div v-else class="w-full h-24 rounded-lg mb-4"
          :style="{ background: `linear-gradient(135deg, ${tea.soupColorMin}, ${tea.soupColorMax})` }"></div>
        <h3 class="text-xl font-bold font-serif text-[var(--color-wood)] mb-2">{{ tea.name }}</h3>
        <p class="text-sm text-[var(--color-wood-light)] mb-2">{{ tea.type }} · {{ tea.origin }}</p>
        <p class="text-sm text-[var(--color-wood-light)] opacity-80">{{ tea.description }}</p>
        <div class="flex flex-wrap gap-2 mt-3">
          <span v-for="f in tea.flavor" :key="f" class="px-2 py-1 text-xs bg-[var(--color-paper)] text-[var(--color-wood)] rounded">{{ f }}</span>
        </div>
        <!-- 相关茶人 -->
        <div v-if="selectedTea?.id === tea.id" class="mt-3 pt-3 border-t border-[var(--color-paper)]">
          <div v-for="master in teaMasters(tea)" :key="master.id"
            class="flex items-center gap-2 mb-1">
            <component :is="`Icon${master.avatar}`" class="w-6 h-6 text-[var(--color-tea-gold)] shrink-0" />
            <div>
              <p class="text-xs font-bold text-[var(--color-wood)]">{{ master.name }}（{{ master.dynasty }}）· {{ master.title }}</p>
              <p class="text-[10px] text-[var(--color-wood-light)] italic">"{{ master.quote.slice(0, 20) }}…"</p>
            </div>
          </div>
        </div>
        </div>
      </div>
    </template>
    <p v-else class="py-12 text-center text-sm text-[var(--color-wood-light)]">该分类暂无茶——等一盏新茶入席</p>
    <p v-if="isLoading" class="text-center text-sm text-[var(--color-wood-light)] mt-6">正在同步茶叶目录…</p>

    <div class="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-sm border-t">
      <button @click="confirm" :disabled="!selectedTea"
        class="w-full max-w-md mx-auto block py-4 rounded-lg text-xl transition-all"
        :class="selectedTea ? 'bg-[var(--color-wood)] text-[var(--color-cream)] hover:bg-[var(--color-wood-light)]' : 'bg-[#E8E2D8] text-[#B5AC9C] cursor-not-allowed'">
        {{ selectedTea ? `选择 ${selectedTea.name}` : '请选择一种茶叶' }}
      </button>
    </div>
  </div>
</template>
