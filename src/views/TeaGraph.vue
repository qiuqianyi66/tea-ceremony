<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { teas } from '@/data/teas'
import { getTeaMastersForTea } from '@/data/teaMasters'
import { TEA_REGIONS } from '@/data/teaRegions'
import { getProcessByTeaType } from '@/data/teaProcesses'
import type { Tea } from '@/types/tea'
import type { TeaRegion } from '@/data/teaRegions'

const router = useRouter()
const selectedTea = ref<Tea | null>(null)
const centerX = 250
const centerY = 200
const radius = 130

const nodes = computed(() => {
  if (!selectedTea.value) return []
  const t = selectedTea.value
  const result: Array<{ id: string; label: string; type: string; x: number; y: number }> = [
    { id: 'tea', label: t.name, type: 'tea', x: centerX, y: centerY },
  ]
  const angleStep = (Math.PI * 2) / 6
  let i = 0

  // 茶类
  result.push({ id: 'type', label: t.type, type: 'category', x: centerX + radius * Math.cos(angleStep * i), y: centerY + radius * Math.sin(angleStep * i++) })

  // 产区
  const region = getRegionByTea(t)
  if (region) result.push({ id: 'region', label: region.name, type: 'region', x: centerX + radius * Math.cos(angleStep * i), y: centerY + radius * Math.sin(angleStep * i++) })
  else i++

  // 工艺
  const process = getProcessByTeaType(t.type)
  if (process) result.push({ id: 'process', label: process.name.replace('制作工艺', ''), type: 'process', x: centerX + radius * Math.cos(angleStep * i), y: centerY + radius * Math.sin(angleStep * i++) })
  else i++

  // 茶人
  const masters = getTeaMastersForTea(t.id)
  if (masters.length > 0) result.push({ id: 'master', label: masters[0]!.name, type: 'person', x: centerX + radius * Math.cos(angleStep * i), y: centerY + radius * Math.sin(angleStep * i++) })
  else i++

  // 茶器
  result.push({ id: 'ware', label: getTeaWare(t), type: 'ware', x: centerX + radius * Math.cos(angleStep * i), y: centerY + radius * Math.sin(angleStep * i++) })

  return result
})

const edges = computed(() => {
  if (nodes.value.length < 2) return []
  return nodes.value.slice(1).map(n => ({
    source: 'tea', target: n.id,
  }))
})

function getRegionByTea(t: Tea): TeaRegion | undefined {
  for (const r of TEA_REGIONS) {
    if (r.famousFor?.includes(t.name)) return r
  }
  return undefined
}

function getTeaWare(t: Tea): string {
  if (t.type === '绿茶' || t.type === '白茶') return '盖碗'
  if (t.type === '黑茶' || t.type === '红茶') return '紫砂壶'
  return '盖碗'
}

function selectTea(tea: Tea) {
  selectedTea.value = tea
}
</script>

<template>
  <div class="min-h-screen p-4 sm:p-8">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-3xl font-bold text-[var(--color-wood)]">🔗 茶文化图谱</h2>
      <button @click="router.push('/')" class="text-[var(--color-wood-light)] hover:text-[var(--color-wood)]">返回</button>
    </div>

    <!-- 选茶 -->
    <div class="mb-6">
      <p class="text-sm text-[var(--color-wood)] mb-2">选择一款茶，查看它的文化关系网络：</p>
      <select @change="(e) => { const found = teas.find(t => t.name === (e.target as HTMLSelectElement).value); if (found) selectTea(found) }"
        class="w-full max-w-md px-4 py-2 rounded-lg bg-white border border-[var(--color-paper)] text-[var(--color-ink)]">
        <option value="">-- 请选择 --</option>
        <option v-for="t in teas" :key="t.id" :value="t.name">{{ t.name }}</option>
      </select>
    </div>

    <!-- 图谱 -->
    <div v-if="selectedTea" class="glass-panel rounded-2xl p-4 mb-6">
      <svg :viewBox="`0 0 500 400`" class="w-full h-auto">
        <!-- 连线 -->
        <line v-for="e in edges" :key="`${e.source}-${e.target}`"
          :x1="centerX" :y1="centerY"
          :x2="nodes.find(n => n.id === e.target)?.x ?? 0"
          :y2="nodes.find(n => n.id === e.target)?.y ?? 0"
          stroke="var(--color-tea-gold)" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.4"/>

        <!-- 节点 -->
        <g v-for="node in nodes" :key="node.id">
          <circle :cx="node.x" :cy="node.y" :r="node.id === 'tea' ? 28 : 20"
            :fill="node.id === 'tea' ? 'var(--color-tea-gold)' : 'var(--color-paper)'"
            :stroke="node.id === 'tea' ? 'var(--color-wood)' : 'var(--color-tea-gold)'"
            stroke-width="2"/>
          <text :x="node.x" :y="node.y + 4" text-anchor="middle"
            :fill="node.id === 'tea' ? 'white' : 'var(--color-wood)'"
            :font-size="node.id === 'tea' ? 10 : 8" font-weight="bold">
            {{ node.label.length > 6 ? node.label.slice(0, 6) + '…' : node.label }}
          </text>
          <text :x="node.x" :y="node.y + (node.id === 'tea' ? 42 : 34)" text-anchor="middle"
            fill="var(--color-wood-light)" font-size="8">
            {{ { tea: '茶叶', category: '茶类', region: '产区', process: '工艺', person: '茶人', ware: '茶器' }[node.type] || '' }}
          </text>
        </g>
      </svg>

      <!-- 图例 -->
      <div class="flex flex-wrap gap-2 mt-2 justify-center text-xs text-[var(--color-wood-light)]">
        <span>● 茶叶</span>
        <span>● 茶类</span>
        <span>● 产区</span>
        <span>● 工艺</span>
        <span>● 茶人</span>
        <span>● 茶器</span>
      </div>
    </div>

    <!-- 关联详情 -->
    <div v-if="selectedTea" class="glass-panel rounded-xl p-4">
      <h3 class="text-base font-bold text-[var(--color-wood)] mb-3">📖 文化关联</h3>
      <div class="space-y-2 text-sm">
        <div class="flex justify-between py-1 border-b border-[var(--color-paper)]">
          <span class="text-[var(--color-wood-light)]">茶类</span>
          <span class="text-[var(--color-wood)] font-bold">{{ selectedTea.type }}</span>
        </div>
        <div class="flex justify-between py-1 border-b border-[var(--color-paper)]">
          <span class="text-[var(--color-wood-light)]">产区</span>
          <span class="text-[var(--color-wood)]">{{ getRegionByTea(selectedTea)?.name || selectedTea.origin || '—' }}</span>
        </div>
        <div class="flex justify-between py-1 border-b border-[var(--color-paper)]">
          <span class="text-[var(--color-wood-light)]">工艺</span>
          <span class="text-[var(--color-wood)]">{{ getProcessByTeaType(selectedTea.type)?.name || '—' }}</span>
        </div>
        <div class="flex justify-between py-1 border-b border-[var(--color-paper)]">
          <span class="text-[var(--color-wood-light)]">推荐茶器</span>
          <span class="text-[var(--color-wood)]">{{ getTeaWare(selectedTea) }}</span>
        </div>
        <div class="py-1">
          <span class="text-[var(--color-wood-light)]">相关茶人</span>
          <div class="mt-1 flex flex-wrap gap-1">
            <span v-for="m in getTeaMastersForTea(selectedTea.id)" :key="m.id"
              class="px-2 py-0.5 text-xs bg-[var(--color-paper)] text-[var(--color-wood)] rounded">
              {{ m.name }}（{{ m.dynasty }}）
            </span>
            <span v-if="getTeaMastersForTea(selectedTea.id).length === 0" class="text-xs text-[var(--color-wood-light)]">暂无数据</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
