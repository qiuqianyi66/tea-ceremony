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

const ROW_SPACING = 1.5 // 行距（m）
const BUSH_SPACING = 1.2 // 丛距（m）
const ROW_Z_START = -26.5 // 茶园带起点（z 负 = 南坡相机中景）
const ROW_Z_END = -41.5
const ROW_X_RANGE = 44 // 垄横向范围 ±44

function seededRandom(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

export interface TeaField {
  group: THREE.Group
  dispose: () => void
}

/** 生成南坡成垄茶园 + 上缘遮阴树 */
export function createTeaField(scene: THREE.Scene): TeaField {
  const root = new THREE.Group()
  root.name = 'tea-field'
  scene.add(root)

  // ---- 茶行：逐垄逐丛采样（跳过劣地：黄土带/烂石带/排水沟） ----
  const bushPos: number[] = [] // 蓬面球实例（每丛 1）
  const bushColors: number[] = []
  const trunkPos: number[] = [] // 树干实例（每株 1）
  let rowIndex = 0
  for (let z = ROW_Z_START; z > ROW_Z_END; z -= ROW_SPACING, rowIndex++) {
    for (let x = -ROW_X_RANGE; x <= ROW_X_RANGE; x += BUSH_SPACING) {
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
      dummy.scale.setScalar(0.85 + seededRandom(i * 1.3 + 77) * 0.35)
      dummy.updateMatrix()
      bushMesh.setMatrixAt(i, dummy.matrix)
      // 成熟茶蓬绿：base #5d8c3a，按 tone 明暗
      const tone = bushColors[i] ?? 0.95
      col.setRGB(0.36 * (1 + (tone - 0.95) * 0.4), 0.55 * (1 + (tone - 0.95) * 0.4), 0.23 * (1 + (tone - 0.95) * 0.4))
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

  // ---- 遮阴树：茶园上缘（山脊下方，阳崖阴林）散植阔叶大树 ----
  const shadeMat = new THREE.MeshStandardMaterial({ color: 0x3e6b33, roughness: 0.9, flatShading: true })
  const shadeBark = new THREE.MeshStandardMaterial({ color: 0x5d4a34, roughness: 0.95 })
  for (let i = 0; i < 7; i++) {
    const tx = -38 + seededRandom(i * 7.7 + 101) * 76
    const tz = -14 + seededRandom(i * 9.3 + 102) * 10 // 山脊下缘（z -14~-24）
    const th = getTerrainHeight(tx, tz)
    if (th < SOIL_GRAVEL - 1.5) continue // 树要种在坡上
    const tree = new THREE.Group()
    const s = 1.6 + seededRandom(i * 3.3 + 103) * 1.2
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
