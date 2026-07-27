<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTeaStore } from '@/stores/tea'

const router = useRouter()
const store = useTeaStore()

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

    <div v-if="store.history.length === 0" class="text-center text-[var(--color-wood-light)] py-12">
      <p class="text-lg">暂无品鉴记录</p>
    </div>

    <div v-else class="space-y-4">
      <div v-for="record in store.history" :key="record.id"
        class="p-4 bg-white rounded-lg shadow-sm">
        <div class="flex justify-between items-start">
          <div>
            <h3 class="text-lg font-bold text-[var(--color-wood)]">{{ record.teaName }}</h3>
            <p class="text-sm text-[var(--color-wood-light)]">
              {{ new Date(record.date).toLocaleDateString() }} · 第 {{ record.infusions }} 泡 · {{ record.brewTemp }}°C
            </p>
          </div>
          <span class="text-2xl font-bold text-[var(--color-tea-gold)]">{{ record.overallScore }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
