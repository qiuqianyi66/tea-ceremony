<script setup lang="ts">
/**
 * 品鉴历史趋势图 - 基于 Chart.js
 * 展示：综合评分趋势、工艺系数趋势、各维度雷达图小图
 */

import { computed } from 'vue'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'vue-chartjs'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
)

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

// 计算属性：最近 20 条记录
const recentRecords = computed(() =>
  [...props.records].reverse().slice(0, 20)
)

const labels = computed(() =>
  recentRecords.value.map(r => {
    const d = new Date(r.date)
    return `${d.getMonth() + 1}/${d.getDate()}`
  })
)

const scoresData = computed(() =>
  recentRecords.value.map(r => r.overallScore)
)

const processData = computed(() =>
  recentRecords.value.map(r => r.processFactor * 10) // 放大 10 倍便于同轴显示
)

// 配置
const lineOptions = computed<any>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index' as const,
    intersect: false,
  },
  plugins: {
    legend: {
      display: true,
      position: 'top' as const,
      labels: {
        usePointStyle: true,
        padding: 12,
        font: { size: 10, family: 'Noto Sans SC, sans-serif' },
        color: '#3D3225',
      },
    },
    tooltip: {
      backgroundColor: 'rgba(29, 28, 28, 0.9)',
      titleFont: { size: 11, family: 'Noto Sans SC, sans-serif' },
      bodyFont: { size: 10, family: 'Noto Sans SC, sans-serif' },
      padding: 10,
      cornerRadius: 8,
      callbacks: {
        label: (context: any) => {
          if (context.dataset.label === '工艺系数') {
            return `${context.dataset.label}: ${(context.parsed.y / 10).toFixed(2)}`
          }
          return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}`
        },
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: {
        font: { size: 9, family: 'Noto Sans SC, sans-serif' },
        color: '#8B7355',
        maxRotation: 0,
        autoSkip: true,
        maxTicksLimit: 8,
      },
    },
    y: {
      min: 0,
      max: 10,
      grid: {
        color: 'rgba(61, 50, 37, 0.08)',
        drawBorder: false,
      },
      ticks: {
        stepSize: 1,
        font: { size: 9, family: 'Noto Sans SC, sans-serif' },
        color: '#8B7355',
        callback: (value: number) => value === 10 ? '1.0' : `0.${value}`,
      },
    },
  },
  elements: {
    line: {
      tension: 0.35,
      borderWidth: 2.5,
      borderCapStyle: 'round' as const,
    },
    point: {
      radius: 3,
      hoverRadius: 6,
      hoverBorderWidth: 3,
      borderWidth: 2,
    },
  },
  animation: {
    duration: 600,
    easing: 'easeOutQuart' as const,
  },
}))

const lineData = computed(() => ({
  labels: labels.value,
  datasets: [
    {
      label: '综合评分',
      data: scoresData.value,
      backgroundColor: 'rgba(200, 155, 60, 0.12)',
      borderColor: '#C89B3C',
      pointBackgroundColor: '#C89B3C',
      pointBorderColor: '#F5F0E8',
      fill: true,
      yAxisID: 'y',
    },
    {
      label: '工艺系数',
      data: processData.value,
      backgroundColor: 'rgba(93, 78, 55, 0.08)',
      borderColor: '#5D4E37',
      borderDash: [6, 4],
      pointBackgroundColor: '#5D4E37',
      pointBorderColor: '#F5F0E8',
      fill: false,
      yAxisID: 'y',
    },
  ],
}))

</script>

<template>
  <div class="taste-trend-chart" :style="{ height: height + 'px' }">
    <Line
      :data="lineData"
      :options="lineOptions"
      class="w-full h-full"
    />
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
  color: #8B7355;
  font-size: 14px;
}
</style>
