<script setup lang="ts">
import { ref } from 'vue'
import QRCode from 'qrcode'
import type { Tea } from '@/types/tea'
import { encodeTeaShare, buildTeaShareUrl } from '@/services/share'

const props = defineProps<{
  tea: Tea
  /** 只读模式（分享页）：隐藏分享 / 下载按钮 */
  standalone?: boolean
}>()

// ---------- 分享链接与二维码 ----------
const shareOpen = ref(false)
const shareUrl = ref('')
const qrDataUrl = ref('')
const copied = ref(false)

async function toggleSharePanel() {
  if (shareOpen.value) {
    shareOpen.value = false
    return
  }
  if (!shareUrl.value) {
    const data = {
      teaId: props.tea.id,
      teaName: props.tea.name,
      teaType: props.tea.type,
      origin: props.tea.origin,
      flavor: props.tea.flavor,
      description: props.tea.description,
    }
    shareUrl.value = buildTeaShareUrl(encodeTeaShare(data))
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

async function shareTea() {
  const text = [
    `【${props.tea.name}】${props.tea.type} · ${props.tea.origin}`,
    `风味：${props.tea.flavor.join('、')}`,
    props.tea.description,
    '来自「一盏茶」茶文化空间',
  ].join('\n')

  try {
    if (navigator.share) {
      await navigator.share({ title: `${props.tea.name} · 名茶知识卡`, text })
    } else {
      await navigator.clipboard.writeText(text)
    }
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

  // 茶汤色块点缀（左上 / 右下）
  ctx.fillStyle = props.tea.soupColorMin
  ctx.globalAlpha = 0.28
  roundRect(ctx, 0, 0, 220, 220, 0)
  ctx.fill()
  ctx.globalAlpha = 1

  ctx.strokeStyle = '#9E8050'
  ctx.lineWidth = 3
  roundRect(ctx, 34, 34, 832, 1052, 24)
  ctx.stroke()

  ctx.fillStyle = '#9E8050'
  ctx.font = '24px sans-serif'
  ctx.letterSpacing = '6px'
  ctx.fillText('一盏茶  ·  TEA CARD', 78, 100)
  ctx.letterSpacing = '0px'

  ctx.fillStyle = '#5D4E37'
  ctx.font = 'bold 56px serif'
  ctx.fillText(props.tea.name, 78, 190)
  ctx.fillStyle = '#8B7355'
  ctx.font = '26px sans-serif'
  ctx.fillText(`${props.tea.type}  ·  ${props.tea.origin}  ·  ${props.tea.altitude ?? '产地海拔'}`, 80, 235)

  // 风味标签
  ctx.font = '22px sans-serif'
  props.tea.flavor.forEach((f, index) => {
    const x = 78 + index * 128
    const y = 300
    ctx.fillStyle = 'rgba(201,169,110,.18)'
    roundRect(ctx, x, y, 112, 44, 22)
    ctx.fill()
    ctx.fillStyle = '#5D4E37'
    ctx.fillText(f, x + 24, y + 29)
  })

  // 描述（折行最多 6 行）
  ctx.fillStyle = '#8B7355'
  ctx.font = '26px serif'
  const maxWidth = 740
  let cursorY = 420
  const lines: string[] = []
  let current = ''
  for (const ch of props.tea.description) {
    if (ctx.measureText(current + ch).width > maxWidth) {
      lines.push(current)
      current = ch
      if (lines.length === 5) break
    } else {
      current += ch
    }
  }
  if (current && lines.length < 6) lines.push(current)
  for (const line of lines) {
    ctx.fillText(line, 78, cursorY)
    cursorY += 40
  }

  // 冲泡参数
  ctx.strokeStyle = 'rgba(158,128,80,.35)'
  ctx.beginPath()
  ctx.moveTo(78, 700)
  ctx.lineTo(822, 700)
  ctx.stroke()
  ctx.fillStyle = '#8B7355'
  ctx.font = '24px sans-serif'
  ctx.fillText(`水温 ${props.tea.bestTemp}°C    首泡 ${props.tea.bestTime}s    可冲 ${props.tea.infusions} 泡`, 78, 745)

  // 故事首句
  const storyLine = props.tea.story.slice(0, 34)
  ctx.fillStyle = '#9E8050'
  ctx.font = 'italic 24px serif'
  ctx.fillText(`“${storyLine}…”`, 78, 810)

  // 右下角二维码
  try {
    const data = {
      teaId: props.tea.id,
      teaName: props.tea.name,
      teaType: props.tea.type,
      origin: props.tea.origin,
      flavor: props.tea.flavor,
      description: props.tea.description,
    }
    const url = buildTeaShareUrl(encodeTeaShare(data))
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

  const filename = `一盏茶-${props.tea.name}-知识卡.png`
  const link = document.createElement('a')
  link.download = filename
  link.href = canvas.toDataURL('image/png')
  link.click()
}
</script>

<template>
  <article class="tea-card rounded-2xl p-5 text-left shadow-xl" aria-label="名茶知识卡">
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="text-xs tracking-[0.24em] text-[var(--color-tea-gold)]">一盏茶 · TEA CARD</p>
        <h3 class="text-2xl font-bold font-serif text-[var(--color-wood)] mt-2">{{ tea.name }}</h3>
        <p class="text-xs text-[var(--color-wood-light)] mt-1">{{ tea.type }} · {{ tea.origin }}</p>
      </div>
      <div class="shrink-0 text-right">
        <div class="ml-auto h-14 w-14 rounded-full border border-[var(--color-tea-gold)]/40"
          :style="{ background: `linear-gradient(135deg, ${tea.soupColorMin}, ${tea.soupColorMax})` }">
        </div>
        <p class="mt-1 text-[10px] text-[var(--color-wood-light)]">{{ tea.altitude ?? '' }}</p>
      </div>
    </div>

    <p class="mt-4 text-sm leading-relaxed text-[var(--color-wood)]">{{ tea.description }}</p>

    <div class="mt-4 flex flex-wrap gap-2">
      <span v-for="f in tea.flavor" :key="f"
        class="rounded-full bg-[var(--color-tea-gold)]/15 px-3 py-1 text-xs text-[var(--color-wood)]">
        {{ f }}
      </span>
    </div>

    <div class="mt-4 flex flex-wrap gap-2 text-xs text-[var(--color-wood-light)]">
      <span class="rounded-full bg-white/60 px-3 py-1">{{ tea.bestTemp }}°C</span>
      <span class="rounded-full bg-white/60 px-3 py-1">首泡 {{ tea.bestTime }}s</span>
      <span class="rounded-full bg-white/60 px-3 py-1">可冲 {{ tea.infusions }} 泡</span>
      <span v-if="tea.process" class="rounded-full bg-white/60 px-3 py-1">{{ tea.process }}</span>
    </div>

    <div v-if="!standalone" class="mt-5 grid grid-cols-3 gap-2">
      <button type="button" @click="downloadCard"
        class="rounded-lg border border-[var(--color-tea-gold)] py-2 text-sm text-[var(--color-wood)] transition-colors hover:bg-white/70">
        下载海报
      </button>
      <button type="button" @click="shareTea"
        class="rounded-lg border border-[var(--color-tea-gold)] py-2 text-sm text-[var(--color-wood)] transition-colors hover:bg-white/70">
        分享文字
      </button>
      <button type="button" @click="toggleSharePanel"
        class="rounded-lg bg-[var(--color-wood)] py-2 text-sm text-[var(--color-cream)] transition-colors hover:bg-[var(--color-wood-light)]">
        {{ shareOpen ? '收起' : '分享链接' }}
      </button>
    </div>

    <div v-if="shareOpen && !standalone" class="mt-3 flex items-start gap-4 rounded-xl bg-white/70 p-4">
      <img v-if="qrDataUrl" :src="qrDataUrl" alt="名茶知识卡分享二维码" class="h-28 w-28 shrink-0 rounded-lg" />
      <div class="min-w-0 flex-1">
        <p class="text-xs text-[var(--color-wood-light)]">扫描二维码，把这杯茶分享给朋友</p>
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
.tea-card {
  background:
    radial-gradient(circle at 90% 0%, rgba(201, 169, 110, .24), transparent 35%),
    linear-gradient(145deg, rgba(250, 246, 240, .98), rgba(245, 240, 232, .92));
  border: 1px solid rgba(158, 128, 80, .28);
}
</style>
