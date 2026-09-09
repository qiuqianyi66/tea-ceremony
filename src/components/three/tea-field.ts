/**
 * tea-field.ts — 茶行生成器（古籍茶园系统）
 *
 * 依据：
 * - 《四时纂要》："开坎圆三尺深一尺……每坑种六七十颗子" → 穴播丛植
 * - 《茶解》："茶喜丛生……纵横各二尺许，每一坑下子一掬" → 丛生、行距/丛距成行成垄
 * - 《茶经》："阳崖阴林" → 南坡茶园 + 上缘遮阴树
 *
 * 形态：南坡砾壤带内沿等高线（x 方向）成垄；每丛 2-3 株；蓬面弧顶修剪（成熟绿球冠）；
 * 行距 1.5m、丛距 1.2m（株距 0.6m/丛 2-3 株）。全部 InstancedMesh 单 draw call。
 */
import * as THREE from 'three'
import { getTerrainHeight, SOIL_LOESS, SOIL_GRAVEL, isDrainGroove } from './terrain'
import type { GardenPreset } from './garden-presets'
import { GARDEN_PRESETS, DEFAULT_PRESET } from './garden-presets'

function seededRandom(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

export interface TeaField {
  group: THREE.Group
  dispose: () => void
}

/** 生成南坡成垄茶园 + 上缘遮阴树（行距/密度/蓬面/遮阴树按茶园预设；武夷走岩缝丛生分支） */
export function createTeaField(scene: THREE.Scene, preset?: GardenPreset): TeaField {
  const p = preset ?? DEFAULT_PRESET
  const root = new THREE.Group()
  root.name = 'tea-field'
  scene.add(root)

  // ---- 武夷：岩缝丛生茶行（丹霞峰腰岩壁下缘，不成行、丛植疏落、蓬面低矮贴岩） ----
  if (p.id === 'wuyishan') {
    const bushPos: number[] = []
    const bushColors: number[] = []
    for (let i = 0; i < 3200; i++) {
      const x = (seededRandom(i * 1.1 + 1) - 0.5) * 92
      const z = -6 - seededRandom(i * 1.7 + 2) * 44
      const h = getTerrainHeight(x, z)
      if (h < 4.4 || h > 9.4) continue // 只落峰腰砾壤带
      // 疏植（岩茶丛稀，无成行感）；岩壁陡处剔除（茶只长缝）
      if (seededRandom(i * 3.3 + 3) > 0.42) continue
      // 岩缝偏移大：每丛像从石缝里长出来
      const ox = (seededRandom(i * 5.7 + 4) - 0.5) * 1.1
      const oz = (seededRandom(i * 7.1 + 5) - 0.5) * 1.1
      const px = x + ox
      const pz = z + oz
      const ph = getTerrainHeight(px, pz)
      if (ph < 4.3 || ph > 9.6) continue
      // 每丛 2-3 株（《四时纂要》丛植），偏靠拢
      const n = 2 + Math.floor(seededRandom(i * 9.1 + 6) * 2)
      for (let k = 0; k < n; k++) {
        const kx = px + (seededRandom(i * 13 + k * 7.7) - 0.5) * 0.4
        const kz = pz + (seededRandom(i * 17 + k * 3.3) - 0.5) * 0.4
        const kh = getTerrainHeight(kx, kz)
        bushPos.push(kx, kh + 0.34, kz)
        bushColors.push(0.8 + seededRandom(i * 19 + k * 5.9) * 0.35)
      }
    }
    const bushCount = bushPos.length / 3
    if (bushCount > 0) {
      const bushGeo = new THREE.SphereGeometry(0.5, 9, 6)
      const bushMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.9,
        metalness: 0,
        flatShading: true,
      })
      const bushMesh = new THREE.InstancedMesh(bushGeo, bushMat, bushCount)
      const dummy = new THREE.Object3D()
      const col = new THREE.Color()
      for (let i = 0; i < bushCount; i++) {
        dummy.position.set(bushPos[i * 3]!, bushPos[i * 3 + 1]!, bushPos[i * 3 + 2]!)
        // 岩壁蓬：低矮扁宽（受风、少修剪），0.55-0.9
        dummy.scale.set(
          p.bushScaleMin + seededRandom(i * 1.3 + 77) * (p.bushScaleMax - p.bushScaleMin),
          (p.bushScaleMin + seededRandom(i * 2.1 + 78) * 0.2) * 0.6,
          p.bushScaleMin + seededRandom(i * 3.3 + 79) * (p.bushScaleMax - p.bushScaleMin),
        )
        dummy.updateMatrix()
        bushMesh.setMatrixAt(i, dummy.matrix)
        const tone = bushColors[i] ?? 0.95
        const dt = (tone - 0.95) * 0.4
        col.setRGB(p.bushBase[0] * (1 + dt), p.bushBase[1] * (1 + dt), p.bushBase[2] * (1 + dt))
        bushMesh.setColorAt(i, col)
      }
      bushMesh.castShadow = true
      bushMesh.receiveShadow = true
      root.add(bushMesh)
    }

    // 崖边岩生树：峰顶/崖缘零星苍树（阳崖阴林，稀而瘦）
    const wuyiShadeMat = new THREE.MeshStandardMaterial({ color: 0x3a5a30, roughness: 0.9, flatShading: true })
    const wuyiShadeBark = new THREE.MeshStandardMaterial({ color: 0x54442e, roughness: 0.95 })
    for (let i = 0; i < 4; i++) {
      const tx = -40 + seededRandom(i * 7.7 + 201) * 80
      const tz = -8 - seededRandom(i * 9.3 + 202) * 34
      const th = getTerrainHeight(tx, tz)
      if (th < 8) continue // 崖上/崖缘才长
      const tree = new THREE.Group()
      const s = (1.1 + seededRandom(i * 3.3 + 203) * 0.8) * p.shadeScale
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.24 * s, 2.6 * s, 6), wuyiShadeBark)
      trunk.position.y = 1.3 * s
      trunk.rotation.z = (seededRandom(i * 5.1 + 204) - 0.5) * 0.3 // 崖风扭曲
      trunk.castShadow = true
      tree.add(trunk)
      const crown = new THREE.Mesh(new THREE.SphereGeometry(1.1 * s, 8, 6), wuyiShadeMat)
      crown.position.y = 2.9 * s
      crown.scale.set(1, 0.75, 1)
      crown.castShadow = true
      tree.add(crown)
      tree.position.set(tx, th, tz)
      tree.rotation.y = seededRandom(i * 6.1 + 205) * Math.PI * 2
      root.add(tree)
    }
    return {
      group: root,
      dispose() {
        root.traverse((o) => {
          const m = o as THREE.Mesh
          if (m.geometry) m.geometry.dispose()
          if (m.material) (m.material as THREE.Material).dispose()
        })
        root.removeFromParent()
      },
    }
  }

  // ---- 常规茶园（龙井/勐海/福鼎）：沿等高线成垄 ----
  const bushPos: number[] = [] // 蓬面球实例（每丛 1）
  const bushColors: number[] = []
  const trunkPos: number[] = [] // 树干实例（每株 1）
  let rowIndex = 0
  for (let z = p.rowZStart; z > p.rowZEnd; z -= p.rowSpacing, rowIndex++) {
    for (let x = -p.rowXRange; x <= p.rowXRange; x += p.bushSpacing) {
      const h = getTerrainHeight(x, z)
      if (h < SOIL_LOESS + 0.3 || h > SOIL_GRAVEL - 0.7) continue // 只种砾壤带
      if (isDrainGroove(x, z)) continue // 排水沟不种（聚水劣地）

      // 每丛 2-3 株（《四时纂要》穴播丛植）
      const n = 2 + Math.floor(seededRandom(rowIndex * 37 + x * 1.7) * 2)
      for (let k = 0; k < n; k++) {
        const ox = (seededRandom(rowIndex * 13 + x * 3.1 + k * 7.7) - 0.5) * 0.55
        const oz = (seededRandom(rowIndex * 23 + x * 5.9 + k * 3.3) - 0.5) * 0.55
        const px = x + ox
        const pz = z + oz
        const ph = getTerrainHeight(px, pz)
        // 蓬面球（弧顶修剪，半径随 seed 微调）
        bushPos.push(px, ph + 0.5, pz)
        const tone = 0.82 + seededRandom(rowIndex * 29 + x * 7.1 + k * 5.9) * 0.3
        bushColors.push(tone)
        // 树干
        trunkPos.push(px, ph + 0.12, pz)
      }
    }
  }

  // 蓬面：InstancedMesh 球体（成熟茶蓬，统一弧顶修剪形态）
  const bushCount = bushPos.length / 3
  if (bushCount > 0) {
    const bushGeo = new THREE.SphereGeometry(0.5, 10, 7)
    const bushMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.85,
      metalness: 0,
      flatShading: true,
    })
    const bushMesh = new THREE.InstancedMesh(bushGeo, bushMat, bushCount)
    const dummy = new THREE.Object3D()
    const col = new THREE.Color()
    for (let i = 0; i < bushCount; i++) {
      dummy.position.set(bushPos[i * 3]!, bushPos[i * 3 + 1]!, bushPos[i * 3 + 2]!)
      dummy.scale.setScalar(p.bushScaleMin + seededRandom(i * 1.3 + 77) * (p.bushScaleMax - p.bushScaleMin))
      dummy.updateMatrix()
      bushMesh.setMatrixAt(i, dummy.matrix)
      // 茶蓬绿：按预设 base（岩茶深/白茶亮/古树大叶深），按 tone 明暗
      const tone = bushColors[i] ?? 0.95
      const dt = (tone - 0.95) * 0.4
      col.setRGB(
        p.bushBase[0] * (1 + dt),
        p.bushBase[1] * (1 + dt),
        p.bushBase[2] * (1 + dt),
      )
      bushMesh.setColorAt(i, col)
    }
    bushMesh.castShadow = true
    bushMesh.receiveShadow = true
    root.add(bushMesh)
  }

  // 树干：InstancedMesh 短柱（每株）
  const trunkCount = trunkPos.length / 3
  if (trunkCount > 0) {
    const trunkGeo = new THREE.CylinderGeometry(0.055, 0.08, 0.28, 6)
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4f38, roughness: 0.95 })
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, trunkCount)
    const dummy = new THREE.Object3D()
    for (let i = 0; i < trunkCount; i++) {
      dummy.position.set(trunkPos[i * 3]!, trunkPos[i * 3 + 1]!, trunkPos[i * 3 + 2]!)
      dummy.updateMatrix()
      trunkMesh.setMatrixAt(i, dummy.matrix)
    }
    trunkMesh.castShadow = true
    root.add(trunkMesh)
  }

  // ---- 遮阴树：茶园上缘（山脊下方，阳崖阴林）散植阔叶大树，数量/尺度按预设 ----
  const shadeMat = new THREE.MeshStandardMaterial({ color: 0x3e6b33, roughness: 0.9, flatShading: true })
  const shadeBark = new THREE.MeshStandardMaterial({ color: 0x5d4a34, roughness: 0.95 })
  for (let i = 0; i < p.shadeTreeCount; i++) {
    const tx = -38 + seededRandom(i * 7.7 + 101) * 76
    const tz = -14 + seededRandom(i * 9.3 + 102) * 10 // 山脊下缘
    const th = getTerrainHeight(tx, tz)
    if (th < SOIL_GRAVEL - 1.5) continue // 树要种在坡上
    const tree = new THREE.Group()
    const s = (1.6 + seededRandom(i * 3.3 + 103) * 1.2) * p.shadeScale
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.32 * s, 3.2 * s, 7), shadeBark)
    trunk.position.y = 1.6 * s
    trunk.castShadow = true
    tree.add(trunk)
    const crown = new THREE.Mesh(new THREE.SphereGeometry(1.5 * s, 9, 7), shadeMat)
    crown.position.y = 3.4 * s
    crown.castShadow = true
    tree.add(crown)
    const crown2 = new THREE.Mesh(new THREE.SphereGeometry(1.0 * s, 8, 6), shadeMat)
    crown2.position.set(0.7 * s, 4.2 * s, 0.4 * s)
    tree.add(crown2)
    tree.position.set(tx, th, tz)
    tree.rotation.y = seededRandom(i * 5.1 + 104) * Math.PI * 2
    root.add(tree)
  }

  return {
    group: root,
    dispose() {
      root.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
        if (m.material) (m.material as THREE.Material).dispose()
      })
      root.removeFromParent()
    },
  }
}

