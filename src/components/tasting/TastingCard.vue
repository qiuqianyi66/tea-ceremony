<script setup lang="ts">
import { ref } from 'vue'
import QRCode from 'qrcode'
import type { TastingRecord } from '@/types/tasting'
import { getScoreLevel } from '@/services/scoring'
import { toShareData, encodeShareData, buildShareUrl } from '@/services/share'

const props = defineProps<{
  record: TastingRecord
  /** 只读模式（分享页）：隐藏下载 / 分享 / 二维码按钮 */
  standalone?: boolean
}>()
const emit = defineEmits<{ shared: [] }>()

const scoreLevel = getScoreLevel(props.record.overallScore)

const dimensions = [
  ['苦', 'bitterness'], ['甜', 'sweetness'], ['甘', 'aftertaste'], ['醇', 'body'],
  ['香', 'aroma'], ['韵', 'rhyme'], ['形', 'shape'], ['心', 'mind'],
] as const

// ---------- 分享链接与二维码 ----------
const shareOpen = ref(false)
const shareUrl = ref('')
const qrDataUrl = ref('')
const copied = ref(false)

/** 生成分享 URL 与二维码并展开面板（首次生成后复用）。 */
async function toggleSharePanel() {
  if (shareOpen.value) {
    shareOpen.value = false
    return
  }
  if (!shareUrl.value) {
    shareUrl.value = buildShareUrl(encodeShareData(toShareData(props.record)))
    qrDataUrl.value = await QRCode.toDataURL(shareUrl.value, {
      width: 240,
      margin: 1,
      errorCorrectionLevel: 'M',
    })
  }
  shareOpen.value = true
}

async function copyShareUrl() {
  if (!shareUrl.value) return
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    // 无剪贴板权限时静默，二维码仍可扫码
  }
}

async function shareCard() {
  const text = [
    `我在「一盏茶」完成了 ${props.record.teaName} 的品鉴`,
    `综合评分：${props.record.overallScore} · 冲泡：${props.record.brewTemp}°C / ${props.record.brewTime}s`,
    `口感：${dimensions.map(([label, key]) => `${label}${props.record.dimensions[key]}`).join(' ')}`,
  ].join('\n')

  try {
    if (navigator.share) {
      await navigator.share({ title: `${props.record.teaName} · 品鉴卡`, text })
    } else {
      await navigator.clipboard.writeText(text)
    }
    emit('shared')
  } catch {
    // 用户取消系统分享时不显示错误。
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
}

async function downloadCard() {
  const canvas = document.createElement('canvas')
  canvas.width = 900
  canvas.height = 1120
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const background = ctx.createLinearGradient(0, 0, 900, 1120)
  background.addColorStop(0, '#FAF6F0')
  background.addColorStop(1, '#EDE1CF')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.strokeStyle = '#9E8050'
  ctx.lineWidth = 3
  roundRect(ctx, 34, 34, 832, 1052, 24)
  ctx.stroke()

  ctx.fillStyle = '#9E8050'
  ctx.font = '24px sans-serif'
  ctx.letterSpacing = '6px'
  ctx.fillText('一盏茶  ·  TASTING NOTE', 78, 100)
  ctx.letterSpacing = '0px'

  ctx.fillStyle = '#5D4E37'
  ctx.font = 'bold 52px serif'
  ctx.fillText(props.record.teaName, 78, 180)
  ctx.fillStyle = '#8B7355'
  ctx.font = '24px sans-serif'
  ctx.fillText(`${new Date(props.record.date).toLocaleDateString()}  ·  第 ${props.record.infusions} 泡`, 80, 225)

  ctx.fillStyle = scoreLevel.color
  ctx.font = 'bold 100px sans-serif'
  ctx.fillText(String(props.record.overallScore), 660, 180)
  ctx.fillStyle = '#8B7355'
  ctx.font = '24px sans-serif'
  ctx.fillText(scoreLevel.text, 708, 225)

  dimensions.forEach(([label, key], index) => {
    const column = index % 4
    const row = Math.floor(index / 4)
    const x = 78 + column * 190
    const y = 315 + row * 150
    ctx.fillStyle = 'rgba(255,255,255,.65)'
    roundRect(ctx, x, y, 155, 110, 14)
    ctx.fill()
    ctx.fillStyle = '#8B7355'
    ctx.font = '22px sans-serif'
    ctx.fillText(label, x + 62, y + 38)
    ctx.fillStyle = '#5D4E37'
    ctx.font = 'bold 42px sans-serif'
    ctx.fillText(String(props.record.dimensions[key]), x + 67, y + 84)
  })

  ctx.fillStyle = '#8B7355'
  ctx.font = '24px sans-serif'
  ctx.fillText(`水温 ${props.record.brewTemp}°C    浸泡 ${props.record.brewTime}s`, 78, 680)
  if (props.record.weather || props.record.mood) {
    const meta = [props.record.weather, props.record.mood && `心情 ${props.record.mood}`].filter(Boolean).join('   ')
    ctx.fillText(meta, 78, 725)
  }
  if (props.record.notes) {
    ctx.strokeStyle = 'rgba(158,128,80,.35)'
    ctx.beginPath()
    ctx.moveTo(78, 760)
    ctx.lineTo(822, 760)
    ctx.stroke()
    ctx.fillStyle = '#8B7355'
    ctx.font = 'italic 24px serif'
    ctx.fillText(`“${props.record.notes.slice(0, 42)}”`, 78, 815)
  }

  // 右下角绘制分享二维码（失败不影响主卡片下载）
  try {
    const url = buildShareUrl(encodeShareData(toShareData(props.record)))
    const dataUrl = await QRCode.toDataURL(url, { width: 200, margin: 0, errorCorrectionLevel: 'M' })
    const img = new Image()
    img.src = dataUrl
    await img.decode()
    ctx.fillStyle = '#FFFFFF'
    roundRect(ctx, 636, 890, 210, 210, 16)
    ctx.fill()
    ctx.drawImage(img, 646, 900, 190, 190)
  } catch {
    // 二维码渲染失败时仍交付无二维码版本
  }

  ctx.fillStyle = '#9E8050'
  ctx.font = '20px sans-serif'
  ctx.fillText('一席茶，一方天地，一念清心', 78, 1065)

  const filename = `一盏茶-${props.record.teaName}-品鉴卡.png`
  const link = document.createElement('a')
  link.download = filename
  link.href = canvas.toDataURL('image/png')
  link.click()
}
</script>

<template>
  <article class="tasting-card rounded-2xl p-5 text-left shadow-xl" aria-label="品鉴卡片">
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="text-xs tracking-[0.24em] text-[var(--color-tea-gold)]">一盏茶 · TASTING NOTE</p>
        <h3 class="text-2xl font-bold text-[var(--color-wood)] mt-2">{{ record.teaName }}</h3>
        <p class="text-xs text-[var(--color-wood-light)] mt-1">
          {{ new Date(record.date).toLocaleDateString() }} · 第 {{ record.infusions }} 泡
        </p>
      </div>
      <div class="text-right shrink-0">
        <p class="text-4xl font-bold" :style="{ color: scoreLevel.color }">{{ record.overallScore }}</p>
        <p class="text-xs text-[var(--color-wood-light)]">{{ scoreLevel.text }}</p>
      </div>
    </div>

    <div class="mt-5 grid grid-cols-4 gap-2">
      <div v-for="([label, key]) in dimensions" :key="key" class="rounded-lg bg-white/60 py-2 text-center">
        <p class="text-xs text-[var(--color-wood-light)]">{{ label }}</p>
        <p class="text-lg font-bold text-[var(--color-wood)]">{{ record.dimensions[key] }}</p>
      </div>
    </div>

    <div class="mt-4 flex flex-wrap gap-2 text-xs text-[var(--color-wood-light)]">
      <span class="rounded-full bg-white/60 px-3 py-1">{{ record.brewTemp }}°C</span>
      <span class="rounded-full bg-white/60 px-3 py-1">浸泡 {{ record.brewTime }}s</span>
      <span class="rounded-full bg-white/60 px-3 py-1">工艺 ×{{ record.processFactor }}</span>
      <span v-if="record.aromaType" class="rounded-full bg-white/60 px-3 py-1">{{ record.aromaType }}</span>
      <span v-if="record.weather" class="rounded-full bg-white/60 px-3 py-1">天气 · {{ record.weather }}</span>
      <span v-if="record.mood" class="rounded-full bg-white/60 px-3 py-1">心情 · {{ record.mood }}</span>
    </div>

    <p v-if="record.notes" class="mt-4 border-t border-[var(--color-tea-gold)]/20 pt-3 text-sm italic text-[var(--color-wood-light)]">
      “{{ record.notes }}”
    </p>

    <div v-if="!standalone" class="mt-5 grid grid-cols-3 gap-2">
      <button type="button" @click="downloadCard"
        class="rounded-lg border border-[var(--color-tea-gold)] py-2 text-sm text-[var(--color-wood)] transition-colors hover:bg-white/70">
        下载 PNG
      </button>
      <button type="button" @click="shareCard"
        class="rounded-lg border border-[var(--color-tea-gold)] py-2 text-sm text-[var(--color-wood)] transition-colors hover:bg-white/70">
        分享文字
      </button>
      <button type="button" @click="toggleSharePanel"
        class="rounded-lg bg-[var(--color-wood)] py-2 text-sm text-[var(--color-cream)] transition-colors hover:bg-[var(--color-wood-light)]">
        {{ shareOpen ? '收起' : '分享链接' }}
      </button>
    </div>

    <div v-if="shareOpen && !standalone" class="mt-3 flex items-start gap-4 rounded-xl bg-white/70 p-4">
      <img v-if="qrDataUrl" :src="qrDataUrl" alt="品鉴卡分享二维码" class="h-28 w-28 shrink-0 rounded-lg" />
      <div class="min-w-0 flex-1">
        <p class="text-xs text-[var(--color-wood-light)]">扫描二维码，或复制链接分享这席茶</p>
        <p class="mt-1 break-all text-xs text-[var(--color-wood)]">{{ shareUrl }}</p>
        <button type="button" @click="copyShareUrl"
          class="mt-2 rounded-lg bg-[var(--color-tea-gold)] px-3 py-1.5 text-xs text-[var(--color-cream)] transition-colors hover:opacity-90">
          {{ copied ? '已复制' : '复制链接' }}
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.tasting-card {
  background:
    radial-gradient(circle at 90% 0%, rgba(201, 169, 110, .24), transparent 35%),
    linear-gradient(145deg, rgba(250, 246, 240, .98), rgba(245, 240, 232, .92));
  border: 1px solid rgba(158, 128, 80, .28);
}
</style>
