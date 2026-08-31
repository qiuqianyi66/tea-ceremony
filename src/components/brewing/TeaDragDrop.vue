<script setup lang="ts">
/**
 * 投茶拖拽组件 - 基于 vue-draggable-next (SortableJS)
 *
 * 用法：
 * - 选茶墙：可拖拽茶叶卡片
 * - 茶器区：接收拖拽，显示投茶动画、可调克数
 * - 拖拽结束时触发回调，更新 store 茶叶重量
 */

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import draggable from 'vuedraggable'
import type { Tea } from '@/types/tea'
import type { TeaWare } from '@/types/teaware'
import { useTeaStore } from '@/stores/tea'
import { playTeaDrop } from '@/composables/useAudio'

// 类型定义
interface TeaItem {
  id: string
  name: string
  category: string
  dryTeaColor: string
  recommendedWeight: number  // 建议投茶量
}

interface DraggedTeaData {
  tea: TeaItem
  source: 'wall' | 'vessel'
}

const store = useTeaStore()

// Props
interface Props {
  /** 可选茶叶列表（来自选茶页或茶叶数据） */
  availableTeas?: Tea[]
  /** 当前选中的茶器 */
  currentWare?: TeaWare | null
  /** 是否处于冲泡阶段（非 IDLE 时禁用拖拽） */
  disabled?: boolean
  /** 拖拽完成回调 */
  onTeaDropped?: (tea: TeaItem, weight: number) => void
}

const props = withDefaults(defineProps<Props>(), {
  availableTeas: () => [],
  currentWare: null,
  disabled: false,
  onTeaDropped: () => {},
})

// 内部状态
const draggedTea = ref<TeaItem | null>(null)
const dropZoneActive = ref(false)
const teaAmount = ref(3) // 当前投茶量
const isOverVessel = ref(false)

// 计算属性：茶墙数据
const teaWallItems = computed<TeaItem[]>(() => {
  return (props.availableTeas ?? []).map(tea => ({
    id: `tea-${tea.id}`,
    name: tea.name,
    category: tea.type,
    dryTeaColor: tea.dryTeaColor || '#4A7C59',
    recommendedWeight: Math.round((tea.bestTemp ? 3 : 3) * 1), // 简化：统一建议 3g
  }))
})

// 计算属性：茶器类型对应的图标
const wareIcon = computed(() => {
  if (!props.currentWare) return '🫖'
  const icons: Record<string, string> = {
    gaiwan: '🍵',
    yixing: '🫖',
    glass: '🥛',
    celadon: '🍶',
    duanning: '🫖',
    jianzhan: '☕',
  }
  return icons[props.currentWare.id] || '🫖'
})

// 计算属性：茶器匹配度
const wareMatchScore = computed(() => {
  if (!draggedTea.value || !props.currentWare) return 0
  return props.currentWare.recommended.includes(draggedTea.value.category) ? 1 : 0.5
})

// SortableJS 选项
const draggableOptions = {
  group: {
    name: 'tea-drag-drop',
    pull: 'clone',      // 从茶墙复制（克隆）
    put: true,          // 允许放入茶器区
  },
  sort: false,          // 茶墙不排序
  delay: 100,
  delayOnTouchOnly: true,
  animation: 300,
  ghostClass: 'tea-drag-ghost',
  chosenClass: 'tea-drag-chosen',
  dragClass: 'tea-drag-dragging',
  handle: '.tea-drag-handle',
  forceFallback: true,  // 移动端兼容
  fallbackTolerance: 3,
  onStart: (evt: any) => {
    const teaData = evt.item.dataset.tea ? JSON.parse(evt.item.dataset.tea) : null
    if (teaData) {
      draggedTea.value = teaData
      teaAmount.value = teaData.recommendedWeight
    }
    document.body.style.userSelect = 'none'
  },
  onEnd: () => {
    draggedTea.value = null
    dropZoneActive.value = false
    isOverVessel.value = false
    document.body.style.userSelect = ''
  },
  onAdd: (evt: any) => {
    // 放入茶器区时触发
    if (draggedTea.value) {
      playTeaDrop(0.8)
      props.onTeaDropped?.(draggedTea.value, teaAmount.value)
      store.setTeaWeight(teaAmount.value)
    }
    // 移除克隆节点（我们不需要在茶器区显示列表）
    if (evt.item.parentNode) {
      evt.item.parentNode.removeChild(evt.item)
    }
  },
  onRemove: () => {
    // 从茶墙移除时（克隆模式下不真正移除）
  },
}

// 茶器区放置选项
const vesselDropOptions = {
  group: {
    name: 'tea-drag-drop',
    pull: false,
    put: true,
  },
  sort: false,
  animation: 200,
  onDragOver: (evt: any) => {
    if (draggedTea.value) {
      dropZoneActive.value = true
      isOverVessel.value = true
    }
  },
  onDragLeave: () => {
    isOverVessel.value = false
    if (!dropZoneActive.value) dropZoneActive.value = false
  },
  onDrop: (evt: any) => {
    isOverVessel.value = false
    // onAdd 会处理实际逻辑
  },
}

// 调整克数
function adjustWeight(delta: number) {
  teaAmount.value = Math.max(1, Math.min(8, teaAmount.value + delta))
}

function setWeightDirect(value: number) {
  teaAmount.value = Math.max(1, Math.min(8, value))
}

// 键盘调整克数
function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    adjustWeight(0.5)
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    adjustWeight(-0.5)
  }
}

// 监听当前茶器变化
watch(() => props.currentWare, (newWare) => {
  if (newWare && draggedTea.value) {
    // 茶器变化时，可根据匹配度调整建议克数
    const baseWeight = draggedTea.value.recommendedWeight
    teaAmount.value = wareMatchScore.value === 1 ? baseWeight : Math.round(baseWeight * 0.8)
  }
})

// 清理
onUnmounted(() => {
  document.body.style.userSelect = ''
})
</script>

<template>
  <div class="tea-drag-drop" :class="{ 'tea-drag-disabled': disabled }">
    <!-- ======== 茶叶墙（源） ======== -->
    <div class="tea-wall-section mb-6">
      <h3 class="text-lg font-bold text-[var(--color-wood)] mb-3 flex items-center gap-2">
        <span class="text-xl">🍃</span>
        选择茶叶拖入茶器
      </h3>

      <draggable
        v-model="teaWallItems"
        :options="draggableOptions"
        :disabled="disabled"
        tag="div"
        class="tea-wall grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
        item-key="id"
        :clone="() => ({})"  // 克隆模式：拖拽时创建副本
      >
        <template #item="{ element }">
          <div
            class="tea-card group relative p-3 rounded-xl border-2 transition-all cursor-grab active:cursor-grabbing"
            :class="[
              'bg-[var(--color-paper)]',
              'hover:border-[var(--color-tea-gold)] hover:shadow-lg hover:scale-105',
              'hover:bg-[var(--color-cream)]',
            ]"
            :style="{ borderLeftColor: element.dryTeaColor }"
            :data-tea="JSON.stringify(element)"
          >
            <!-- 拖拽手柄 -->
            <div class="tea-drag-handle absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <svg class="w-5 h-5 text-[var(--color-wood-light)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16M4 12h16" />
              </svg>
            </div>

            <!-- 茶叶颜色指示 -->
            <div class="w-full h-16 mb-2 rounded-lg relative overflow-hidden"
              :style="{ backgroundColor: element.dryTeaColor }">
              <div class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </div>

            <p class="font-bold text-[var(--color-wood)] text-center truncate">{{ element.name }}</p>
            <p class="text-xs text-[var(--color-wood-light)] text-center capitalize">{{ element.category }}</p>
            <p class="text-[10px] text-[var(--color-tea-gold)] text-center mt-1">
              建议 {{ element.recommendedWeight }}g
            </p>
          </div>
        </template>
      </draggable>
    </div>

    <!-- ======== 茶器区（目标） ======== -->
    <div v-if="currentWare" class="tea-vessel-section relative">
      <h3 class="text-lg font-bold text-[var(--color-wood)] mb-3 flex items-center gap-2">
        <span class="text-xl">{{ wareIcon }}</span>
        投茶区
      </h3>

      <draggable
        v-model="[]"
        :options="vesselDropOptions"
        :disabled="disabled"
        tag="div"
        class="tea-vessel-dropzone relative"
        :class="[
          'min-h-[200px] rounded-2xl border-4 flex items-center justify-center',
          'transition-all duration-300',
          dropZoneActive
            ? (wareMatchScore === 1
                ? 'border-[var(--color-tea-gold)] bg-[var(--color-tea-gold)]/10 shadow-[0_0_30px_#C89B3C]'
                : 'border-[var(--color-tea-gold)]/50 bg-[var(--color-tea-gold)]/5')
            : 'border-dashed border-[var(--color-wood-light)] hover:border-[var(--color-tea-gold)]/50',
          isOverVessel && 'scale-[1.02]',
        ]"
      >
        <div class="vessel-content text-center p-6" :class="{ 'has-tea': draggedTea }">
          <!-- 茶器图标 -->
          <div class="vessel-icon text-6xl mb-4 transition-all duration-300"
            :class="{ 'animate-bounce': isOverVessel }">
            {{ wareIcon }}
          </div>

          <!-- 茶器名称 -->
          <p class="text-xl font-bold text-[var(--color-wood)] mb-1">{{ currentWare.name }}</p>
          <p class="text-sm text-[var(--color-wood-light)] mb-4">{{ currentWare.material }}</p>

          <!-- 当前拖拽的茶叶预览 -->
          <div v-if="draggedTea" class="dragged-tea-preview animate-fade-in mb-4">
            <div class="flex items-center justify-center gap-2 mb-2">
              <div class="w-10 h-10 rounded-lg relative"
                :style="{ backgroundColor: draggedTea.dryTeaColor }">
                <div class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-lg" />
              </div>
              <span class="text-[var(--color-wood)] font-medium">{{ draggedTea.name }}</span>
            </div>

            <!-- 克数调节器 -->
            <div class="weight-adjuster flex items-center justify-center gap-4">
              <button
                @click="adjustWeight(-0.5)"
                @keydown="handleKeyDown"
                class="w-10 h-10 rounded-full bg-[var(--color-wood)] text-[var(--color-cream)] text-xl font-bold hover:bg-[var(--color-wood-light)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-tea-gold)]"
                :disabled="teaAmount <= 1"
                aria-label="减少克数"
              >
                −
              </button>

              <div class="weight-display min-w-[80px] text-center">
                <span class="text-3xl font-bold text-[var(--color-wood)] tabular-nums">{{ teaAmount.toFixed(1) }}</span>
                <span class="text-sm text-[var(--color-wood-light)]">g</span>
              </div>

              <button
                @click="adjustWeight(0.5)"
                @keydown="handleKeyDown"
                class="w-10 h-10 rounded-full bg-[var(--color-wood)] text-[var(--color-cream)] text-xl font-bold hover:bg-[var(--color-wood-light)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-tea-gold)]"
                :disabled="teaAmount >= 8"
                aria-label="增加克数"
              >
                +
              </button>
            </div>

            <!-- 滑块微调 -->
            <input
              type="range"
              min="1"
              max="8"
              step="0.5"
              :value="teaAmount"
              @input="setWeightDirect(parseFloat(($event.target as HTMLInputElement).value))"
              class="w-full max-w-xs mt-2 h-2 bg-[var(--color-paper)] rounded-lg appearance-none cursor-pointer accent-[var(--color-tea-gold)]"
            />

            <!-- 匹配度提示 -->
            <p class="text-xs mt-2" :class="wareMatchScore === 1 ? 'text-[var(--color-tea-gold)]' : 'text-[var(--color-wood-light)]'">
              {{ wareMatchScore === 1 ? '✅ 完美搭配' : '⚠️ 可用但非最佳搭配' }}
            </p>
          </div>

          <!-- 空状态提示 -->
          <div v-else class="empty-hint text-[var(--color-wood-light)]">
            <p class="mb-2">将茶叶拖拽至此</p>
            <p class="text-xs opacity-60">支持从上方茶叶墙拖入</p>
          </div>
        </div>
      </draggable>

      <!-- 茶器加成信息 -->
      <div class="mt-4 p-3 bg-[var(--color-paper)] rounded-lg text-sm">
        <p class="font-bold text-[var(--color-wood)] mb-2">{{ currentWare.name }} 加成：</p>
        <div class="grid grid-cols-3 gap-2 text-center">
          <div>
            <p class="text-[var(--color-tea-gold)] font-bold">{{ (currentWare.bonus.speed * 100).toFixed(0) }}%</p>
            <p class="text-[10px] text-[var(--color-wood-light)]">出汤速度</p>
          </div>
          <div>
            <p class="text-[var(--color-tea-gold)] font-bold">{{ (currentWare.bonus.heatRetention * 100).toFixed(0) }}%</p>
            <p class="text-[10px] text-[var(--color-wood-light)]">保温性</p>
          </div>
          <div>
            <p class="text-[var(--color-tea-gold)] font-bold">{{ (currentWare.bonus.visual * 100).toFixed(0) }}%</p>
            <p class="text-[10px] text-[var(--color-wood-light)]">观赏性</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 无茶器时的提示 -->
    <div v-else class="no-ware-hint text-center p-6 bg-[var(--color-paper)] rounded-xl border border-dashed border-[var(--color-wood-light)]">
      <p class="text-4xl mb-2">🫖</p>
      <p class="text-[var(--color-wood)] font-bold mb-1">请先在上方选择茶器</p>
      <p class="text-sm text-[var(--color-wood-light)]">选择茶器后即可进行投茶操作</p>
    </div>
  </div>
</template>

<style scoped>
/* 进入/离场动画 */
.animate-fade-in {
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 拖拽时的幽灵元素样式 */
.tea-drag-ghost {
  opacity: 0.4;
  transform: rotate(3deg) scale(1.05);
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
}

.tea-drag-chosen {
  border-color: var(--color-tea-gold) !important;
  box-shadow: 0 0 20px rgba(200, 155, 60, 0.3);
}

.tea-drag-dragging {
  z-index: 9999 !important;
}

/* 禁用状态 */
.tea-drag-disabled .tea-card {
  cursor: not-allowed !important;
  opacity: 0.6;
}

.tea-drag-disabled .tea-vessel-dropzone {
  opacity: 0.5;
}

/* 焦点可见性 */
button:focus-visible {
  outline: 2px solid var(--color-tea-gold);
  outline-offset: 2px;
}

/* 输入范围样式 */
input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-tea-gold);
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
}

input[type="range"]::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-tea-gold);
  border: none;
  cursor: pointer;
}

/* 响应式 */
@media (max-width: 640px) {
  .tea-wall {
    grid-template-columns: repeat(2, 1fr);
  }

  .weight-adjuster {
    gap: 2;
  }

  .weight-adjuster button {
    width: 36px;
    height: 36px;
    font-size: 1.25rem;
  }
}
</style>
