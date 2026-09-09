/**
 * garden-ecology.ts — 装饰生态分带（《茶经》土壤三品 /《东溪试茶录》红壤）
 *
 * 烂石带（h>10）：风化岩屑露头大石 —— "上者生烂石"
 * 砾壤带（4-10）：茶行间土埂草 —— 宋代"开畲"留土埂
 * 谷底黄土带（h<4）：杂草地野花 + 溪石 —— "下者生黄土"，不种茶
 */
import * as THREE from 'three'
import { getTerrainHeight } from './terrain'
import { seededRandom } from './tea-plant'

const ROCK_COUNT = 45
const GRASS_COUNT = 420
const FLOWER_COUNT = 90

/** 装饰物定位：随机采样地形高度，命中目标土壤带即返回 */
function getDecorPosition(seedIdx: number, minH: number, maxH: number): [number, number, number] {
  for (let attempt = 0; attempt < 24; attempt++) {
    const x = (seededRandom(seedIdx * 37.1 + attempt * 3.3 + 1) - 0.5) * 70
    const z = (seededRandom(seedIdx * 53.7 + attempt * 5.1 + 2) - 0.5) * 70
    const h = getTerrainHeight(x, z)
    if (h >= minH && h <= maxH) return [x, h, z]
  }
  return [0, minH + 1, 0]
}

/** 生成石头：Dodecahedron 顶点随机位移，程序化圆润石块 */
function createRockGeometry(): THREE.DodecahedronGeometry {
  const geo = new THREE.DodecahedronGeometry(1, 0)
  const pos = geo.attributes.position!
  for (let i = 0; i < pos.count; i++) {
    const n = seededRandom(i * 7.7 + 11) - 0.5
    pos.setXYZ(
      i,
      pos.getX(i) * (1 + n * 0.55),
      pos.getY(i) * (1 + n * 0.4),
      pos.getZ(i) * (1 + n * 0.55)
    )
  }
  geo.computeVertexNormals()
  return geo
}

/** 创建装饰植被并挂到场景（石头独立 Mesh，草/花 InstancedMesh，共 3 个 draw call） */
export function createDecorations(scene: THREE.Scene): void {
  const decorGroup = new THREE.Group()
  decorGroup.name = 'decorations'

  // --- 石头（古籍分带）：高坡烂石带露头大石 + 谷底溪石；砾壤带（茶园）不留石 ---
  const rockGeo = createRockGeometry()
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a8580, roughness: 0.95, flatShading: true })
  for (let i = 0; i < ROCK_COUNT; i++) {
    const upSlope = i % 2 === 0
    const [x, h, z] = upSlope
      ? getDecorPosition(i, 10.2, 14.8) // 烂石带：风化岩屑露头
      : getDecorPosition(i + 700, 0.6, 3.4) // 谷底黄土带：溪石
    const rock = new THREE.Mesh(rockGeo, rockMat)
    const s = (upSlope ? 0.45 : 0.2) + seededRandom(i * 3.3 + 5) * 0.75
    rock.scale.set(s, s * (0.55 + seededRandom(i * 2.1 + 9) * 0.5), s)
    rock.position.set(x, h - s * 0.3, z)
    rock.rotation.set(
      seededRandom(i + 17) * Math.PI,
      seededRandom(i + 23) * Math.PI,
      seededRandom(i + 29) * Math.PI
    )
    decorGroup.add(rock)
  }

  // --- 草簇（砾壤带茶行间土埂草，古籍"开畲"留土埂） ---
  const grassGeo = new THREE.ConeGeometry(0.06, 0.5, 4)
  grassGeo.translate(0, 0.25, 0)
  const grassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true })
  const grass = new THREE.InstancedMesh(grassGeo, grassMat, GRASS_COUNT)
  const dummy = new THREE.Object3D()
  const tmpColor = new THREE.Color()
  for (let i = 0; i < GRASS_COUNT; i++) {
    const [x, h, z] = getDecorPosition(i + 100, 4.2, 9.6)
    dummy.position.set(x, h, z)
    const s = 0.6 + seededRandom(i * 4.7 + 3) * 1.3
    dummy.scale.set(s, s, s)
    dummy.rotation.set(0, seededRandom(i + 41) * Math.PI, (seededRandom(i + 43) - 0.5) * 0.35)
    dummy.updateMatrix()
    grass.setMatrixAt(i, dummy.matrix)
    tmpColor.setHSL(0.25 + seededRandom(i * 1.9 + 2) * 0.07, 0.4, 0.3 + seededRandom(i * 3.1 + 4) * 0.2)
    grass.setColorAt(i, tmpColor)
  }
  if (grass.instanceColor) grass.instanceColor.needsUpdate = true
  decorGroup.add(grass)

  // --- 野花（谷底黄土带杂草地；不种茶的湿地长野花，古法撂荒地相） ---
  const flowerGeo = new THREE.IcosahedronGeometry(0.1, 0)
  const flowerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65, flatShading: true })
  const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, FLOWER_COUNT)
  const flowerPalette = [0xf4e28d, 0xf4b8d0, 0xe8e3f2, 0xf2b88d, 0xd9e8b8]
  for (let i = 0; i < FLOWER_COUNT; i++) {
    const [x, h, z] = getDecorPosition(i + 500, 0.6, 3.8)
    dummy.position.set(x, h + 0.05, z)
    const s = 0.8 + seededRandom(i * 5.9 + 7) * 1.4
    dummy.scale.set(s, s, s)
    dummy.rotation.set(0, seededRandom(i + 61) * Math.PI, 0)
    dummy.updateMatrix()
    flowers.setMatrixAt(i, dummy.matrix)
    tmpColor.setHex(flowerPalette[Math.floor(seededRandom(i * 8.1 + 13) * flowerPalette.length)] ?? 0xf4e28d)
    flowers.setColorAt(i, tmpColor)
  }
  if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true
  decorGroup.add(flowers)

  scene.add(decorGroup)
}
