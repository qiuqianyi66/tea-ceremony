<script setup lang="ts">
/**
 * 品鉴雷达图组件 - 基于 echarts（2026-10-27 由 chart.js/vue-chartjs 迁移，props 接口不变）
 *
 * 展示 8 维品鉴评分：
 * - 苦涩度、甜度、回甘、醇厚度、香气、汤感、身心、整体
 *
 * 支持对比：当前品鉴 vs 该茶历史均值 vs 标准参考
 */

import * as echarts from 'echarts/core'
import { RadarChart } from 'echarts/charts'
import { LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { colorTokens } from '@/styles/colorTokens'

echarts.use([RadarChart, LegendComponent, TooltipComponent, CanvasRenderer])

// Props
interface Props {
  /** 当前品鉴维度评分 */
  currentDimensions: Record<string, number>
  /** 历史均值（可选） */
  averageDimensions?: Record<string, number>
  /** 是否显示对比 */
  showComparison?: boolean
  /** 图表尺寸 */
  size?: number
}

const props = withDefaults(defineProps<Props>(), {
  currentDimensions: () => ({}),
  averageDimensions: () => ({}),
  showComparison: true,
  size: 280,
})

// 维度配置（色值全部走 DESIGN_SPEC 令牌常量，含暗色变体 teaGoldDark）
const DIMENSIONS = [
  { key: 'bitterness', label: '苦涩度', color: colorTokens.woodLight },
  { key: 'sweetness', label: '甜度', color: colorTokens.teaGold },
  { key: 'aftertaste', label: '回甘', color: colorTokens.bamboo },
  { key: 'body', label: '醇厚度', color: colorTokens.wood },
  { key: 'aroma', label: '香气', color: colorTokens.cinnabar },
  { key: 'rhyme', label: '汤感', color: colorTokens.indigoDeep },
  { key: 'shape', label: '身心', color: colorTokens.teaGoldDark },
  { key: 'mind', label: '整体', color: colorTokens.ink },
] as const

const currentData = computed(() => DIMENSIONS.map((d) => props.currentDimensions[d.key] ?? 0))

const averageData = computed(() => DIMENSIONS.map((d) => props.averageDimensions?.[d.key] ?? 0))

const chartOption = computed(() => {
  const seriesData: Array<{
    value: number[]
    name: string
    lineStyle?: { width?: number; type?: 'solid' | 'dashed' }
    areaStyle?: { color: string }
    itemStyle?: { color: string }
    symbol?: string
    symbolSize?: number
  }> = [
    {
      value: currentData.value,
      name: '本次品鉴',
      itemStyle: { color: '#C89B3C' },
      areaStyle: { color: 'rgba(200, 155, 60, 0.15)' },
      lineStyle: { width: 2.5 },
      symbol: 'circle',
      symbolSize: 3,
    },
  ]
  if (
    props.showComparison &&
    props.averageDimensions &&
    Object.keys(props.averageDimensions).length > 0
  ) {
    seriesData.push({
      value: averageData.value,
      name: '历史均值',
      itemStyle: { color: colorTokens.wood },
      areaStyle: { color: 'rgba(93, 78, 55, 0.1)' },
      lineStyle: { width: 2, type: 'dashed' },
      symbol: 'circle',
      symbolSize: 3,
    })
  }
  // 标准参考线：中性 3 分
  seriesData.push({
    value: DIMENSIONS.map(() => 3),
    name: '标准参考',
    itemStyle: { color: 'rgba(61, 50, 37, 0.35)' },
    lineStyle: { width: 1.5, type: 'dashed' },
    symbol: 'none',
  })
  return {
    radar: {
      indicator: DIMENSIONS.map((d) => ({ name: d.label, max: 5 })),
      radius: '66%',
      center: ['50%', '48%'],
      splitNumber: 5,
      axisName: {
        color: colorTokens.ink,
        fontFamily: 'Noto Serif SC, serif',
        fontSize: 11,
      },
      splitLine: { lineStyle: { color: 'rgba(61, 50, 37, 0.1)' } },
      axisLine: { lineStyle: { color: 'rgba(61, 50, 37, 0.15)' } },
      splitArea: { show: false },
    },
    legend: {
      show: props.showComparison,
      bottom: 0,
      icon: 'roundRect',
      itemWidth: 12,
      itemHeight: 4,
      itemGap: 16,
      textStyle: { color: colorTokens.ink, fontSize: 11, fontFamily: 'Noto Sans SC, sans-serif' },
    },
    tooltip: {
      backgroundColor: 'rgba(29, 28, 28, 0.9)',
      textStyle: { color: colorTokens.paper, fontSize: 11, fontFamily: 'Noto Sans SC, sans-serif' },
    },
    series: [{ type: 'radar' as const, data: seriesData, animationDuration: 800 }],
  }
})

const container = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null
let resizeObs: ResizeObserver | null = null

onMounted(() => {
  if (!container.value) return
  chart = echarts.init(container.value)
  chart.setOption(chartOption.value)
  resizeObs = new ResizeObserver(() => chart?.resize())
  resizeObs.observe(container.value)
})

watch(chartOption, (opt) => chart?.setOption(opt, true))

onUnmounted(() => {
  resizeObs?.disconnect()
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div class="taste-radar-chart" :style="{ width: size + 'px', height: size + 'px' }">
    <div ref="container" class="w-full h-full" />
  </div>
</template>

<style scoped>
.taste-radar-chart {
  position: relative;
}

/* 响应式尺寸 */
@media (max-width: 480px) {
  .taste-radar-chart {
    width: 100% !important;
    height: 240px !important;
  }
}
</style>
