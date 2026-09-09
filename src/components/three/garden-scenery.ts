/**
 * garden-scenery.ts — 茶园场景叙事层（零外部模型，全程序化）
 * 1. 茶亭：远处山坡一座小木亭（4 柱 + 攒尖顶 + 台基），原木色
 * 2. 竹篱笆：茶园边缘两段矮篱笆（竖杆 + 横杆），竹青色
 * 3. 石块小径：从近处延伸向茶亭的扁石小路
 *
 * 材质一律 MeshStandardMaterial + 纯色（不透明通道，本渲染管线确定渲染）。
 */
import * as THREE from 'three'
import { getTerrainHeight } from './terrain'

/** 固定种子随机 */
function seededRandom(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

export interface GardenScenery {
  update: (elapsed: number) => void
  dispose: () => void
}

/** 创建茶亭/篱笆/小径并挂到场景（presetId：龙井小径用红棕土色，其他园石板灰；福鼎铺海面） */
export function createScenery(scene: THREE.Scene, presetId = 'hangzhou'): GardenScenery {
  const root = new THREE.Group()
  root.name = 'scenery'
  scene.add(root)

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4e, roughness: 0.85, metalness: 0 })
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x6b4f38, roughness: 0.9, metalness: 0 })
  const bambooMat = new THREE.MeshStandardMaterial({ color: 0x9a945a, roughness: 0.8, metalness: 0 })
  const stoneMat = new THREE.MeshStandardMaterial({ color: presetId === 'hangzhou' ? 0xa0714f : 0x9aa0a8, roughness: 0.95, metalness: 0 })
  const stoneDarkMat = new THREE.MeshStandardMaterial({ color: presetId === 'hangzhou' ? 0x8a5f3e : 0x7c828a, roughness: 0.95, metalness: 0 })

  // ---- 福鼎海面：远景东南向大海（茶园→海滩→海），深蓝不透明 + 白浪条 ----
  if (presetId === 'fuding') {
    const seaMat = new THREE.MeshStandardMaterial({
      color: 0x2a6488,
      roughness: 0.35,
      metalness: 0.12,
    })
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(96, 50), seaMat)
    sea.rotation.x = -Math.PI / 2
    sea.position.set(0, 0.86, -77)
    root.add(sea)
    // 白浪线：沿海面横排断开的浅色细条（风浪感）
    const foamMat = new THREE.MeshStandardMaterial({ color: 0xbfd8e8, roughness: 0.5 })
    const foamGeo = new THREE.BoxGeometry(1.4, 0.05, 0.12)
    const foams = new THREE.InstancedMesh(foamGeo, foamMat, 26)
    const dummy = new THREE.Object3D()
    for (let i = 0; i < 26; i++) {
      const fx = -40 + seededRandom(i * 3.1 + 501) * 80
      const fz = -64 - seededRandom(i * 4.7 + 502) * 26
      dummy.position.set(fx, 0.93 + seededRandom(i * 5.3 + 503) * 0.06, fz)
      dummy.scale.set(2 + seededRandom(i * 6.7 + 504) * 5, 1, 1)
      dummy.rotation.y = seededRandom(i * 7.1 + 505) * 0.3 - 0.15
      dummy.updateMatrix()
      foams.setMatrixAt(i, dummy.matrix)
    }
    root.add(foams)
  }

  // ---- 茶亭：远处山坡一座小木亭（位置贴合地形，不再陷地）----
  const house = new THREE.Group()
  const houseX = -30
  const houseZ = -40
  const houseY = getTerrainHeight(houseX, houseZ)
  // 台基（两层台阶）
  const base1 = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.9, 0.5, 8), stoneMat)
  base1.position.y = 0.25
  const base2 = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, 0.4, 8), stoneDarkMat)
  base2.position.y = 0.7
  house.add(base1, base2)
  // 四根柱子
  const pillarGeo = new THREE.CylinderGeometry(0.16, 0.2, 2.4, 6)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    const p = new THREE.Mesh(pillarGeo, woodMat)
    p.position.set(Math.cos(a) * 1.7, 2.1, Math.sin(a) * 1.7)
    house.add(p)
  }
  // 攒尖顶：四棱锥 + 顶部圆珠
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.6, 4), darkWoodMat)
  roof.position.y = 3.4
  roof.rotation.y = Math.PI / 4
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), darkWoodMat)
  finial.position.y = 4.4
  house.add(roof, finial)
  house.position.set(houseX, houseY, houseZ)
  house.rotation.y = 0.5
  root.add(house)

  // ---- 竹篱笆：两段（近处茶园边 + 茶亭旁），竖杆 + 横杆 ----
  function makeFence(x0: number, z0: number, len: number, rotY: number): THREE.Group {
    const fence = new THREE.Group()
    const n = Math.max(3, Math.floor(len / 2.6))
    for (let i = 0; i < n; i++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.1, 5), bambooMat)
      post.position.set(i * (len / (n - 1)) - len / 2, 0.55, 0)
      fence.add(post)
    }
    const railGeo = new THREE.CylinderGeometry(0.055, 0.055, len, 5)
    const rail1 = new THREE.Mesh(railGeo, bambooMat)
    rail1.position.set(0, 0.85, 0)
    rail1.rotation.z = Math.PI / 2
    const rail2 = new THREE.Mesh(railGeo, bambooMat)
    rail2.position.set(0, 0.38, 0)
    rail2.rotation.z = Math.PI / 2
    fence.add(rail1, rail2)
    fence.position.set(x0, getTerrainHeight(x0, z0), z0)
    fence.rotation.y = rotY
    return fence
  }
  root.add(makeFence(-14, -2, 14, 0.25))
  root.add(makeFence(12, -6, 12, -0.4))
  root.add(makeFence(-26, -36, 10, 0.8))

  // ---- 石块小径：从近处 (6,0,-4) 铺向茶亭方向的扁石 ----
  for (let i = 0; i < 9; i++) {
    const t = i / 8 // 0→1 从近到远
    const x = 6 - 40 * t
    const z = -4 - 34 * t
    const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.55 + seededRandom(i * 2.1 + 131) * 0.4, 0.62 + seededRandom(i * 3.3 + 132) * 0.42, 0.16 + seededRandom(i * 4.7 + 133) * 0.08, 7), i % 3 === 0 ? stoneDarkMat : stoneMat)
    const sx = x + (seededRandom(i * 6.1 + 134) - 0.5) * 0.9
    const sz = z + (seededRandom(i * 8.3 + 135) - 0.5) * 0.9
    stone.position.set(sx, getTerrainHeight(sx, sz) + 0.08, sz)
    stone.rotation.y = seededRandom(i * 9.9 + 136) * Math.PI
    root.add(stone)
  }

  return {
    update(_elapsed: number) {
      // 静态场景，暂无动画
    },
    dispose() {
      root.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        const m = mesh.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(m)) m.forEach((mm) => mm.dispose())
        else m?.dispose()
      })
      root.removeFromParent()
    },
  }
}
