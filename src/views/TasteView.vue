<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTeaStore } from '@/stores/tea'
import { getSoupColor } from '@/data/teas'
import { getScoreLevel } from '@/services/scoring'
import { generateTastingNote } from '@/services/teaAI'

const router = useRouter()
const store = useTeaStore()

// ============ 三步骤控制 ============
type TastingStep = 'observe' | 'aroma' | 'taste' | 'result'
const step = ref<TastingStep>('observe')

// ============ 观色 ============
const soupColor = computed(() => {
  if (!store.currentTea) return '#F5F0E8'
  return getSoupColor(store.currentTea, store.brewState.steepTime)
})

// ============ 闻香 ============
const aromaTypes = [
  { id: 'floral', label: '花香', emoji: '🌸' },
  { id: 'fruity', label: '果香', emoji: '🍑' },
  { id: 'honey', label: '蜜香', emoji: '🍯' },
  { id: 'caramel', label: '焦糖', emoji: '🍮' },
  { id: 'woody', label: '木质', emoji: '🪵' },
  { id: 'herbal', label: '草药', emoji: '🌿' },
  { id: 'creamy', label: '奶香', emoji: '🥛' },
  { id: 'aged', label: '陈香', emoji: '📜' },
  { id: 'roasted', label: '焙火', emoji: '🔥' },
  { id: 'fresh', label: '鲜爽', emoji: '💚' },
]
const selectedAroma = ref<string | null>(null)

function toggleAroma(id: string) {
  selectedAroma.value = selectedAroma.value === id ? null : id
}

// ============ 品味（六维评分）============
const dimensions = [
  { key: 'bitterness' as const, label: '苦涩度', left: '清淡', right: '浓烈' },
  { key: 'sweetness' as const, label: '甜度', left: '无甜', right: '甘甜' },
  { key: 'aftertaste' as const, label: '回甘', left: '无回甘', right: '持久' },
  { key: 'body' as const, label: '醇厚度', left: '单薄', right: '醇厚' },
  { key: 'aroma' as const, label: '香气持久度', left: '短暂', right: '持久' },
  { key: 'rhyme' as const, label: '茶韵', left: '浅薄', right: '悠长' },
  { key: 'shape' as const, label: '叶底', left: '粗散', right: '匀整' },
  { key: 'mind' as const, label: '心境', left: '浮躁', right: '禅定' },
]

// ============ 笔记 ============
const tastingNotes = ref('')
const weather = ref<string>('')
const mood = ref<string>('')

const weatherOptions = ['☀️ 晴', '⛅ 多云', '🌧️ 雨', '🌫️ 雾', '❄️ 雪']
const moodOptions = ['😊 愉悦', '😌 安静', '🧘 禅定', '🤔 沉思', '🎵 悠然']

// ============ 评分结果 ============
const finalScore = computed(() => store.calculateScore())
const scoreLevel = computed(() => getScoreLevel(finalScore.value))
const aiComment = ref('')

function submit() {
  store.saveRecord(
    selectedAroma.value ?? undefined,
    tastingNotes.value || undefined,
    weather.value || undefined,
    mood.value || undefined,
  )
  step.value = 'result'
  // AI 生成茶记
  generateTastingNote(
    store.currentTea?.name || '',
    store.tasteDimensions,
    finalScore.value,
  ).then(comment => { aiComment.value = comment })
}

// ============ 步骤标题 ============
const stepTitle = computed(() => {
  switch (step.value) {
    case 'observe': return '① 观色'
    case 'aroma': return '② 闻香'
    case 'taste': return '③ 品味'
    case 'result': return '品鉴结果'
  }
})
</script>

<template>
  <div class="min-h-screen p-8 flex flex-col items-center">
    <h2 class="text-3xl font-bold text-[var(--color-wood)] mb-2">品鉴</h2>

    <p class="text-lg text-[var(--color-wood)] mb-1">
      {{ store.currentTea?.name }} · 第 {{ store.brewState.infusionsDone }} 泡
    </p>
    <p class="text-sm text-[var(--color-wood-light)] mb-8">{{ stepTitle }}</p>

    <!-- 步骤指示器 -->
    <div class="flex gap-2 mb-8">
      <div
        v-for="(s, i) in ['observe', 'aroma', 'taste', 'result']" :key="s"
        class="flex items-center gap-2"
      >
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all"
          :class="step === s
            ? 'bg-[var(--color-wood)] text-[var(--color-cream)]'
            : ['observe', 'aroma', 'taste', 'result'].indexOf(step) > i
              ? 'bg-[var(--color-tea-gold)] text-white'
              : 'bg-gray-200 text-gray-400'"
        >
          {{ ['观', '闻', '品', '果'][i] }}
        </div>
        <div v-if="i < 3" class="w-6 h-0.5" :class="['observe', 'aroma', 'taste', 'result'].indexOf(step) > i ? 'bg-[var(--color-tea-gold)]' : 'bg-gray-200'"></div>
      </div>
    </div>

    <!-- ======== ① 观色 ======== -->
    <div v-if="step === 'observe'" class="flex flex-col items-center">
      <div class="w-48 h-48 rounded-2xl shadow-lg mb-6 transition-colors duration-500"
        :style="{ backgroundColor: soupColor }">
      </div>
      <p class="text-lg text-[var(--color-wood)] mb-2">
        茶汤色：<span :style="{ color: soupColor }">■</span> {{ soupColor }}
      </p>
      <p v-if="store.currentTea" class="text-sm text-[var(--color-wood-light)] mb-6">
        正常汤色范围：{{ store.currentTea.soupColorMin }} ~ {{ store.currentTea.soupColorMax }}
      </p>
      <button @click="step = 'aroma'"
        class="px-8 py-3 bg-[var(--color-wood)] text-[var(--color-cream)] rounded-lg hover:bg-[var(--color-wood-light)] transition-colors">
        观色完成，继续闻香
      </button>
    </div>

    <!-- ======== ② 闻香 ======== -->
    <div v-if="step === 'aroma'" class="w-full max-w-md">
      <p class="text-sm text-[var(--color-wood)] mb-4">你闻到了什么香气？（可多选）</p>
      <div class="grid grid-cols-2 gap-3 mb-8">
        <button
          v-for="a in aromaTypes" :key="a.id"
          @click="toggleAroma(a.id)"
          class="p-4 rounded-xl border-2 text-left transition-all"
          :class="selectedAroma === a.id
            ? 'border-[var(--color-tea-gold)] bg-[var(--color-paper)]'
            : 'border-transparent bg-white hover:shadow-md'"
        >
          <span class="text-2xl mr-2">{{ a.emoji }}</span>
          <span class="text-[var(--color-wood)]">{{ a.label }}</span>
        </button>
      </div>

      <button @click="step = 'taste'"
        class="w-full py-3 bg-[var(--color-wood)] text-[var(--color-cream)] rounded-lg hover:bg-[var(--color-wood-light)] transition-colors">
        闻香完成，开始品味
      </button>
    </div>

    <!-- ======== ③ 品味 ======== -->
    <div v-if="step === 'taste'" class="w-full max-w-md">
      <div class="space-y-6 mb-8">
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

        <!-- 天气 & 心情 -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm text-[var(--color-wood)] mb-2">天气</label>
            <div class="flex flex-wrap gap-1">
              <button v-for="w in weatherOptions" :key="w" @click="weather = w"
                class="px-2 py-1 text-xs rounded-lg transition-all"
                :class="weather === w ? 'bg-[var(--color-wood)] text-white' : 'bg-[var(--color-paper)] text-[var(--color-wood)]'">
                {{ w }}
              </button>
            </div>
          </div>
          <div>
            <label class="block text-sm text-[var(--color-wood)] mb-2">心情</label>
            <div class="flex flex-wrap gap-1">
              <button v-for="m in moodOptions" :key="m" @click="mood = m"
                class="px-2 py-1 text-xs rounded-lg transition-all"
                :class="mood === m ? 'bg-[var(--color-wood)] text-white' : 'bg-[var(--color-paper)] text-[var(--color-wood)]'">
                {{ m }}
              </button>
            </div>
          </div>
        </div>

        <!-- 品鉴笔记 -->
        <div>
          <label class="block text-sm text-[var(--color-wood)] mb-2">品鉴笔记（可选）</label>
          <textarea
            v-model="tastingNotes"
            placeholder="记录你的品茶感受..."
            class="w-full h-24 p-3 rounded-lg border border-[var(--color-paper)] text-[var(--color-ink)] resize-none focus:outline-none focus:border-[var(--color-tea-gold)]"
          ></textarea>
        </div>
      </div>

      <button @click="submit"
        class="w-full py-4 bg-[var(--color-wood)] text-[var(--color-cream)] text-xl rounded-lg hover:bg-[var(--color-wood-light)] transition-colors">
        完成品鉴
      </button>
    </div>

    <!-- ======== 结果 ======== -->
    <div v-if="step === 'result'" class="text-center w-full max-w-md">
      <div class="mb-6">
        <p class="text-6xl font-bold mb-2" :style="{ color: scoreLevel.color }">{{ finalScore }}</p>
        <p class="text-xl text-[var(--color-wood)] mb-2">{{ scoreLevel.text }}</p>
        <p class="text-sm text-[var(--color-wood-light)] mb-4">
          工艺系数 {{ (store.processFactor * 100).toFixed(0) }}%
          <template v-if="store.selectedTeaWare"> · 茶器 {{ store.selectedTeaWare.name }}</template>
        </p>
      </div>

      <!-- 结果详情 -->
      <div class="glass-panel rounded-xl p-4 mb-6 text-left text-sm">
        <div class="flex justify-between text-xs text-[var(--color-wood-light)] mb-2">
          <span>{{ weather || '不限天气' }} {{ mood || '' }}</span>
          <span>{{ new Date().toLocaleDateString() }}</span>
        </div>
        <p class="text-[var(--color-wood)]">
          <strong>茶汤色：</strong>
          <span :style="{ color: soupColor }">■</span> {{ soupColor }}
        </p>
        <p v-if="selectedAroma" class="text-[var(--color-wood)] mt-2">
          <strong>香气：</strong>{{ aromaTypes.find(a => a.id === selectedAroma)?.label }}
        </p>
        <div class="mt-2 grid grid-cols-5 gap-2">
          <div v-for="d in dimensions" :key="d.key" class="text-center">
            <p class="text-xs text-[var(--color-wood-light)]">{{ d.label.slice(0, 2) }}</p>
            <p class="text-lg font-bold text-[var(--color-wood)]">{{ store.tasteDimensions[d.key] }}</p>
          </div>
        </div>
        <p v-if="tastingNotes" class="text-[var(--color-wood-light)] mt-2 italic">
          "{{ tastingNotes }}"
        </p>
        <!-- AI 茶记 -->
        <div v-if="aiComment" class="mt-3 pt-3 border-t border-[var(--color-tea-gold)]/30">
          <div class="flex items-start gap-2">
            <span class="text-sm">🤖</span>
            <div>
              <p class="text-xs text-[var(--color-tea-gold)] font-bold mb-1">茶灵 AI</p>
              <p class="text-sm text-[var(--color-wood)] italic">{{ aiComment }}</p>
            </div>
          </div>
        </div>
        <div v-else-if="!aiComment && step === 'result'" class="mt-3 text-xs text-[var(--color-wood-light)]">
          🤖 茶灵正在思考...
        </div>
      </div>

      <button @click="router.push('/select')"
        class="w-full block py-4 bg-[var(--color-wood)] text-[var(--color-cream)] text-xl rounded-lg hover:bg-[var(--color-wood-light)] transition-colors mb-4">
        再品一款
      </button>
      <button @click="router.push('/')"
        class="w-full block py-4 border-2 border-[var(--color-wood)] text-[var(--color-wood)] text-xl rounded-lg hover:bg-[var(--color-paper)] transition-colors">
        返回首页
      </button>
    </div>

    <!-- 成就解锁通知 -->
    <Teleport to="body">
      <div
        v-if="store.newAchievement"
        class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl p-8 text-center animate-[fadeIn_0.3s_ease-out]"
      >
        <p class="text-5xl mb-3">{{ store.achievements.find(a => a.id === store.newAchievement)?.icon }}</p>
        <p class="text-xl font-bold text-[var(--color-wood)] mb-1">成就解锁！</p>
        <p class="text-lg text-[var(--color-tea-gold)] font-bold mb-1">
          {{ store.achievements.find(a => a.id === store.newAchievement)?.name }}
        </p>
        <p class="text-sm text-[var(--color-wood-light)] mb-6">
          {{ store.achievements.find(a => a.id === store.newAchievement)?.description }}
        </p>
        <button
          @click="store.dismissNewAchievement()"
          class="px-8 py-2 bg-[var(--color-wood)] text-[var(--color-cream)] rounded-lg hover:bg-[var(--color-wood-light)]"
        >
          知道了
        </button>
      </div>
    </Teleport>
  </div>
</template>
