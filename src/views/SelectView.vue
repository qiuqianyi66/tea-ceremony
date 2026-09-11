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

/** 苏格拉底式追问：此刻想要什么感受？映射到推荐茶类 */
const moodOptions = [
  { id: 'refresh', label: '提神醒神', types: [TeaType.GREEN, TeaType.OOLONG] },
  { id: 'calm', label: '静心安神', types: [TeaType.WHITE, TeaType.YELLOW] },
  { id: 'warm', label: '暖身暖胃', types: [TeaType.RED, TeaType.DARK] },
  { id: 'relax', label: '放松享受', types: [TeaType.OOLONG, TeaType.RED] },
] as const
const selectedMood = ref<string | null>(null)

function pickMood(id: string) {
  if (selectedMood.value === id) {
    selectedMood.value = null
    selectedType.value = null
  } else {
    selectedMood.value = id
    const mood = moodOptions.find(m => m.id === id)
    if (mood) selectedType.value = mood.types[0]
  }
  selectedTea.value = null
}

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
      const localByName = new Map(teas.map(tea => [tea.name, tea]))
      catalog.value = remoteTeas.map(remoteTea => {
        const localTea = localByName.get(remoteTea.name)
        return localTea
          ? { ...localTea, ...remoteTea, id: localTea.id }
          : remoteTea
      })
    }
  } catch (error) {
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
  <div class="select-root">
    <!-- 顶部栏 -->
    <header class="select-topbar">
      <button class="back-btn" @click="router.push('/')">
        <IconArrowLeft :size="18" /><span>首页</span>
      </button>
      <h1 class="select-title">选茶</h1>
      <div class="w-16"></div>
    </header>

    <main class="select-content">
      <!-- 苏格拉底式追问 -->
      <section class="mood-panel">
        <p class="mood-label">此刻想要什么感受？</p>
        <div class="mood-row">
          <button v-for="m in moodOptions" :key="m.id" @click="pickMood(m.id)"
            class="mood-btn"
            :class="{ active: selectedMood === m.id }">
            {{ m.label }}
          </button>
        </div>
      </section>

      <!-- 茶类筛选 -->
      <div class="type-row">
        <button @click="filterTeas(null)"
          class="type-btn"
          :class="{ active: !selectedType }">
          全部
        </button>
        <button v-for="t in types" :key="t" @click="filterTeas(t)"
          class="type-btn"
          :class="{ active: selectedType === t }">
          {{ t }}
        </button>
      </div>

      <!-- 茶叶网格 -->
      <template v-if="visibleTeas.length > 0">
        <div class="tea-grid">
          <div v-for="tea in visibleTeas" :key="tea.id"
            class="tea-card"
            :class="{ selected: selectedTea?.id === tea.id }"
            @click="selectTea(tea)">
            <img v-if="tea.image && !imgFailed[tea.id]" :src="tea.image" loading="lazy"
              @error="markImgFailed(tea.id)"
              class="tea-img" :alt="tea.name" />
            <div v-else class="tea-img-fallback"
              :style="{ background: `linear-gradient(135deg, ${tea.soupColorMin}, ${tea.soupColorMax})` }"></div>
            <div class="tea-body">
              <h3 class="tea-name">{{ tea.name }}</h3>
              <p class="tea-origin">{{ tea.type }} · {{ tea.origin }}</p>
              <p class="tea-desc">{{ tea.description }}</p>
              <div class="flavor-row">
                <span v-for="f in tea.flavor" :key="f" class="flavor-pill">{{ f }}</span>
              </div>
            </div>
            <!-- 相关茶人（选中时展开） -->
            <div v-if="selectedTea?.id === tea.id" class="masters-panel">
              <div v-for="master in teaMasters(tea)" :key="master.id"
                class="master-row">
                <component :is="`Icon${master.avatar}`" class="master-icon" />
                <div>
                  <p class="master-name">{{ master.name }}（{{ master.dynasty }}）· {{ master.title }}</p>
                  <p class="master-quote">"{{ master.quote.slice(0, 24) }}…"</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
      <p v-else class="empty-hint">该分类暂无茶——等一盏新茶入席</p>
      <p v-if="isLoading" class="loading-hint">正在同步茶叶目录…</p>
    </main>

    <!-- 底部确认栏 -->
    <footer class="confirm-bar">
      <button @click="confirm" :disabled="!selectedTea"
        class="confirm-btn"
        :class="{ disabled: !selectedTea }">
        {{ selectedTea ? `选择 ${selectedTea.name}` : '请选择一种茶叶' }}
      </button>
    </footer>
  </div>
</template>

<style scoped>
.select-root {
  min-height: 100dvh;
  background: linear-gradient(160deg, #0f1a14 0%, #1a2420 50%, #0d1410 100%);
  color: #f5f1e6;
  font-family: var(--font-sans);
  padding-bottom: 6rem;
}

/* 顶部栏 */
.select-topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1.4rem 1.6rem 1rem;
}
.back-btn {
  display: inline-flex; align-items: center; gap: 0.4rem;
  background: rgba(255,255,255,0.08); border: 1px solid rgba(245,241,230,0.15);
  color: #f5f1e6; padding: 0.5rem 1rem; border-radius: 999px;
  font-size: 0.85rem; cursor: pointer; transition: background 0.25s;
  min-height: 2.75rem; font-family: inherit;
}
.back-btn:hover { background: rgba(255,255,255,0.15); }
.select-title {
  font-family: var(--font-serif);
  font-size: 1.5rem; letter-spacing: 0.35em; margin: 0;
}

.select-content {
  max-width: 72rem; margin: 0 auto; padding: 0 1.2rem;
}

/* 感受选择 */
.mood-panel {
  padding: 1.1rem 1.2rem; margin-bottom: 1.5rem;
  border-radius: 1rem;
  background: rgba(16, 26, 22, 0.6);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(245, 241, 230, 0.1);
}
.mood-label {
  font-size: 0.85rem; letter-spacing: 0.1em;
  color: rgba(245, 241, 230, 0.7); margin: 0 0 0.7rem;
}
.mood-row { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.mood-btn {
  padding: 0.5rem 1.1rem; border-radius: 999px;
  font-size: 0.85rem; cursor: pointer;
  background: rgba(245, 241, 230, 0.06);
  border: 1px solid rgba(245, 241, 230, 0.12);
  color: rgba(245, 241, 230, 0.75);
  transition: all 0.25s; font-family: inherit;
  min-height: 2.5rem;
}
.mood-btn:hover { border-color: rgba(201, 169, 110, 0.5); }
.mood-btn.active {
  background: rgba(201, 169, 110, 0.85);
  border-color: transparent; color: #1a120a; font-weight: 500;
}

/* 茶类筛选 */
.type-row {
  display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.5rem;
}
.type-btn {
  padding: 0.5rem 1.1rem; border-radius: 999px;
  font-size: 0.85rem; cursor: pointer;
  background: rgba(245, 241, 230, 0.06);
  border: 1px solid rgba(245, 241, 230, 0.12);
  color: rgba(245, 241, 230, 0.7);
  transition: all 0.25s; font-family: inherit;
  min-height: 2.5rem;
}
.type-btn:hover { border-color: rgba(201, 169, 110, 0.4); }
.type-btn.active {
  background: rgba(201, 169, 110, 0.2);
  border-color: rgba(201, 169, 110, 0.7);
  color: #e8d5b0;
}

/* 茶叶网格 */
.tea-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}
.tea-card {
  padding: 1.2rem; border-radius: 1rem; cursor: pointer;
  background: rgba(16, 26, 22, 0.6);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(245, 241, 230, 0.1);
  transition: all 0.28s ease;
}
.tea-card:hover {
  border-color: rgba(201, 169, 110, 0.45);
  transform: translateY(-2px);
}
.tea-card.selected {
  border-color: rgba(201, 169, 110, 0.8);
  background: rgba(20, 34, 28, 0.75);
  box-shadow: 0 0 24px rgba(201, 169, 110, 0.15);
}
.tea-img {
  width: 100%; height: 120px; object-fit: cover;
  border-radius: 0.7rem; margin-bottom: 0.9rem;
}
.tea-img-fallback {
  width: 100%; height: 120px; border-radius: 0.7rem; margin-bottom: 0.9rem;
}
.tea-name {
  font-family: var(--font-serif);
  font-size: 1.25rem; color: #f3efe4; margin: 0 0 0.3rem;
}
.tea-origin {
  font-size: 0.78rem; letter-spacing: 0.08em;
  color: rgba(201, 169, 110, 0.9); margin: 0 0 0.5rem;
}
.tea-desc {
  font-size: 0.82rem; line-height: 1.6;
  color: rgba(245, 241, 230, 0.6); margin: 0 0 0.7rem;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.flavor-row { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.flavor-pill {
  font-size: 0.7rem; color: rgba(245, 241, 230, 0.7);
  background: rgba(245, 241, 230, 0.08);
  padding: 0.15rem 0.55rem; border-radius: 999px;
}

/* 相关茶人 */
.masters-panel {
  margin-top: 0.9rem; padding-top: 0.9rem;
  border-top: 1px solid rgba(245, 241, 230, 0.1);
}
.master-row { display: flex; gap: 0.6rem; margin-bottom: 0.5rem; }
.master-icon {
  width: 1.5rem; height: 1.5rem; flex-shrink: 0;
  color: rgba(201, 169, 110, 0.9);
}
.master-name {
  font-size: 0.78rem; color: #e8d5b0; margin: 0;
}
.master-quote {
  font-size: 0.7rem; color: rgba(245, 241, 230, 0.45);
  margin: 0.15rem 0 0; font-style: italic;
}

/* 空态 / 加载 */
.empty-hint, .loading-hint {
  text-align: center; padding: 3rem 0;
  font-size: 0.85rem; color: rgba(245, 241, 230, 0.45);
}

/* 底部确认栏 */
.confirm-bar {
  position: fixed; bottom: 0; left: 0; right: 0;
  padding: 1rem 1.2rem 1.2rem;
  background: linear-gradient(to top, rgba(13, 20, 16, 0.95) 60%, transparent);
  backdrop-filter: blur(8px);
}
.confirm-btn {
  width: 100%; max-width: 28rem; margin: 0 auto;
  display: block; padding: 1rem; border-radius: 999px;
  font-size: 1.05rem; letter-spacing: 0.1em;
  font-family: inherit; cursor: pointer; transition: all 0.25s;
  border: none;
}
.confirm-btn:not(.disabled) {
  background: rgba(201, 169, 110, 0.95);
  color: #1a120a; font-weight: 500;
}
.confirm-btn:not(.disabled):hover { background: #d4b87a; transform: translateY(-1px); }
.confirm-btn.disabled {
  background: rgba(245, 241, 230, 0.1);
  color: rgba(245, 241, 230, 0.35); cursor: not-allowed;
}

@media (max-width: 640px) {
  .select-topbar { padding: 1rem 1.1rem 0.8rem; }
  .select-content { padding: 0 0.9rem; }
  .tea-grid { grid-template-columns: 1fr; }
}
</style>
