<script setup lang="ts">
/**
 * 茶歇分形茶树 Canvas：递归画树 + 呼吸光晕 + 摇曳
 * 纯展示组件，所有状态由父组件传入。
 */
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  seed: number
  progress: number       // 0-1 生长进度
  sway: number           // 摇曳强度（衰减）
  soundMode: boolean
  micLevel: number       // 0-1
  breathPhase: 'inhale' | 'exhale'
}>()
const emit = defineEmits<{ tap: [] }>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let rafId: number | null = null

/** 伪随机：基于种子的可复现随机 */
function seededRandom(seed: number) {
  let s = seed
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
}

/** 递归画分形茶树 */
function drawBranch(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, len: number, angle: number,
  depth: number, maxDepth: number,
  rand: () => number,
  swayOffset: number,
  leafProgress: number,
  leafColor: string,
) {
  if (depth <= 0 || len < 3) return
  const depthProgress = (maxDepth - depth) / maxDepth
  if (depthProgress > leafProgress + 0.15) return

  const swayAngle = swayOffset * (depth / maxDepth) * 0.3
  const a = angle + swayAngle
  const x2 = x + len * Math.cos(a)
  const y2 = y + len * Math.sin(a)

  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x2, y2)
  const isTrunk = depth > maxDepth - 2
  ctx.strokeStyle = isTrunk ? '#5d4e37' : '#6b7f3a'
  ctx.lineWidth = Math.max(0.8, depth * 1.1)
  ctx.lineCap = 'round'
  ctx.stroke()

  if (depth <= 2 && leafProgress > 0.55) {
    const leafSize = 2.5 + rand() * 2.5
    const leafAlpha = Math.min(1, (leafProgress - 0.55) / 0.3)
    ctx.beginPath()
    ctx.arc(x2, y2, leafSize, 0, Math.PI * 2)
    ctx.fillStyle = leafColor.replace('ALPHA', String(leafAlpha * 0.85))
    ctx.fill()
    if (rand() > 0.5) {
      ctx.beginPath()
      ctx.arc(x2 + (rand() - 0.5) * 6, y2 + (rand() - 0.5) * 6, 1.5, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(200, 220, 130, ${leafAlpha * 0.9})`
      ctx.fill()
    }
  }

  const branchAngle = 0.35 + rand() * 0.2
  const lenRatio = 0.72 + rand() * 0.08
  drawBranch(ctx, x2, y2, len * lenRatio, a - branchAngle, depth - 1, maxDepth, rand, swayOffset, leafProgress, leafColor)
  drawBranch(ctx, x2, y2, len * lenRatio, a + branchAngle, depth - 1, maxDepth, rand, swayOffset, leafProgress, leafColor)
}

function render() {
  const canvas = canvasRef.value
  if (!canvas) { rafId = requestAnimationFrame(render); return }
  const ctx = canvas.getContext('2d')
  if (!ctx) { rafId = requestAnimationFrame(render); return }

  const dpr = window.devicePixelRatio || 1
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr
    canvas.height = h * dpr
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  const leafColor = props.soundMode
    ? `rgba(${Math.round(124 + props.micLevel * 77)}, ${Math.round(179 - props.micLevel * 69)}, ${Math.round(66 + props.micLevel * 44)}, ALPHA)`
    : 'rgba(124, 179, 66, ALPHA)'

  // 呼吸光晕
  const breathScale = props.breathPhase === 'inhale' ? 1.15 : 0.9
  const glowR = Math.min(w, h) * 0.42 * breathScale
  const glow = ctx.createRadialGradient(w / 2, h * 0.55, 0, w / 2, h * 0.55, glowR)
  glow.addColorStop(0, 'rgba(201, 169, 110, 0.18)')
  glow.addColorStop(0.6, 'rgba(201, 169, 110, 0.06)')
  glow.addColorStop(1, 'transparent')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)

  const rand = seededRandom(props.seed)
  const maxDepth = 8
  const trunkLen = Math.min(w, h) * 0.22
  const baseX = w / 2
  const baseY = h * 0.88
  drawBranch(ctx, baseX, baseY, trunkLen, -Math.PI / 2, maxDepth, maxDepth, rand, props.sway, props.progress, leafColor)

  ctx.beginPath()
  ctx.ellipse(baseX, baseY + 4, w * 0.18, 6, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(93, 78, 55, 0.3)'
  ctx.fill()

  rafId = requestAnimationFrame(render)
}

onMounted(() => { rafId = requestAnimationFrame(render) })
onUnmounted(() => { if (rafId) cancelAnimationFrame(rafId) })
</script>

<template>
  <canvas ref="canvasRef" class="tree-canvas" @click="emit('tap')"></canvas>
</template>

<style scoped>
.tree-canvas {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
}
</style>
