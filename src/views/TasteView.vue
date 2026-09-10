<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTeaStore } from '@/stores/tea'
import { getSoupColor } from '@/data/teas'
import { getScoreLevel } from '@/services/scoring'
import { generateTastingNote } from '@/services/teaAI'
import TasteRadarChart from '@/components/tasting/TasteRadarChart.vue'
import TasteTrendChart from '@/components/tasting/TasteTrendChart.vue'
import TastingCard from '@/components/tasting/TastingCard.vue'
import type { TastingRecord, TasteDimensions } from '@/types/tasting'

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
  { id: 'floral', label: '花香', icon: 'Flower' },
  { id: 'fruity', label: '果香', icon: 'Apple' },
  { id: 'honey', label: '蜜香', icon: 'Droplet' },
  { id: 'caramel', label: '焦糖', icon: 'Cookie' },
  { id: 'woody', label: '木质', icon: 'TreePine' },
  { id: 'herbal', label: '草药', icon: 'Leaf' },
  { id: 'creamy', label: '奶香', icon: 'Cup' },
  { id: 'aged', label: '陈香', icon: 'Clock' },
  { id: 'roasted', label: '焙火', icon: 'Flame' },
  { id: 'fresh', label: '鲜爽', icon: 'Sparkles' },
]
const selectedAromas = ref<string[]>([])

function toggleAroma(id: string) {
  const idx = selectedAromas.value.indexOf(id)
  if (idx >= 0) {
    selectedAromas.value.splice(idx, 1)
  } else {
    selectedAromas.value.push(id)
  }
}

const selectedAromaLabels = computed(() =>
  selectedAromas.value
    .map(id => aromaTypes.find(a => a.id === id)?.label)
    .filter((l): l is string => !!l)
    .join('、'),
)

// ============ 品味（八维评分）============
// 八维是底层评分模型（雷达图/综合分/成长体系复用）。
// 新手不直接面对八维：用「第一口表情 + 大白话感受标签」极简快评，自动反推八维；
// 专业模式才暴露 1-5 滑块。
const dimensions = [
  { key: 'bitterness' as const, label: '苦涩度', short: '苦', left: '清淡', right: '浓烈', icon: 'Minus' },
  { key: 'sweetness' as const, label: '甜度', short: '甜', left: '无甜', right: '甘甜', icon: 'Heart' },
  { key: 'aftertaste' as const, label: '回甘', short: '回', left: '无回甘', right: '持久', icon: 'Sparkle' },
  { key: 'body' as const, label: '醇厚度', short: '醇', left: '单薄', right: '醇厚', icon: 'Gem' },
  { key: 'aroma' as const, label: '香气持久度', short: '香', left: '短暂', right: '持久', icon: 'Wind' },
  { key: 'rhyme' as const, label: '茶韵', short: '韵', left: '浅薄', right: '悠长', icon: 'Activity' },
  { key: 'shape' as const, label: '叶底', short: '叶', left: '粗散', right: '匀整', icon: 'Target' },
  { key: 'mind' as const, label: '心境', short: '心', left: '浮躁', right: '禅定', icon: 'Crown' },
] as const

// 新手 / 专业模式切换（默认新手，降低品鉴门槛）
const isExpertMode = ref(false)

// ---- 新手快评 1：第一口感觉（表情单选，定整体基调与心境维度）----
const firstSipOptions = [
  { score: 5, icon: 'Laugh', label: '很喜欢' },
  { score: 4, icon: 'Smile', label: '还不错' },
  { score: 3, icon: 'Meh', label: '一般' },
  { score: 2, icon: 'Frown', label: '不太习惯' },
  { score: 1, icon: 'Angry', label: '不好喝' },
]
const firstSip = ref<number | null>(null)

// ---- 新手快评 2：大白话感受标签（多选，同组互斥；选中即映射到对应八维）----
const feelTags = [
  { id: 'smooth', label: '顺口不苦涩', group: 'bit' },
  { id: 'bitter', label: '有点苦', group: 'bit' },
  { id: 'astringent', label: '涩口', group: 'bit' },
  { id: 'sweet', label: '甜甜的', group: 'sweet' },
  { id: 'noSweet', label: '没什么甜味', group: 'sweet' },
  { id: 'huigan', label: '回甘明显', group: 'hui' },
  { id: 'noHuigan', label: '咽完没余味', group: 'hui' },
  { id: 'aromatic', label: '香香的', group: 'aro' },
  { id: 'noAroma', label: '没什么香气', group: 'aro' },
  { id: 'fresh', label: '很鲜爽', group: 'style' },
  { id: 'lingering', label: '余味悠长', group: 'style' },
  { id: 'mellow', label: '口感醇厚', group: 'body' },
  { id: 'thin', label: '淡淡的偏薄', group: 'body' },
]
// 标签 → 八维分数覆盖（未覆盖维度走由第一口感觉决定的基准值）
const feelTagMap: Record<string, Partial<TasteDimensions>> = {
  smooth: { bitterness: 1 },
  bitter: { bitterness: 4 },
  astringent: { bitterness: 5 },
  sweet: { sweetness: 5 },
  noSweet: { sweetness: 2 },
  huigan: { aftertaste: 5 },
  noHuigan: { aftertaste: 1 },
  aromatic: { aroma: 5 },
  noAroma: { aroma: 2 },
  fresh: { aroma: 4, rhyme: 4 },
  lingering: { rhyme: 5 },
  mellow: { body: 5 },
  thin: { body: 2 },
}
const selectedFeelTags = ref<string[]>([])

function toggleFeelTag(id: string) {
  const tag = feelTags.find(t => t.id === id)
  if (!tag) return
  const arr = selectedFeelTags.value
  const idx = arr.indexOf(id)
  if (idx >= 0) {
    arr.splice(idx, 1)
    return
  }
  // 同组互斥：先移除同组其他标签
  for (let i = arr.length - 1; i >= 0; i--) {
    if (feelTags.find(t => t.id === arr[i])?.group === tag.group) arr.splice(i, 1)
  }
  arr.push(id)
}

// 由「第一口感觉 + 感受标签」反推八维（新手不直接打分）
function buildQuickDimensions(): TasteDimensions {
  const sip = firstSip.value ?? 3
  // 基准值随整体喜恶浮动：喜欢→4，一般→3，不喜欢→2；心境维度直接取第一口感觉
  const baseline = sip >= 4 ? 4 : sip <= 2 ? 2 : 3
  const dims: TasteDimensions = {
    bitterness: baseline,
    sweetness: baseline,
    aftertaste: baseline,
    body: baseline,
    aroma: baseline,
    rhyme: baseline,
    shape: baseline,
    mind: sip,
  }
  for (const id of selectedFeelTags.value) {
    Object.assign(dims, feelTagMap[id])
  }
  return dims
}

// 新手快评任一选择变化 → 实时写回八维（雷达图/综合分即时反馈）；专业模式不干预
watch([firstSip, selectedFeelTags], () => {
  if (isExpertMode.value) return
  Object.assign(store.tasteDimensions, buildQuickDimensions())
}, { deep: true })

// ============ 笔记 ============
const tastingNotes = ref('')
const weather = ref<string>('')
const mood = ref<string>('')

const weatherOptions = ['晴', '多云', '雨', '雾', '雪']
const moodOptions = ['愉悦', '安静', '禅定', '沉思', '悠然']

// ============ 评分结果 ============
const finalScore = computed(() => store.calculateScore())
const scoreLevel = computed(() => getScoreLevel(finalScore.value))
const aiComment = ref('')
const isSaving = ref(false)
const saveError = ref('')
const savedRecord = ref<TastingRecord | null>(null)
const shareMessage = ref('')

async function submit() {
  if (isSaving.value) return
  if (!store.currentTea) {
    alert('未选择茶叶，无法保存品鉴记录')
    return
  }

  isSaving.value = true
  saveError.value = ''
  try {
    savedRecord.value = await store.saveRecord(
      selectedAromaLabels.value || undefined,
      tastingNotes.value || undefined,
      weather.value || undefined,
      mood.value || undefined,
    )
    step.value = 'result'
  } catch {
    saveError.value = '保存失败，请检查浏览器存储权限后重试'
    return
  } finally {
    isSaving.value = false
  }

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

// 当前维度数据（用于雷达图）
const currentDimensions = computed(() => {
  const dims: Record<string, number> = {}
  for (const d of dimensions) {
    dims[d.key] = store.tasteDimensions[d.key]
  }
  return dims
})

// 历史均值（用于对比）
const averageDimensions = computed(() => {
  if (store.history.length === 0) return {}
  const teaRecords = store.history.filter(r => r.teaId === store.currentTea?.id)
  if (teaRecords.length === 0) return {}

  const sums: Record<string, number> = {}
  for (const d of dimensions) {
    sums[d.key] = 0
  }
  for (const record of teaRecords) {
    for (const d of dimensions) {
      sums[d.key] = (sums[d.key] ?? 0) + (record.dimensions[d.key as keyof typeof record.dimensions] ?? 0)
    }
  }
  const avgs: Record<string, number> = {}
  for (const d of dimensions) {
    avgs[d.key] = (sums[d.key] ?? 0) / teaRecords.length
  }
  return avgs
})
</script>

<template>
  <div class="min-h-screen p-4 sm:p-8 flex flex-col items-center">
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
      <div class="w-48 h-48 rounded-2xl shadow-lg mb-6 transition-colors duration-500 relative"
        :style="{ backgroundColor: soupColor }">
        <component
          :is="`Icon${`Steam`}`"
          class="absolute top-4 right-4 w-8 h-8 text-white/60 animate-bounce"
        />
      </div>
      <div class="flex items-center gap-2 mb-2">
        <span class="text-sm text-[var(--color-wood)]">你的茶汤</span>
        <span class="w-8 h-8 rounded-full shadow-inner" :style="{ backgroundColor: soupColor }"></span>
        <template v-if="store.currentTea">
          <span class="text-xs text-[var(--color-wood-light)] ml-2">正常范围</span>
          <span class="w-5 h-5 rounded-full" :style="{ backgroundColor: store.currentTea.soupColorMin }"></span>
          <span class="text-[var(--color-wood-light)] text-xs">至</span>
          <span class="w-5 h-5 rounded-full" :style="{ backgroundColor: store.currentTea.soupColorMax }"></span>
        </template>
      </div>
      <button @click="step = 'aroma'"
        class="px-8 py-3 bg-[var(--color-wood)] text-[var(--color-cream)] rounded-lg hover:bg-[var(--color-wood-light)] transition-colors flex items-center gap-2">
        <IconChevronRight class="w-5 h-5" />
        观色完成，继续闻香
      </button>
    </div>

    <!-- ======== ② 闻香 ======== -->
    <div v-if="step === 'aroma'" class="w-full max-w-md">
      <p class="text-sm text-[var(--color-wood)] mb-1">你闻到了什么香气？（可多选）</p>
      <p class="text-xs text-[var(--color-wood-light)] mb-4">闻不出来也没关系，直接下一步就行</p>
      <div class="grid grid-cols-2 gap-3 mb-8">
        <button
          v-for="a in aromaTypes" :key="a.id"
          @click="toggleAroma(a.id)"
          class="p-4 rounded-xl border-2 text-left transition-all flex items-center gap-2"
          :class="selectedAromas.includes(a.id)
            ? 'border-[var(--color-tea-gold)] bg-[var(--color-paper)]'
            : 'border-transparent bg-white hover:shadow-md'"
        >
          <component
            :is="`Icon${a.icon}`"
            class="w-6 h-6 text-[var(--color-tea-gold)]"
          />
          <span class="text-[var(--color-wood)]">{{ a.label }}</span>
          <component
            v-if="selectedAromas.includes(a.id)"
            :is="`IconCheckCircle`"
            class="w-5 h-5 ml-auto text-[var(--color-tea-gold)]"
          />
        </button>
      </div>

      <button @click="step = 'taste'"
        class="w-full py-3 bg-[var(--color-wood)] text-[var(--color-cream)] rounded-lg hover:bg-[var(--color-wood-light)] transition-colors flex items-center justify-center gap-2">
        <IconChevronRight class="w-5 h-5" />
        闻香完成，开始品味
      </button>
    </div>

    <!-- ======== ③ 品味 ======== -->
    <div v-if="step === 'taste'" class="w-full max-w-lg">
      <div class="space-y-6 mb-8">
        <!-- 新手 / 专业模式切换 -->
        <div class="flex justify-end">
          <button @click="isExpertMode = !isExpertMode"
            class="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-paper)] text-[var(--color-wood-light)] hover:text-[var(--color-wood)] hover:border-[var(--color-tea-gold)] transition-colors">
            {{ isExpertMode ? '← 切回新手模式' : '专业模式（滑块打分）→' }}
          </button>
        </div>

        <!-- 新手模式：第一口表情 + 大白话标签，自动反推八维（无需理解专业术语） -->
        <div v-if="!isExpertMode" class="space-y-6">
          <!-- 第一口感觉 -->
          <div>
            <p class="text-sm font-bold text-[var(--color-wood)] mb-1">第一口感觉怎么样？</p>
            <p class="text-xs text-[var(--color-wood-light)] mb-3">凭直觉选一个就行</p>
            <div class="grid grid-cols-5 gap-2">
              <button
                v-for="opt in firstSipOptions" :key="opt.score"
                @click="firstSip = opt.score"
                class="flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all"
                :class="firstSip === opt.score
                  ? 'border-[var(--color-tea-gold)] bg-[var(--color-paper)] shadow-md scale-105'
                  : 'border-transparent bg-white hover:shadow-md'"
              >
                <component :is="`Icon${opt.icon}`" class="w-6 h-6 mx-auto text-[var(--color-wood)]" />
                <span class="text-[11px] text-[var(--color-wood)]">{{ opt.label }}</span>
              </button>
            </div>
          </div>

          <!-- 喝到了什么味道 -->
          <div>
            <p class="text-sm font-bold text-[var(--color-wood)] mb-1">喝到了什么味道？（多选，没有可不选）</p>
            <p v-if="store.currentTea?.flavor?.length" class="text-xs text-[var(--color-tea-gold)] mb-3">
              这款「{{ store.currentTea.name }}」通常带 {{ store.currentTea.flavor.join('、') }}，你喝到了吗？
            </p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="t in feelTags" :key="t.id"
                @click="toggleFeelTag(t.id)"
                class="px-3.5 py-2 rounded-full text-sm border transition-all"
                :class="selectedFeelTags.includes(t.id)
                  ? 'bg-[var(--color-tea-gold)] text-white border-[var(--color-tea-gold)] shadow-sm'
                  : 'bg-white text-[var(--color-wood)] border-[var(--color-paper)] hover:border-[var(--color-tea-gold)]'"
              >
                {{ t.label }}
              </button>
            </div>
          </div>
        </div>

        <!-- 专业模式：滑块打分 -->
        <template v-if="isExpertMode">
        <div v-for="d in dimensions" :key="d.key" class="p-4 bg-white/50 rounded-xl border border-[var(--color-paper)]">
          <div class="flex items-center gap-3 mb-3">
            <component
              :is="`Icon${d.icon}`"
              class="w-5 h-5 text-[var(--color-tea-gold)] shrink-0"
            />
            <label class="block text-sm text-[var(--color-wood)] flex-1">
              {{ d.label }} <span class="text-[var(--color-tea-gold)] font-bold">({{ store.tasteDimensions[d.key] }})</span>
            </label>
          </div>
          <input
            type="range"
            v-model.number="store.tasteDimensions[d.key]"
            min="1"
            max="5"
            class="w-full h-2 bg-[var(--color-paper)] rounded-lg appearance-none cursor-pointer accent-[var(--color-tea-gold)]"
          />
          <div class="flex justify-between text-xs text-[var(--color-wood-light)] mt-2">
            <span>{{ d.left }}</span>
            <span>{{ d.right }}</span>
          </div>
        </div>
        </template>

        <!-- 雷达图实时预览 -->
        <div class="bg-[var(--color-paper)] rounded-xl p-4 border border-[var(--color-tea-gold)]/20">
          <p class="text-sm font-bold text-[var(--color-wood)] mb-3 flex items-center gap-2">
            <IconBarChart class="w-4 h-4" />
            实时品鉴雷达图
          </p>
          <TasteRadarChart
            :current-dimensions="currentDimensions"
            :average-dimensions="averageDimensions"
            :show-comparison="Object.keys(averageDimensions).length > 0"
            :size="240"
          />
          <p v-if="Object.keys(averageDimensions).length === 0" class="text-xs text-[var(--color-wood-light)] text-center mt-2">
            完成品鉴后将显示历史均值对比
          </p>
        </div>

        <!-- 天气 & 心情 -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm text-[var(--color-wood)] mb-2 flex items-center gap-1">
              <IconCloudSun class="w-4 h-4" /> 天气
            </label>
            <div class="flex flex-wrap gap-1">
              <button v-for="w in weatherOptions" :key="w" @click="weather = w"
                class="px-2 py-1 text-xs rounded-lg transition-all"
                :class="weather === w ? 'bg-[var(--color-wood)] text-white' : 'bg-[var(--color-paper)] text-[var(--color-wood)]'">
                {{ w }}
              </button>
            </div>
          </div>
          <div>
            <label class="block text-sm text-[var(--color-wood)] mb-2 flex items-center gap-1">
              <IconHeart class="w-4 h-4" /> 心情
            </label>
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
          <label class="block text-sm text-[var(--color-wood)] mb-2 flex items-center gap-1">
            <IconEdit class="w-4 h-4" /> 品鉴笔记（可选）
          </label>
          <textarea
            v-model="tastingNotes"
            placeholder="记录你的品茶感受..."
            class="w-full h-24 p-3 rounded-lg border border-[var(--color-paper)] text-[var(--color-ink)] resize-none focus:outline-none focus:border-[var(--color-tea-gold)]"
          ></textarea>
        </div>
      </div>

      <p v-if="saveError" class="text-sm text-red-600 text-center mb-3">{{ saveError }}</p>
      <button @click="submit" :disabled="isSaving"
        class="w-full py-4 bg-[var(--color-wood)] text-[var(--color-cream)] text-xl rounded-lg hover:bg-[var(--color-wood-light)] transition-colors disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2">
        <IconCheckCircle class="w-5 h-5" />
        {{ isSaving ? '保存中...' : '完成品鉴' }}
      </button>
    </div>

    <!-- ======== 结果 ======== -->
    <div v-if="step === 'result'" class="text-center w-full max-w-lg">
      <div class="mb-6">
        <p class="text-6xl font-bold mb-2" :style="{ color: scoreLevel.color }">{{ finalScore }}</p>
        <p class="text-xl text-[var(--color-wood)] mb-2">{{ scoreLevel.text }}</p>
        <p class="text-sm text-[var(--color-wood-light)] mb-4 flex items-center justify-center gap-4">
          <span class="flex items-center gap-1">
            <IconTarget class="w-4 h-4" />
            工艺系数 {{ (store.processFactor * 100).toFixed(0) }}%
          </span>
          <template v-if="store.selectedTeaWare">
            <span class="flex items-center gap-1">
              <IconBowl class="w-4 h-4" />
              {{ store.selectedTeaWare.name }}
            </span>
          </template>
        </p>
      </div>

      <div v-if="savedRecord" class="mb-6 w-full">
        <TastingCard :record="savedRecord" @shared="shareMessage = '品鉴内容已复制或交给系统分享'" />
        <p v-if="shareMessage" class="mt-2 text-xs text-[var(--color-tea-gold)]">{{ shareMessage }}</p>
      </div>

      <!-- 结果详情 + 雷达图 + 趋势图 -->
      <div class="grid gap-4 mb-6">
        <div class="glass-panel rounded-xl p-4 text-left text-sm">
          <div class="flex justify-between text-xs text-[var(--color-wood-light)] mb-2 flex flex-wrap gap-2">
            <span class="flex items-center gap-1">
              <IconCloud class="w-3 h-3" />
              {{ weather || '不限天气' }}
            </span>
            <span class="flex items-center gap-1">
              <IconHeart class="w-3 h-3" />
              {{ mood || '平静' }}
            </span>
            <span class="flex items-center gap-1">
              <IconCalendar class="w-3 h-3" />
              {{ new Date().toLocaleDateString() }}
            </span>
          </div>
          <p class="text-[var(--color-wood)] flex items-center gap-1">
            <IconDroplet class="w-4 h-4" :style="{ color: soupColor }" />
            <strong>茶汤色：</strong>
            <span :style="{ color: soupColor }">■</span> {{ soupColor }}
          </p>
          <p v-if="selectedAromaLabels" class="text-[var(--color-wood)] mt-2 flex items-center gap-1">
            <IconWind class="w-4 h-4" />
            <strong>香气：</strong>{{ selectedAromaLabels }}
          </p>
          <div class="mt-2 grid grid-cols-4 sm:grid-cols-8 gap-1">
            <div v-for="d in dimensions" :key="d.key" class="text-center">
              <component
                :is="`Icon${d.icon}`"
                class="w-4 h-4 mx-auto mb-1 text-[var(--color-tea-gold)]"
              />
              <p class="text-xs text-[var(--color-wood-light)]">{{ d.short }}</p>
              <p class="text-lg font-bold text-[var(--color-wood)]">{{ store.tasteDimensions[d.key] }}</p>
            </div>
          </div>
          <p v-if="tastingNotes" class="text-[var(--color-wood-light)] mt-2 italic">
            "{{ tastingNotes }}"
          </p>
          <!-- AI 茶记 -->
          <div v-if="aiComment" class="mt-3 pt-3 border-t border-[var(--color-tea-gold)]/30">
            <div class="flex items-start gap-2">
              <IconBot :size="18" class="mt-0.5 text-[var(--color-tea-gold)]" />
              <div>
                <p class="text-xs text-[var(--color-tea-gold)] font-bold mb-1">茶灵 AI</p>
                <p class="text-sm text-[var(--color-wood)] italic">{{ aiComment }}</p>
              </div>
            </div>
          </div>
          <div v-else-if="!aiComment && step === 'result'" class="mt-3 text-xs text-[var(--color-wood-light)]">
            <IconBot :size="14" class="inline-block mr-1 -mt-0.5 text-[var(--color-tea-gold)]" /> 茶灵正在思考...
          </div>
        </div>

        <!-- 雷达图对比 -->
        <div v-if="Object.keys(averageDimensions).length > 0" class="glass-panel rounded-xl p-4">
          <p class="text-sm font-bold text-[var(--color-wood)] mb-3 flex items-center gap-2">
            <IconBarChart class="w-4 h-4" />
            品鉴对比：本次 vs 历史均值
          </p>
          <TasteRadarChart
            :current-dimensions="currentDimensions"
            :average-dimensions="averageDimensions"
            :show-comparison="true"
            :size="280"
          />
        </div>

        <!-- 历史趋势图 -->
        <div v-if="store.history.length > 0" class="glass-panel rounded-xl p-4">
          <p class="text-sm font-bold text-[var(--color-wood)] mb-3 flex items-center gap-2">
            <IconTrendingUp class="w-4 h-4" />
            综合评分趋势（最近 20 次）
          </p>
          <TasteTrendChart :records="store.history" :height="180" />
        </div>
      </div>

      <button @click="router.push('/select')"
        class="w-full block py-4 bg-[var(--color-wood)] text-[var(--color-cream)] text-xl rounded-lg hover:bg-[var(--color-wood-light)] transition-colors mb-4 flex items-center justify-center gap-2">
        <IconPlus class="w-5 h-5" />
        再品一款
      </button>
      <button @click="router.push('/')"
        class="w-full block py-4 border-2 border-[var(--color-wood)] text-[var(--color-wood)] text-xl rounded-lg hover:bg-[var(--color-paper)] transition-colors flex items-center justify-center gap-2">
        <IconHome class="w-5 h-5" />
        返回首页
      </button>
    </div>

    <!-- 成就解锁通知 -->
    <Teleport to="body">
      <div
        v-if="store.newAchievement"
        class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl p-8 text-center animate-[fadeIn_0.3s_ease-out]"
      >
        <component :is="`Icon${store.achievements.find(a => a.id === store.newAchievement)?.icon}`" class="w-12 h-12 mx-auto mb-3 text-[var(--color-tea-gold)]" />
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
