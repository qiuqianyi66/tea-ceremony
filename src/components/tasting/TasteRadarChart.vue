<script setup lang="ts">
/**
 * 品鉴雷达图组件 - 基于 Chart.js + vue-chartjs
 *
 * 展示 8 维品鉴评分：
 * - 苦涩度、甜度、回甘、醇厚度、香气、汤感、身心、整体
 *
 * 支持对比：当前品鉴 vs 该茶历史均值 vs 标准参考
 */

import { computed } from 'vue'
import {
  Chart as ChartJS,
  CategoryScale,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import { Radar } from 'vue-chartjs'

// 注册 Chart.js 组件
ChartJS.register(
  CategoryScale,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
)

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

// 维度配置（按 DESIGN_SPEC.md 顺序）
const DIMENSIONS = [
  { key: 'bitterness', label: '苦涩度', color: '#8B7355' },
  { key: 'sweetness', label: '甜度', color: '#C89B3C' },
  { key: 'aftertaste', label: '回甘', color: '#6B7D5A' },
  { key: 'body', label: '醇厚度', color: '#5D4E37' },
  { key: 'aroma', label: '香气', color: '#A33B2E' },
  { key: 'rhyme', label: '汤感', color: '#36454F' },
  { key: 'shape', label: '身心', color: '#C9A96E' },
  { key: 'mind', label: '整体', color: '#1C1C1C' },
] as const

// 计算标签和数据
const labels = computed(() => DIMENSIONS.map(d => d.label))

const currentData = computed(() =>
  DIMENSIONS.map(d => props.currentDimensions[d.key] ?? 0)
)

const averageData = computed(() =>
  DIMENSIONS.map(d => props.averageDimensions?.[d.key] ?? 0)
)

const referenceData = computed(() =>
  DIMENSIONS.map(() => 3) // 标准参考线：中性 3 分
)

// Chart.js 配置
const chartOptions = computed<any>(() => ({
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      display: props.showComparison,
      position: 'bottom' as const,
      labels: {
        usePointStyle: true,
        padding: 16,
        font: { size: 11, family: 'Noto Sans SC, sans-serif' },
        color: '#3D3225',
      },
    },
    tooltip: {
      backgroundColor: 'rgba(29, 28, 28, 0.9)',
      titleFont: { size: 12, family: 'Noto Sans SC, sans-serif' },
      bodyFont: { size: 11, family: 'Noto Sans SC, sans-serif' },
      padding: 12,
      cornerRadius: 8,
      callbacks: {
        label: (context: any) => {
          const value = context.parsed.r
          const dimension = DIMENSIONS[context.dataIndex]
          return `${context.dataset.label}: ${value.toFixed(1)} / 5`
        },
      },
    },
  },
  scales: {
    r: {
      min: 0,
      max: 5,
      ticks: {
        stepSize: 1,
        display: false,
        backdropColor: 'transparent',
      },
      grid: {
        color: 'rgba(61, 50, 37, 0.1)',
        circular: true,
      },
      angleLines: {
        color: 'rgba(61, 50, 37, 0.15)',
      },
      pointLabels: {
        font: { size: 11, family: 'Noto Serif SC, serif', weight: '500' },
        color: '#3D3225',
        padding: 12,
      },
    },
  },
  elements: {
    line: {
      tension: 0.3,
      borderWidth: 2.5,
      borderCapStyle: 'round' as const,
    },
    point: {
      radius: 0,
      hoverRadius: 6,
      hoverBorderWidth: 3,
    },
  },
  animation: {
    duration: 800,
    easing: 'easeOutQuart' as const,
  },
}))

const chartData = computed(() => {
  const datasets: any[] = [
    {
      label: '本次品鉴',
      data: currentData.value,
      backgroundColor: 'rgba(200, 155, 60, 0.15)',
      borderColor: '#C89B3C',
      pointBackgroundColor: '#C89B3C',
      pointBorderColor: '#F5F0E8',
      pointHoverBackgroundColor: '#C89B3C',
      pointHoverBorderColor: '#F5F0E8',
    },
  ]

  if (props.showComparison && props.averageDimensions && Object.keys(props.averageDimensions).length > 0) {
    datasets.push({
      label: '历史均值',
      data: averageData.value,
      backgroundColor: 'rgba(93, 78, 55, 0.1)',
      borderColor: '#5D4E37',
      borderDash: [6, 4],
      pointBackgroundColor: '#5D4E37',
      pointBorderColor: '#F5F0E8',
      pointHoverBackgroundColor: '#5D4E37',
      pointHoverBorderColor: '#F5F0E8',
    })
  }

  // 标准参考线
  datasets.push({
    label: '标准参考',
    data: referenceData.value,
    backgroundColor: 'transparent',
    borderColor: 'rgba(61, 50, 37, 0.2)',
    borderDash: [3, 6],
    borderWidth: 1.5,
    pointRadius: 0,
    pointHoverRadius: 0,
    fill: false,
  })

  return {
    labels: labels.value,
    datasets,
  }
})

</script>

<template>
  <div class="taste-radar-chart" :style="{ width: size + 'px', height: size + 'px' }">
    <Radar
      :data="chartData"
      :options="chartOptions"
      class="w-full h-full"
    />
  </div>
</template>

<style scoped>
.taste-radar-chart {
  position: relative;
}

/* 图表容器样式 */
:deep(.chartjs-radar) {
  /* 自定义样式由 Chart.js options 控制 */
}

/* 响应式尺寸 */
@media (max-width: 480px) {
  .taste-radar-chart {
    width: 100% !important;
    height: 240px !important;
  }
}
</style>
