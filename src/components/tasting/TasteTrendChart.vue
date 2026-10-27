<script setup lang="ts">
/**
 * 品鉴历史趋势图 - 基于 echarts（2026-10-27 由 chart.js/vue-chartjs 迁移，props 接口不变）
 * 展示：综合评分趋势、工艺系数趋势
 */

import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { colorTokens } from '@/styles/colorTokens'

echarts.use([LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

interface Props {
  /** 历史记录列表 */
  records: Array<{
    date: string
    overallScore: number
    processFactor: number
    teaName: string
    dimensions: Record<string, number>
  }>
  /** 图表高度 */
  height?: number
}

const props = withDefaults(defineProps<Props>(), {
  records: () => [],
  height: 200,
})

// 最近 20 条记录
const recentRecords = computed(() => [...props.records].reverse().slice(0, 20))

const labels = computed(() =>
  recentRecords.value.map((r) => {
    const d = new Date(r.date)
    return `${d.getMonth() + 1}/${d.getDate()}`
  }),
)

const scoresData = computed(() => recentRecords.value.map((r) => r.overallScore))

const processData = computed(
  () => recentRecords.value.map((r) => r.processFactor * 10), // 放大 10 倍便于同轴显示
)

const chartOption = computed(() => ({
  grid: { left: 28, right: 12, top: 30, bottom: 20 },
  legend: {
    top: 0,
    icon: 'roundRect',
    itemWidth: 12,
    itemHeight: 4,
    textStyle: { color: colorTokens.ink, fontSize: 10, fontFamily: 'Noto Sans SC, sans-serif' },
  },
  tooltip: {
    trigger: 'axis',
    backgroundColor: 'rgba(29, 28, 28, 0.9)',
    textStyle: { color: colorTokens.paper, fontSize: 11, fontFamily: 'Noto Sans SC, sans-serif' },
    valueFormatter: (value: number | string, callbackParams: unknown) => {
      // 工艺系数存的是 ×10 放大值，tooltip 还原
      const p = callbackParams as { seriesName?: string } | undefined
      if (p?.seriesName === '工艺系数') return `${(Number(value) / 10).toFixed(2)}`
      return `${Number(value).toFixed(1)}`
    },
  },
  xAxis: {
    type: 'category' as const,
    data: labels.value,
    axisLine: { lineStyle: { color: 'rgba(61, 50, 37, 0.2)' } },
    axisTick: { show: false },
    axisLabel: { color: '#8B7355', fontSize: 9, fontFamily: 'Noto Sans SC, sans-serif' },
  },
  yAxis: {
    type: 'value' as const,
    min: 0,
    max: 10,
    splitLine: { lineStyle: { color: 'rgba(61, 50, 37, 0.08)' } },
    axisLabel: {
      color: '#8B7355',
      fontSize: 9,
      fontFamily: 'Noto Sans SC, sans-serif',
      formatter: (value: number) => (value === 10 ? '1.0' : `0.${value}`),
    },
  },
  series: [
    {
      name: '综合评分',
      type: 'line' as const,
      data: scoresData.value,
      smooth: 0.35,
      symbol: 'circle',
      symbolSize: 5,
      lineStyle: { width: 2.5, color: '#C89B3C' },
      itemStyle: { color: '#C89B3C', borderColor: colorTokens.paper, borderWidth: 2 },
      areaStyle: { color: 'rgba(200, 155, 60, 0.12)' },
    },
    {
      name: '工艺系数',
      type: 'line' as const,
      data: processData.value,
      smooth: 0.35,
      symbol: 'circle',
      symbolSize: 5,
      lineStyle: { width: 2, type: 'dashed' as const, color: colorTokens.wood },
      itemStyle: { color: colorTokens.wood, borderColor: colorTokens.paper, borderWidth: 2 },
    },
  ],
  animationDuration: 600,
}))

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
  <div class="taste-trend-chart" :style="{ height: height + 'px' }">
    <div ref="container" class="w-full h-full" />
  </div>
</template>

<style scoped>
.taste-trend-chart {
  position: relative;
  width: 100%;
}

/* 空状态 */
.taste-trend-chart:empty::before {
  content: '暂无品鉴记录';
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #8b7355;
  font-size: 14px;
}
</style>
