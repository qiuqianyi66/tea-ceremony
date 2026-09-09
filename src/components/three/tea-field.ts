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
import { createTreeForest, type TreeSpec, type TreeSpecies } from './tea-tree'

function seededRandom(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

export interface TeaField {
  group: THREE.Group
  dispose: () => void
}

/** 生成南坡成垄茶园 + 程序化树林（行距/密度/蓬面/树按茶园预设；武夷/勐海走独立分支） */
export function createTeaField(scene: THREE.Scene, preset?: GardenPreset): TeaField {
  const p = preset ?? DEFAULT_PRESET
  const root = new THREE.Group()
  const treeSpecs: TreeSpec[] = [] // 全部树统一交给程序化树林（枝干分明）
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

    // 崖边岩生树：峰顶/崖缘零星苍树（阳崖阴林，稀而瘦但可见）
    for (let i = 0; i < 4; i++) {
      const tx = -40 + seededRandom(i * 7.7 + 201) * 80
      const tz = -8 - seededRandom(i * 9.3 + 202) * 34
      const th = getTerrainHeight(tx, tz)
      if (th < 8) continue // 崖上/崖缘才长
      treeSpecs.push({
        x: tx,
        h: th,
        z: tz,
        scale: (1.1 + seededRandom(i * 3.3 + 203) * 0.7) * p.shadeScale,
        seed: i * 77.7 + 301,
        species: 'wuyi',
      })
    }
    if (treeSpecs.length > 0) {
      createTreeForest(root, treeSpecs) // 森林实例挂到 root，随 TeaField 统一清理
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

  // ---- 勐海：雨林茶林共生（茶散生于大树下，不成行；"茶在林中，林在茶中"） ----
  if (p.id === 'yunnan') {
    // 散生古茶丛：全坡扫点，稀落疏植，每丛 2-4 株分蘖、蓬大苍劲
    const bushPos: number[] = []
    const bushColors: number[] = []
    const bigTreePos: Array<[number, number, number, number]> = [] // x,h,z,scale
    for (let i = 0; i < 3600; i++) {
      const x = (seededRandom(i * 1.1 + 1) - 0.5) * 96
      const z = -6 - seededRandom(i * 1.7 + 2) * 40
      const h = getTerrainHeight(x, z)
      if (h < 4.2 || h > 9.6) continue
      if (seededRandom(i * 3.3 + 3) > 0.34) continue // 疏植（雨林茶树稀疏散生）
      const n = 2 + Math.floor(seededRandom(i * 9.1 + 6) * 3) // 2-4 株分蘖
      for (let k = 0; k < n; k++) {
        const kx = x + (seededRandom(i * 13 + k * 7.7) - 0.5) * 1.4 // 分蘖间距大（古树多枝）
        const kz = z + (seededRandom(i * 17 + k * 3.3) - 0.5) * 1.4
        const kh = getTerrainHeight(kx, kz)
        if (kh < 4.1 || kh > 9.8) continue
        bushPos.push(kx, kh + 0.6, kz) // 蓬位更高（古树高大多枝）
        bushColors.push(0.8 + seededRandom(i * 19 + k * 5.9) * 0.35)
      }
    }
    const bushCount = bushPos.length / 3
    if (bushCount > 0) {
      const bushGeo = new THREE.SphereGeometry(0.5, 10, 7)
      const bushMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, flatShading: true })
      const bushMesh = new THREE.InstancedMesh(bushGeo, bushMat, bushCount)
      const dummy = new THREE.Object3D()
      const col = new THREE.Color()
      for (let i = 0; i < bushCount; i++) {
        dummy.position.set(bushPos[i * 3]!, bushPos[i * 3 + 1]!, bushPos[i * 3 + 2]!)
        const s = p.bushScaleMin + seededRandom(i * 1.3 + 77) * (p.bushScaleMax - p.bushScaleMin)
        dummy.scale.set(s, s * 1.1, s) // 古树高耸
        dummy.updateMatrix()
        bushMesh.setMatrixAt(i, dummy.matrix)
        const tone = bushColors[i] ?? 0.95
        const dt = (tone - 0.95) * 0.35
        col.setRGB(p.bushBase[0] * (1 + dt), p.bushBase[1] * (1 + dt), p.bushBase[2] * (1 + dt))
        bushMesh.setColorAt(i, col)
      }
      bushMesh.castShadow = true
      bushMesh.receiveShadow = true
      root.add(bushMesh)
    }

    // 林冠大树：茶行带/后坡散植（茶林共生），干粗冠大、高矮参差，树下垂藤
    for (let i = 0; i < 30; i++) {
      const tx = -46 + seededRandom(i * 7.7 + 301) * 92
      const tz = -12 - seededRandom(i * 9.3 + 302) * 28 // 茶行带起，近景可见
      const th = getTerrainHeight(tx, tz)
      if (th < 3.2 || th > 14) continue
      const s = (1.5 + seededRandom(i * 3.3 + 303) * 0.9) * p.shadeScale
      treeSpecs.push({ x: tx, h: th, z: tz, scale: s, seed: i * 91.3 + 501, species: 'jungle' })
      bigTreePos.push([tx, th, tz, s])
    }

    // 垂藤（附生植物垂挂）：每棵大树 2-3 条，从冠底垂下
    if (bigTreePos.length > 0) {
      const vineGeo = new THREE.ConeGeometry(0.05, 1, 4)
      vineGeo.translate(0, -0.5, 0)
      const vineMat = new THREE.MeshStandardMaterial({ color: 0x3a5a38, roughness: 0.95 })
      const vineList: number[] = []
      for (const [tx, th, tz, s] of bigTreePos) {
        const vn = 2 + Math.floor(seededRandom(tx * 3.1 + tz * 1.3 + 401) * 2)
        for (let v = 0; v < vn; v++) {
          vineList.push(
            tx + (seededRandom(tx * 7.7 + v * 5.9 + 402) - 0.5) * 1.6 * s,
            th + (3.4 + seededRandom(tx * 4.1 + v * 3.3 + 403) * 1.2) * s,
            tz + (seededRandom(tx * 9.1 + v * 6.7 + 404) - 0.5) * 1.6 * s,
          )
        }
      }
      const vineCount = vineList.length / 3
      const vines = new THREE.InstancedMesh(vineGeo, vineMat, vineCount)
      const dummy = new THREE.Object3D()
      for (let i = 0; i < vineCount; i++) {
        dummy.position.set(vineList[i * 3]!, vineList[i * 3 + 1]!, vineList[i * 3 + 2]!)
        dummy.scale.set(1, 2 + seededRandom(i * 3.7 + 405) * 2.4, 1) // 长 2-4.4m
        dummy.rotation.set(0, 0, (seededRandom(i * 5.3 + 406) - 0.5) * 0.5)
        dummy.updateMatrix()
        vines.setMatrixAt(i, dummy.matrix)
      }
      root.add(vines)
    }
    if (treeSpecs.length > 0) {
      createTreeForest(root, treeSpecs)
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

  // ---- 常规茶园（龙井/福鼎）：沿等高线成垄 ----
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

  // ---- 遮阴树：茶行带 + 上缘散植（阳崖阴林；树在茶园中，近景可见枝干），数量/尺度按预设 ----
  const shadeSpecies: TreeSpecies = p.id === 'fuding' ? 'coast' : 'shade'
  for (let i = 0; i < p.shadeTreeCount; i++) {
    const tx = -40 + seededRandom(i * 7.7 + 101) * 80
    const tz = -10 - seededRandom(i * 9.3 + 102) * 26 // 茶行带 + 山脊下缘
    const th = getTerrainHeight(tx, tz)
    if (th < 4.4 || th > 14.5) continue // 茶园中 + 坡上（不种峰顶/谷底）
    treeSpecs.push({
      x: tx,
      h: th,
      z: tz,
      scale: (1.6 + seededRandom(i * 3.3 + 103) * 1.0) * p.shadeScale,
      seed: i * 61.1 + 901,
      species: shadeSpecies,
    })
  }
  if (treeSpecs.length > 0) {
    createTreeForest(root, treeSpecs)
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

