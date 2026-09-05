<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, shallowRef } from 'vue'
import * as echarts from 'echarts'
import chinaMap from '@/data/china-map.json'
import { teaRegions, getTeaRegion, type TeaRegion } from '@/data/tea-regions'
import { TEA_REGIONS, type TeaRegion as MountainRegion } from '@/data/teaRegions'

// ==================== ECharts 地图 ====================
const mapContainer = ref<HTMLDivElement | null>(null)
const chartInstance = shallowRef<echarts.ECharts | null>(null)

// 四大茶区配色（夜色暖光风格）
const zoneColors: Record<string, string> = {
  '华南茶区': '#c97b4a',
  '西南茶区': '#8b6b4a',
  '江南茶区': '#a0826d',
  '江北茶区': '#6b5d4f',
}

// 省份简称 → 全称映射（茶山数据用简称，GeoJSON 用全称）
const provinceFullName: Record<string, string> = {
  '浙江': '浙江省', '江苏': '江苏省', '安徽': '安徽省', '福建': '福建省',
  '广东': '广东省', '云南': '云南省', '湖南': '湖南省', '湖北': '湖北省',
  '四川': '四川省', '贵州': '贵州省', '广西': '广西壮族自治区', '江西': '江西省',
  '河南': '河南省', '山东': '山东省', '陕西': '陕西省', '海南': '海南省',
  '台湾': '台湾省', '甘肃': '甘肃省', '西藏': '西藏自治区', '重庆': '重庆市',
  '上海': '上海市', '北京': '北京市', '天津': '天津市', '辽宁': '辽宁省',
  '吉林': '吉林省', '黑龙江': '黑龙江省', '河北': '河北省', '山西': '山西省',
  '内蒙古': '内蒙古自治区', '宁夏': '宁夏回族自治区', '青海': '青海省',
  '新疆': '新疆维吾尔自治区', '香港': '香港特别行政区', '澳门': '澳门特别行政区',
}

// 选中的省份（全称）
const selectedProvince = ref<string | null>(null)
// 选中的省级茶产区数据
const selectedRegion = computed<TeaRegion | undefined>(() =>
  selectedProvince.value ? getTeaRegion(selectedProvince.value) : undefined,
)
// 选中省份的茶山产区列表
const selectedMountains = computed<MountainRegion[]>(() => {
  if (!selectedProvince.value) return []
  // 从全称反查简称
  const shortName = Object.entries(provinceFullName)
    .find(([, full]) => full === selectedProvince.value)?.[0]
  if (!shortName) return []
  return TEA_REGIONS.filter((r) => r.province === shortName)
})

// 地图数据：各省按茶区着色
const mapData = computed(() =>
  teaRegions.map((r) => ({
    name: r.province,
    value: r.famousTeas.length,
    itemStyle: {
      areaColor: zoneColors[r.zone] || '#5a4d42',
    },
  })),
)

function initChart(): void {
  if (!mapContainer.value) return
  echarts.registerMap('china', chinaMap as never)
  const chart = echarts.init(mapContainer.value)
  chartInstance.value = chart

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(26, 18, 12, 0.92)',
      borderColor: '#c9a96e',
      borderWidth: 1,
      textStyle: { color: '#f5e6c8', fontSize: 13 },
      formatter: (params: unknown) => {
        const p = params as { name: string; data?: { value?: number } }
        const region = getTeaRegion(p.name)
        if (!region) {
          return `<div style="font-weight:bold;margin-bottom:4px">${p.name}</div>
            <div style="opacity:0.7;font-size:12px">非主要产茶区</div>`
        }
        const teaNames = region.famousTeas.map((t) => t.name).join('、')
        return `<div style="font-weight:bold;margin-bottom:4px;color:#e8c87a">${p.name}</div>
          <div style="margin-bottom:4px;color:#c9a96e;font-size:12px">${region.zone}</div>
          <div style="margin-bottom:4px;font-size:12px">代表名茶：${teaNames}</div>
          <div style="opacity:0.7;font-size:11px">${region.climate.slice(0, 30)}…</div>`
      },
    },
    series: [
      {
        name: '中国茶产区',
        type: 'map',
        map: 'china',
        roam: true,
        zoom: 1.2,
        center: [105, 36],
        scaleLimit: { min: 0.8, max: 5 },
        label: {
          show: false,
        },
        emphasis: {
          label: { show: true, color: '#fff', fontSize: 12 },
          itemStyle: {
            areaColor: '#d4a054',
            shadowBlur: 20,
            shadowColor: 'rgba(212, 160, 84, 0.5)',
          },
        },
        select: {
          label: { show: true, color: '#fff' },
          itemStyle: {
            areaColor: '#e8b860',
            borderColor: '#f5d890',
            borderWidth: 2,
          },
        },
        selectedMode: 'single',
        data: mapData.value,
      },
    ],
  }

  chart.setOption(option)

  // 点击省份选中
  chart.on('click', (params: unknown) => {
    const p = params as { name: string }
    if (getTeaRegion(p.name)) {
      selectedProvince.value = selectedProvince.value === p.name ? null : p.name
    }
  })

  // 响应式
  window.addEventListener('resize', handleResize)
}

function handleResize(): void {
  chartInstance.value?.resize()
}

onMounted(() => {
  // 延迟初始化，确保容器已渲染
  setTimeout(initChart, 100)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chartInstance.value?.dispose()
})

// 茶类配色
const categoryColors: Record<string, string> = {
  '绿茶': '#7ba05b',
  '白茶': '#d4c5a0',
  '黄茶': '#c9a96e',
  '乌龙茶': '#b87333',
  '红茶': '#8b3a3a',
  '黑茶': '#3d2b1f',
  '再加工茶': '#6b8e9e',
}
</script>

<template>
  <div class="min-h-screen p-4 sm:p-8">
    <!-- 标题 -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-3xl font-bold text-[var(--color-wood)]">🗺️ 中国茶产区地图</h2>
        <p class="text-sm text-[var(--color-wood-light)] mt-1">点击省份查看名茶与茶文化 · 四大茶区 {{ teaRegions.length }} 个产茶省份</p>
      </div>
      <button @click="$router.push('/')" class="text-[var(--color-wood-light)] hover:text-[var(--color-wood)] text-sm">返回首页</button>
    </div>

    <!-- 四大茶区图例 -->
    <div class="flex flex-wrap gap-3 mb-6">
      <div v-for="(color, zone) in zoneColors" :key="zone"
        class="flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel text-xs">
        <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: color }"></span>
        <span class="text-[var(--color-wood)] font-medium">{{ zone }}</span>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- 地图区域 -->
      <div class="lg:col-span-2">
        <div class="glass-panel rounded-2xl p-4 h-[500px] relative overflow-hidden">
          <div ref="mapContainer" class="w-full h-full"></div>
          <div v-if="!selectedProvince" class="absolute bottom-4 left-4 text-xs text-[var(--color-wood-light)] opacity-60">
            提示：点击产茶省份查看详情 · 滚轮缩放 · 拖拽平移
          </div>
        </div>
      </div>

      <!-- 省份详情 -->
      <div class="lg:col-span-1">
        <div v-if="selectedRegion" class="glass-panel rounded-2xl p-5 h-[500px] overflow-y-auto">
          <div class="flex items-start justify-between mb-3">
            <div>
              <h3 class="text-xl font-bold text-[var(--color-wood)]">{{ selectedRegion.province }}</h3>
              <span class="text-xs px-2 py-0.5 rounded-full mt-1 inline-block"
                :style="{ backgroundColor: zoneColors[selectedRegion.zone] + '30', color: zoneColors[selectedRegion.zone] }">
                {{ selectedRegion.zone }}
              </span>
            </div>
            <button @click="selectedProvince = null" class="text-[var(--color-wood-light)] hover:text-[var(--color-wood)]" aria-label="关闭省份详情">✕</button>
          </div>

          <!-- 气候 -->
          <div class="mb-4">
            <p class="text-xs text-[var(--color-wood-light)] mb-1">🌡️ 气候地理</p>
            <p class="text-sm text-[var(--color-wood)] leading-relaxed">{{ selectedRegion.climate }}</p>
          </div>

          <!-- 名茶列表 -->
          <div class="mb-4">
            <p class="text-xs text-[var(--color-wood-light)] mb-2">🍵 代表名茶（{{ selectedRegion.famousTeas.length }}）</p>
            <div class="space-y-2">
              <div v-for="tea in selectedRegion.famousTeas" :key="tea.name"
                class="bg-[var(--color-paper)] rounded-lg p-3">
                <div class="flex items-center justify-between mb-1">
                  <span class="font-bold text-sm text-[var(--color-wood)]">{{ tea.name }}</span>
                  <span class="text-[10px] px-2 py-0.5 rounded-full text-white"
                    :style="{ backgroundColor: categoryColors[tea.category] || '#888' }">
                    {{ tea.category }}
                  </span>
                </div>
                <p class="text-[11px] text-[var(--color-wood-light)] mb-1">📍 {{ tea.origin }}</p>
                <p class="text-xs text-[var(--color-wood)]/80 leading-relaxed">{{ tea.description }}</p>
              </div>
            </div>
          </div>

          <!-- 茶文化 -->
          <div>
            <p class="text-xs text-[var(--color-wood-light)] mb-1">📜 茶文化</p>
            <p class="text-sm text-[var(--color-wood)] leading-relaxed">{{ selectedRegion.culture }}</p>
          </div>
        </div>

        <!-- 未选中时的引导 -->
        <div v-else class="glass-panel rounded-2xl p-5 h-[500px] flex flex-col items-center justify-center text-center">
          <div class="text-5xl mb-4 opacity-30">🍃</div>
          <p class="text-[var(--color-wood)] font-medium mb-2">点击地图上的产茶省份</p>
          <p class="text-xs text-[var(--color-wood-light)] opacity-70 max-w-[200px]">
            查看该省的代表名茶、茶类、产地、冲泡工艺和茶文化历史
          </p>
        </div>
      </div>
    </div>

    <!-- 茶山产区列表（选中省份时显示） -->
    <div v-if="selectedMountains.length > 0" class="mt-8">
      <h3 class="text-lg font-bold text-[var(--color-wood)] mb-4">
        ⛰️ {{ selectedProvince }} 核心茶山产区（{{ selectedMountains.length }}）
      </h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="m in selectedMountains" :key="m.id"
          class="glass-panel rounded-xl p-4 hover:shadow-md transition-all">
          <div class="flex items-start justify-between mb-2">
            <div>
              <h4 class="font-bold text-[var(--color-wood)]">{{ m.name }}</h4>
              <p class="text-xs text-[var(--color-wood-light)]">{{ m.area }} · {{ m.altitude }}</p>
            </div>
          </div>
          <p class="text-xs text-[var(--color-wood)]/70 mb-2 leading-relaxed">{{ m.description }}</p>
          <div class="flex flex-wrap gap-1">
            <span v-for="tea in m.famousFor" :key="tea"
              class="text-[10px] px-2 py-0.5 bg-[var(--color-tea-gold)]/20 text-[var(--color-tea-gold)] rounded-full">
              {{ tea }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 全部茶山产区（未选中时显示） -->
    <div v-else class="mt-8">
      <h3 class="text-lg font-bold text-[var(--color-wood)] mb-4">
        ⛰️ 全国核心茶山产区（{{ TEA_REGIONS.length }}）
      </h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div v-for="m in TEA_REGIONS" :key="m.id"
          @click="selectedProvince = provinceFullName[m.province] || null"
          class="glass-panel rounded-xl p-4 cursor-pointer hover:shadow-md hover:border-[var(--color-tea-gold)] transition-all">
          <div class="flex items-start justify-between mb-2">
            <div>
              <h4 class="font-bold text-sm text-[var(--color-wood)]">{{ m.name }}</h4>
              <p class="text-[11px] text-[var(--color-wood-light)]">{{ m.province }} · {{ m.altitude }}</p>
            </div>
          </div>
          <p class="text-xs text-[var(--color-wood)]/70 mb-2 line-clamp-2">{{ m.description }}</p>
          <div class="flex flex-wrap gap-1">
            <span v-for="tea in m.famousFor" :key="tea"
              class="text-[10px] px-2 py-0.5 bg-[var(--color-paper)] text-[var(--color-wood)] rounded-full">
              {{ tea }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
