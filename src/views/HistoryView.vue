<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTeaStore } from '@/stores/tea'

const router = useRouter()
const store = useTeaStore()

const aromaLabels: Record<string, string> = {
  floral: '花香', fruity: '果香', honey: '蜜香',
  caramel: '焦糖', woody: '木质', herbal: '草药',
  creamy: '奶香', aged: '陈香', roasted: '焙火', fresh: '鲜爽',
}

onMounted(() => {
  store.loadHistory()
})
</script>

<template>
  <div class="min-h-screen p-8">
    <div class="flex items-center justify-between mb-8">
      <h2 class="text-3xl font-bold text-[var(--color-wood)]">品鉴历史</h2>
      <button @click="router.push('/')" class="text-[var(--color-wood-light)] hover:text-[var(--color-wood)]">返回</button>
    </div>

    <!-- 成就展示 -->
    <div class="mb-8">
      <!-- 茶修等级 -->
      <div class="glass-panel rounded-xl p-4 mb-4">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="text-2xl">{{ store.currentLevel.icon }}</span>
            <div>
              <p class="text-sm font-bold text-[var(--color-wood)]">{{ store.currentLevel.name }}</p>
              <p class="text-xs text-[var(--color-wood-light)]">经验 {{ store.userXp }}</p>
            </div>
          </div>
          <div v-if="store.nextLevel" class="text-right">
            <p class="text-xs text-[var(--color-wood-light)]">下一级：{{ store.nextLevel.name }}</p>
            <p class="text-xs text-[var(--color-tea-gold)]">{{ store.userXp }} / {{ store.xpForNextLevel }}</p>
          </div>
        </div>
        <!-- 经验条 -->
        <div v-if="store.nextLevel" class="w-full h-2 bg-white rounded-full overflow-hidden">
          <div class="h-full bg-gradient-to-r from-[var(--color-tea-gold)] to-[var(--color-wood)] rounded-full transition-all duration-500"
            :style="{ width: `${Math.min(100, (store.userXp / store.xpForNextLevel) * 100)}%` }">
          </div>
        </div>
      </div>

      <h3 class="text-lg font-bold text-[var(--color-wood)] mb-3">
        成就
        <span class="text-sm text-[var(--color-wood-light)] font-normal">
          （{{ store.achievements.filter(a => a.unlocked).length }}/{{ store.achievements.length }}）
        </span>
      </h3>
      <div class="grid grid-cols-5 gap-2">
        <div
          v-for="ach in store.achievements" :key="ach.id"
          class="p-3 rounded-xl text-center transition-all"
          :class="ach.unlocked
            ? 'bg-[var(--color-paper)] shadow-sm'
            : 'bg-gray-100 opacity-50'"
        >
          <p class="text-2xl mb-1" :class="!ach.unlocked ? 'grayscale' : ''">{{ ach.icon }}</p>
          <p class="text-xs font-bold text-[var(--color-wood)]">{{ ach.name }}</p>
          <p class="text-[10px] text-[var(--color-wood-light)]">{{ ach.description }}</p>
        </div>
      </div>
    </div>

    <div v-if="store.history.length === 0" class="text-center text-[var(--color-wood-light)] py-12">
      <p class="text-lg">暂无品鉴记录</p>
    </div>

    <div v-else class="space-y-4">
      <div v-for="record in store.history" :key="record.id"
        class="p-4 bg-white rounded-lg shadow-sm">
        <div class="flex justify-between items-start">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-lg font-bold text-[var(--color-wood)]">{{ record.teaName }}</h3>
              <span v-if="record.weather || record.mood" class="text-xs text-[var(--color-wood-light)]">
                {{ record.weather }} {{ record.mood }}
              </span>
            </div>
            <p class="text-sm text-[var(--color-wood-light)]">
              {{ new Date(record.date).toLocaleDateString() }} · 第 {{ record.infusions }} 泡 · {{ record.brewTemp }}°C · {{ record.brewTime }}s
            </p>
          </div>
          <span class="text-2xl font-bold" :style="{ color: record.overallScore >= 7.5 ? '#4A7C59' : record.overallScore >= 6 ? '#5D4E37' : '#8B7355' }">{{ record.overallScore }}</span>
        </div>
        <div class="flex flex-wrap gap-2 mt-2">
          <span class="px-2 py-0.5 text-xs bg-[var(--color-paper)] text-[var(--color-wood)] rounded">
            苦{{ record.dimensions.bitterness }} 甜{{ record.dimensions.sweetness }} 甘{{ record.dimensions.aftertaste }} 醇{{ record.dimensions.body }} 香{{ record.dimensions.aroma }} 韵{{ record.dimensions.rhyme }} 形{{ record.dimensions.shape }} 神{{ record.dimensions.mind }}
          </span>
          <span v-if="record.aromaType" class="px-2 py-0.5 text-xs bg-[var(--color-tea-gold)]/20 text-[var(--color-tea-gold)] rounded">
            {{ aromaLabels[record.aromaType] || record.aromaType }}
          </span>
        </div>
        <p v-if="record.notes" class="text-sm text-[var(--color-wood-light)] mt-1 italic">
          "{{ record.notes }}"
        </p>
      </div>
    </div>
  </div>
</template>
