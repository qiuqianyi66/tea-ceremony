/**
 * tea-tree.ts — 程序化分形树（枝干分明：主干弯节 → 主枝 → 次枝 → 枝端叶簇）
 *
 * 与旧版"圆柱干 + 球冠堆"不同：每棵树按递归分叉生成 12-20 根枝干，
 * 全部实例化进 2 个 InstancedMesh（枝干 1 个 + 叶簇 1 个），
 * 全场景几十棵树也只占 2 个 draw call，枝形清晰可见。
 */
import * as THREE from 'three'
import { seededRandom } from './tea-plant'

export type TreeSpecies = 'shade' | 'wuyi' | 'jungle' | 'coast'

export interface TreeSpec {
  x: number
  h: number
  z: number
  /** 整体尺度（树高 ≈ 4-6 × scale） */
  scale: number
  seed: number
  species: TreeSpecies
}

/** 每棵树要吐出的实例数据 */
interface BranchInst {
  pos: [number, number, number]
  quat: [number, number, number, number]
  len: number
  radius: number
}
interface LeafInst {
  pos: [number, number, number]
  scale: number
  shade: number
  species: TreeSpecies
}

const SPECIES_COLORS: Record<TreeSpecies, string> = {
  shade: '#3e6b33', // 龙井香樟/桂花感
  wuyi: '#3a5a30', // 武夷崖边岩生树（深瘦）
  jungle: '#35602f', // 勐海雨林阔叶
  coast: '#4a7a3a', // 福鼎海岸防风树（亮绿）
}

const qTmp = new THREE.Quaternion()
const up = new THREE.Vector3(0, 1, 0)
const xAxis = new THREE.Vector3(1, 0, 0)
const zAxis = new THREE.Vector3(0, 0, 1)

/**
 * 递归生成枝干：从 baseY 向上长，每层分叉 2-3 根。
 * level=0 时在枝端吐叶簇（2-4 个扁球错落）。
 */
function growBranch(
  branches: BranchInst[],
  leaves: LeafInst[],
  seed: number,
  level: number,
  len: number,
  radius: number,
  y: number,
  dir: THREE.Vector3,
  species: TreeSpecies,
  specScale: number,
): void {
  // 枝干圆柱（沿 dir 方向，从中点定位）
  const mid = dir.clone().multiplyScalar(len / 2).add(new THREE.Vector3(0, y, 0))
  branches.push({
    pos: [mid.x, mid.y, mid.z],
    quat: [dir.x, dir.y, dir.z, 1], // 存方向，实例化时转四元数
    len,
    radius,
  })

  if (level === 0) {
    // 枝端叶簇：1-2 个扁球错落（球径 ≈ scale 的 0.5-0.8 倍），间隙露出枝干
    const tip = new THREE.Vector3(0, y, 0).add(dir.clone().multiplyScalar(len))
    const n = 1 + Math.floor(seededRandom(seed * 13.1 + 7.7) * 2)
    for (let k = 0; k < n; k++) {
      leaves.push({
        pos: [
          tip.x + (seededRandom(seed * 17.3 + k * 3.3) - 0.5) * len * 1.1,
          tip.y + (seededRandom(seed * 19.7 + k * 5.9) - 0.2) * len * 0.5,
          tip.z + (seededRandom(seed * 23.1 + k * 7.1) - 0.5) * len * 1.1,
        ],
        scale: (0.9 + seededRandom(seed * 3.7 + k) * 0.6) * 0.55 * specScale,
        shade: 0.85 + seededRandom(seed * 29.1 + k * 11.3) * 0.3,
        species,
      })
    }
    return
  }

  // 分叉 2-3 根
  const nChild = 2 + Math.floor(seededRandom(seed * 5.1 + level * 3.7) * 2)
  for (let k = 0; k < nChild; k++) {
    // 方位角均匀错开 + 抖动
    const az = (k / nChild) * Math.PI * 2 + seededRandom(seed * 7.3 + k * 13.7) * 1.1
    // 倾角：上层越细越外斜（25°→55°），微抖动
    const incline = 0.42 + (3 - level) * 0.16 + (seededRandom(seed * 11.3 + k * 5.7) - 0.5) * 0.3
    const nDir = new THREE.Vector3(
      Math.sin(incline) * Math.cos(az),
      Math.cos(incline),
      Math.sin(incline) * Math.sin(az),
    )
    // 与父方向混合（沿父方向延续 + 分叉偏移），保主干整体向上
    const child = dir.clone().multiplyScalar(0.45).add(nDir.multiplyScalar(0.85)).normalize()
    growBranch(
      branches,
      leaves,
      seed + k * 17.7 + level * 3.1,
      level - 1,
      len * (0.58 + seededRandom(seed * 15.7 + k * 9.3) * 0.12),
      radius * (0.52 + seededRandom(seed * 3.3 + k * 5.1) * 0.08),
      y + len * dir.y * 0.85,
      child,
      species,
      specScale,
    )
  }
}

/** 建一棵树的全部实例（枝干 + 叶簇） */
function growTree(spec: TreeSpec, branches: BranchInst[], leaves: LeafInst[]): void {
  const H = (4.2 + seededRandom(spec.seed * 1.3) * 1.6) * spec.scale
  // 主干分两节略弯（不是一根直棍）
  let y = 0
  let dir = up.clone()
  const bend = (seededRandom(spec.seed * 2.1) - 0.5) * 0.16
  for (let seg = 0; seg < 2; seg++) {
    const segLen = H * 0.42
    const segDir = dir.clone()
    segDir.x += (seededRandom(spec.seed + seg * 4.7) - 0.5) * 0.18
    segDir.z += (seededRandom(spec.seed + seg * 6.3) - 0.5) * 0.18
    segDir.normalize()
    branches.push({
      pos: [
        (spec.x + segDir.x * segLen / 2 + dir.x * (seg * segLen * 0.5)),
        (spec.h + y + segDir.y * segLen / 2),
        (spec.z + segDir.z * segLen / 2 + dir.z * (seg * segLen * 0.5)),
      ],
      quat: [segDir.x, segDir.y, segDir.z, 1],
      len: segLen,
      radius: (0.17 + (1 - seg * 0.28) * 0.06) * spec.scale,
    })
    y += segLen * 0.98
    dir = segDir
  }
  // 主枝从主干中上段发出（2-3 根）
  const nMain = 2 + Math.floor(seededRandom(spec.seed * 3.7) * 2)
  const branchBase = 0.55
  for (let k = 0; k < nMain; k++) {
    const az = (k / nMain) * Math.PI * 2 + seededRandom(spec.seed * 5.3 + k * 7.7) * 0.9
    const incline = 0.5 + (seededRandom(spec.seed * 7.7 + k * 3.1) - 0.5) * 0.3
    const bDir = new THREE.Vector3(
      Math.sin(incline) * Math.cos(az),
      Math.cos(incline),
      Math.sin(incline) * Math.sin(az),
    ).normalize()
    const bLen = H * (0.5 + seededRandom(spec.seed * 9.1 + k * 5.3) * 0.16)
    growBranch(
      branches,
      leaves,
      spec.seed + k * 11.7 + 41,
      2,
      bLen,
      0.12 * spec.scale, // 主枝加粗（中距可见）
      spec.h + H * branchBase + k * 0.12,
      bDir,
      spec.species,
      spec.scale,
    )
  }
  // 树冠顶端补一簇（枝干分明但冠也饱满）
  leaves.push({
    pos: [spec.x, spec.h + H * 1.02, spec.z],
    scale: 1.2 * spec.scale,
    shade: 1.0,
    species: spec.species,
  })
}

/** 生成整片树林（所有树共 2 个 InstancedMesh） */
export function createTreeForest(parent: THREE.Object3D, specs: TreeSpec[]): { root: THREE.Group; dispose(): void } {
  const root = new THREE.Group()
  root.name = 'tree-forest'
  const branches: BranchInst[] = []
  const leaves: LeafInst[] = []
  for (const spec of specs) growTree(spec, branches, leaves)

  // 枝干 InstancedMesh（圆柱，末梢略细）
  if (branches.length > 0) {
    const branchGeo = new THREE.CylinderGeometry(1, 1.25, 1, 5)
    const branchMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true })
    const branchMesh = new THREE.InstancedMesh(branchGeo, branchMat, branches.length)
    const dummy = new THREE.Object3D()
    const tmpC = new THREE.Color()
    for (let i = 0; i < branches.length; i++) {
      const b = branches[i]!
      dummy.position.set(b.pos[0], b.pos[1], b.pos[2])
      // quat 字段存方向向量，转四元数
      const d = new THREE.Vector3(b.quat[0], b.quat[1], b.quat[2]).normalize()
      qTmp.setFromUnitVectors(up, d)
      dummy.quaternion.copy(qTmp)
      dummy.scale.set(b.radius, b.len, b.radius)
      dummy.updateMatrix()
      branchMesh.setMatrixAt(i, dummy.matrix)
      // 树皮色：树干粗深、枝细略亮
      tmpC.setHSL(0.08, 0.3, 0.2 + (0.3 - b.radius * 2.2) * 0.25)
      branchMesh.setColorAt(i, tmpC)
    }
    branchMesh.instanceMatrix.needsUpdate = true
    if (branchMesh.instanceColor) branchMesh.instanceColor.needsUpdate = true
    branchMesh.castShadow = true
    root.add(branchMesh)
  }

  // 叶簇 InstancedMesh（扁球，按 species 上色 + 明暗变化）
  if (leaves.length > 0) {
    const leafGeo = new THREE.SphereGeometry(1, 7, 5)
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.88,
      flatShading: true,
      emissive: 0x22391f,
      emissiveIntensity: 0.4, // 树冠微发光：雾里发亮、雨林光斑感
    })
    const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, leaves.length)
    const dummy = new THREE.Object3D()
    const tmpC = new THREE.Color()
    for (let i = 0; i < leaves.length; i++) {
      const l = leaves[i]!
      dummy.position.set(l.pos[0], l.pos[1], l.pos[2])
      dummy.scale.set(l.scale, l.scale * 0.62, l.scale)
      dummy.rotation.set(seededRandom(i * 3.7 + 91) * 0.6, seededRandom(i * 5.3 + 92) * Math.PI, 0)
      dummy.updateMatrix()
      leafMesh.setMatrixAt(i, dummy.matrix)
      // 按物种基色 + shade 明暗
      tmpC.set(SPECIES_COLORS[l.species])
      tmpC.offsetHSL(0, 0, (l.shade - 1) * 0.28)
      leafMesh.setColorAt(i, tmpC)
    }
    leafMesh.instanceMatrix.needsUpdate = true
    if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true
    leafMesh.castShadow = true
    root.add(leafMesh)
  }

  parent.add(root)
  return {
    root,
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
