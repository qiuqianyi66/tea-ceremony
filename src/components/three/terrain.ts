/**
 * terrain.ts — 古籍茶园地形生成器（《茶经》山场逻辑）
 *
 * 依据：
 * - 《茶经·一之源》："上者生烂石，中者生砾壤，下者生黄土……阳崖阴林"
 *   → 土壤三带：高坡烂石带 / 中坡砾壤带（茶园主体）/ 谷底黄土带（不种茶）
 * - 《东溪试茶录》："园植北山之阳……厥土赤坟" → 南坡向阳 + 红壤色带
 * - 《茶解》："茶地斜坡为佳，聚水向阴之处，茶品遂劣" → 田埂蓄水 + 纵向排水沟
 *
 * 结构：东西走向山脊骨架（z 方向低频）→ 南坡（-z 侧）宽缓为茶园、北坡（+z 侧）陡峭为阴林
 */
import * as THREE from 'three'
import { GARDEN_PRESETS, DEFAULT_PRESET, type GardenPreset } from './garden-presets'

export const TERRAIN_SIZE = 200
export const TERRAIN_SEGMENTS = 200

/** 土壤三带高度阈值（米） */
export const SOIL_LOESS = 4 // 谷底黄土带（不种茶，杂草地/湿地）
export const SOIL_GRAVEL = 10 // 中坡砾壤带（红壤，茶园主体）
export const SOIL_ROCK = 14 // 高坡烂石带（岩石露头）

export type SoilBand = 'loess' | 'gravel' | 'rock'

/** 当前激活的茶园预设（默认杭州龙井；由场景组件挂载时 setTerrainPreset 切换） */
let activePreset: GardenPreset = DEFAULT_PRESET

/** 切换地形/土壤预设（四个茶园差异化） */
export function setTerrainPreset(p: GardenPreset): void {
  activePreset = p
}

function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

export function smoothNoise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const a = hash(ix, iy), b = hash(ix + 1, iy)
  const c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1)
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
}

export function fbm(x: number, y: number, octaves = 5): number {
  let value = 0, amplitude = 1, frequency = 1, max = 0
  for (let i = 0; i < octaves; i++) {
    value += smoothNoise(x * frequency, y * frequency) * amplitude
    max += amplitude
    amplitude *= 0.5
    frequency *= 2
  }
  return value / max
}

/** 山脊线 z 位置（东西走向，随 x 蜿蜒）—— 南坡茶园在 -z 侧 */
function ridgeZAt(x: number): number {
  return activePreset.ridgeZ + (smoothNoise(x * 0.02, 4.3) - 0.5) * activePreset.ridgeWander
}

/**
 * 采样地形高度（与 createTerrainGeometry 完全一致，供茶树/茶行定位）
 * 1. 东西走向山脊骨架（南坡宽缓 / 北坡陡峭），参数随茶园预设变化
 * 2. 土壤三带内做"田埂梯田 + 微内倾 + 纵向排水浅沟"
 */
export function getTerrainHeight(x: number, z: number): number {
  const { ridgeHeight, sigmaSouth, sigmaNorth, centralRadius, centralBump, edgeFadeAt, edgeFadeRate } = activePreset
  // ---- 山脊-沟谷骨架 ----
  const ridgeZ = ridgeZAt(x)
  const dz = z - ridgeZ
  // 不对称高斯：南坡（dz<0）宽缓，北坡（dz>0）陡峭（阴林坡）
  const sigma = dz < 0 ? sigmaSouth : sigmaNorth
  const ridgeH = ridgeHeight * Math.exp(-(dz * dz) / (2 * sigma * sigma))
  let h = ridgeH
  // 细节起伏
  h += fbm(x * 0.02, z * 0.02, 4) * 3.2
  h += fbm(x * 0.06, z * 0.06, 3) * 1.1
  // 中央茶山微隆起（相机正前方视觉焦点）
  const r = Math.sqrt(x * x + z * z)
  h += Math.max(0, 1 - r / centralRadius) * centralBump
  // 边缘渐消（保持场景封闭，起止随预设）
  if (r > edgeFadeAt) h -= (r - edgeFadeAt) * edgeFadeRate

  // ---- 田埂梯田（仅砾壤带 4-10，茶园主体） ----
  if (h > SOIL_LOESS && h < SOIL_GRAVEL) {
    const step = 1.5
    const t = (h - SOIL_LOESS) / step
    const frac = t - Math.floor(t)
    h = SOIL_LOESS + Math.floor(t) * step
    if (frac < 0.16) {
      // 田埂：台阶边缘凸起（保土蓄水）
      h += 0.3 * (1 - frac / 0.16)
    } else {
      // 平台微内倾（向山侧低 0.04，蓄水不流失）
      h += 0.04
    }
    // 纵向排水浅沟：沿坡向（z 方向）间隔 ~9m 一条，深 0.35 宽 1.6（《茶解》"斜坡为佳，聚水劣地"）
    const groove = Math.abs((((z + x * 0.18) % 9) + 9) % 9)
    if (groove < 0.8) h -= 0.35 * (1 - groove / 0.8)
    // 平台微起伏
    h += (smoothNoise(x * 0.3, z * 0.3) - 0.5) * 0.25
  }
  return h
}

/** 按高度返回土壤带（《茶经》三品） */
export function getSoilBand(h: number): SoilBand {
  if (h < SOIL_LOESS) return 'loess'
  if (h < SOIL_GRAVEL) return 'gravel'
  return 'rock'
}

/** 某点是否位于排水浅沟上（茶行/种茶避让） */
export function isDrainGroove(x: number, z: number): boolean {
  const groove = Math.abs((((z + x * 0.18) % 9) + 9) % 9)
  return groove < 0.9
}

/** 土壤带 → 顶点色 tint（×贴图）：按茶园预设（龙井红壤 / 武夷丹霞 / 勐海黑土 / 福鼎黄棕） */
function soilTint(band: SoilBand): [number, number, number] {
  return band === 'loess' ? activePreset.tintLoess
    : band === 'gravel' ? activePreset.tintGravel
    : activePreset.tintRock
}

/** 生成带明暗 + 土壤色带的地形几何 */
export function createTerrainGeometry(): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position!
  const colors = new Float32Array(pos.count * 3)

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const h = getTerrainHeight(x, z)
    pos.setY(i, h)

    // 明暗：缓坡略亮、梯田台阶暗、陡坡暗
    let shade = 1.0
    if (h > SOIL_LOESS && h < SOIL_GRAVEL) {
      const terracePos = ((h - SOIL_LOESS) % 1.5) / 1.5
      shade = terracePos < 0.16 ? 0.85 : 1.0 // 田埂边缘阴影
      // 排水沟略深
      if (isDrainGroove(x, z)) shade *= 0.9
    }
    if (h > SOIL_GRAVEL) shade *= 0.92 // 高处岩石略暗
    shade *= 1.0 + (smoothNoise(x * 0.25, z * 0.25) - 0.5) * 0.22

    // 土壤色带 tint（按预设）
    const tint = soilTint(getSoilBand(h))
    colors[i * 3] = shade * tint[0]
    colors[i * 3 + 1] = shade * tint[1]
    colors[i * 3 + 2] = shade * tint[2]
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  return geo
}

