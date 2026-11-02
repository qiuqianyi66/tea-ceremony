---
last_updated: 2026-11-02
status: active
owner: yanha
---

# ECharts 骨架

解决「图表组件忘记 dispose 导致内存泄漏、resize 不跟随窗口」的问题：一个组件内完成按需注册、初始化、resize 监听、卸载清理。

## 1. 完整示例

按需注册模块，用 `shallowRef` 存实例（图表实例不需要深层响应式）。

```vue
<script setup lang="ts">
/**
 * 茶类分布柱状图：按茶类展示品鉴次数。
 */
import type { ECharts, EChartsOption } from 'echarts'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { onMounted, onUnmounted, ref, shallowRef } from 'vue'

import { colorTokens } from '@/styles/colorTokens'

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

const props = withDefaults(
  defineProps<{
    categories?: readonly string[]
    counts?: readonly number[]
  }>(),
  {
    categories: () => ['绿茶', '白茶', '乌龙茶'],
    counts: () => [3, 1, 5],
  },
)

const chartEl = ref<HTMLDivElement | null>(null)
const chart = shallowRef<ECharts | null>(null)

function resize(): void {
  chart.value?.resize()
}

function buildOption(): EChartsOption {
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    grid: { left: 32, right: 16, top: 24, bottom: 32 },
    xAxis: {
      type: 'category',
      data: [...(props.categories ?? [])],
      axisLabel: { color: colorTokens.woodLight },
      axisLine: { lineStyle: { color: colorTokens.woodLight } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: colorTokens.woodLight },
      splitLine: { lineStyle: { color: colorTokens.paper } },
    },
    series: [
      {
        type: 'bar',
        data: [...(props.counts ?? [])],
        itemStyle: { color: colorTokens.teaGold },
        barMaxWidth: 32,
      },
    ],
  }
}

onMounted(() => {
  if (!chartEl.value) return
  const instance = echarts.init(chartEl.value)
  instance.setOption(buildOption())
  chart.value = instance
  window.addEventListener('resize', resize)
})

onUnmounted(() => {
  window.removeEventListener('resize', resize)
  chart.value?.dispose()
  chart.value = null
})
</script>

<template>
  <div ref="chartEl" class="h-64 w-full rounded-xl bg-[var(--color-paper)]" />
</template>
```

## 2. 数据变化时更新

用 `watch` 调 `setOption`，不重新 `init`。第二次 `init` 同一容器会得到空画布。

```ts
import { watch } from 'vue'

watch(
  () => props.counts,
  () => {
    chart.value?.setOption(buildOption())
  },
  { deep: true },
)
```

`setOption` 默认合并；需要整图替换时传 `{ notMerge: true }`。

## 3. 配色

图表拿不到 CSS 变量，色值走 `src/styles/colorTokens.ts`，与 `DESIGN_SPEC.md` 令牌同值。

| 场景 | 用法 |
|------|------|
| 浅色页面（茶室、成就） | `colorTokens.teaGold` / `colorTokens.wood` / `colorTokens.woodLight` |
| 深色茶席（冲泡、品鉴、茶灵） | `colorTokens.teaGoldDark` / `colorTokens.inkDark` / `colorTokens.woodLightDark` |

不要写 `#9E8050` 这类裸值；新增色先入 `DESIGN_SPEC.md` 再入 `colorTokens.ts`。

## 4. 易错点

- 容器必须有确定高度（`h-64` 或父级定高），否则初始化出 0×0 画布。
- 容器在 `v-if` 后面时，等条件为真后再初始化；`onMounted` 时 `chartEl` 为空直接 `return`。
- 卸载只 `removeEventListener` 不 `dispose` 会留下画布与事件；两者都要做。
- 窗口 resize 之外，容器自身尺寸变化（抽屉展开、分栏拖动）用 `ResizeObserver` 触发 `resize()`。
- 地图类图表要先 `echarts.registerMap('china', geo)` 再 `setOption`，参考 `src/views/MapView.vue`。
- 不引第二个图表库；项目已用 `echarts@6`，禁止重复引入 Chart.js 等。
