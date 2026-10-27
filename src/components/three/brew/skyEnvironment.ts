/**
 * 环境皮肤辅助：程序化天幕渐变（CanvasTexture 缓存）+ 程序化雨丝（LineSegments）。
 * 从 TeaBrewSceneInner 拆出（2026-10-27）；零外部素材。
 */
import * as THREE from 'three'

const gradientCache = new Map<string, THREE.CanvasTexture>()

export function makeSkyGradient(top: string, bottom: string): THREE.CanvasTexture {
  const key = `${top}|${bottom}`
  const cached = gradientCache.get(key)
  if (cached) return cached
  const c = document.createElement('canvas')
  c.width = 32
  c.height = 256
  const gctx = c.getContext('2d')
  if (!gctx) throw new Error('sky gradient: 2d context unavailable')
  const g = gctx.createLinearGradient(0, 0, 0, 256)
  g.addColorStop(0, top)
  g.addColorStop(1, bottom)
  gctx.fillStyle = g
  gctx.fillRect(0, 0, 32, 256)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  gradientCache.set(key, tex)
  return tex
}

export interface RainSystem {
  rainLines: THREE.LineSegments
  rainGeometry: THREE.BufferGeometry
  rainPositions: Float32Array
  rainSpeeds: Float32Array
}

/** 程序化雨丝（湖畔烟雨皮肤用）：短竖线下落，零外部资源。 */
export function createRain(count = 300): RainSystem {
  const rainPositions = new Float32Array(count * 6)
  const rainSpeeds = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 8
    const y = Math.random() * 4 + 1
    const z = (Math.random() - 0.5) * 6 - 1
    rainPositions[i * 6] = x
    rainPositions[i * 6 + 1] = y
    rainPositions[i * 6 + 2] = z
    rainPositions[i * 6 + 3] = x
    rainPositions[i * 6 + 4] = y - 0.18
    rainPositions[i * 6 + 5] = z
    rainSpeeds[i] = 2 + Math.random() * 2
  }
  const rainGeometry = new THREE.BufferGeometry()
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3))
  const rainLines = new THREE.LineSegments(
    rainGeometry,
    new THREE.LineBasicMaterial({ color: 0xb4c8d8, transparent: true, opacity: 0.32 }),
  )
  rainLines.visible = false
  return { rainLines, rainGeometry, rainPositions, rainSpeeds }
}
