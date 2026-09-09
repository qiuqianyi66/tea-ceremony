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
import type { GardenPreset } from './garden-presets'
import { GARDEN_PRESETS, DEFAULT_PRESET } from './garden-presets'

/** 装饰物定位：随机采样地形高度，命中目标土壤带即返回（福鼎海湾内不撒） */
function getDecorPosition(seedIdx: number, minH: number, maxH: number): [number, number, number] {
  for (let attempt = 0; attempt < 24; attempt++) {
    const x = (seededRandom(seedIdx * 37.1 + attempt * 3.3 + 1) - 0.5) * 70
    const z = (seededRandom(seedIdx * 53.7 + attempt * 5.1 + 2) - 0.5) * 70
    if (z < -52 && Math.abs(x) < 44) continue // 福鼎海湾留空
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

/** 创建装饰植被并挂到场景（密度/分带随茶园预设） */
export function createDecorations(scene: THREE.Scene, preset?: GardenPreset): void {
  const p = preset ?? DEFAULT_PRESET
  const decorGroup = new THREE.Group()
  decorGroup.name = 'decorations'

  // --- 石头（古籍分带）：高坡烂石带露头大石 + 谷底溪石；砾壤带（茶园）不留石 ---
  const rockGeo = createRockGeometry()
  const rockMat = new THREE.MeshStandardMaterial({
    color: p.id === 'fuding' ? 0xa8adb5 : 0x8a8580, // 福鼎太姥山花岗岩亮灰
    roughness: 0.95,
    flatShading: true,
  })
  for (let i = 0; i < p.rockCount; i++) {
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
  const grass = new THREE.InstancedMesh(grassGeo, grassMat, p.grassCount)
  const dummy = new THREE.Object3D()
  const tmpColor = new THREE.Color()
  for (let i = 0; i < p.grassCount; i++) {
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
  const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, p.flowerCount)
  const flowerPalette = [0xf4e28d, 0xf4b8d0, 0xe8e3f2, 0xf2b88d, 0xd9e8b8]
  for (let i = 0; i < p.flowerCount; i++) {
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

  // ---- 武夷崖壁生态（丹霞）：苔藓地衣覆岩 + 岩生灌木（habitat：只长烂石带 10-15） ----
  if (p.id === 'wuyishan') {
    // 丹霞崖壁带：主峰（0,-14）腰 9-24m 竖立红岩层露头（赤壁感：大片竖片插坡，稀而大）
    const cliffGeo = new THREE.BoxGeometry(1, 0.5, 1)
    const cliffMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, flatShading: true })
    const cliffPalette = [0x8a4b3c, 0x7d4536, 0x8f5142]
    const cliffCount = 130
    const cliffs = new THREE.InstancedMesh(cliffGeo, cliffMat, cliffCount)
    let placed = 0
    for (let i = 0; i < cliffCount * 4; i++) {
      if (placed >= cliffCount) break
      const ang = seededRandom(i * 2.9 + 501) * Math.PI * 2
      const rr = 11 + seededRandom(i * 3.7 + 502) * 7
      const wx = Math.cos(ang) * rr
      const wz = -14 + Math.sin(ang) * rr
      const wh = getTerrainHeight(wx, wz)
      if (wh < 9 || wh > 24) continue
      const s = 2.6 + seededRandom(i * 5.3 + 503) * 2.4
      dummy.position.set(wx, wh - s * 0.3, wz) // 根部埋入坡面
      dummy.scale.set(s * (0.9 + seededRandom(i * 6.1 + 504) * 0.4), s * (0.8 + seededRandom(i * 6.7 + 509) * 0.8), s * 0.22) // 竖立岩片
      dummy.rotation.set(
        (seededRandom(i + 505) - 0.5) * 0.3,
        seededRandom(i + 506) * Math.PI,
        0.9 + (seededRandom(i + 507) - 0.5) * 0.9, // 25°-80° 斜插坡面（岩层露头，非平铺地砖）
      )
      dummy.updateMatrix()
      cliffs.setMatrixAt(placed, dummy.matrix)
      tmpColor.setHex(cliffPalette[Math.floor(seededRandom(i * 4.7 + 508) * cliffPalette.length)] ?? 0x8a4b3c)
      cliffs.setColorAt(placed, tmpColor)
      placed++
    }
    if (cliffs.instanceColor) cliffs.instanceColor.needsUpdate = true
    cliffs.castShadow = true
    cliffs.receiveShadow = true
    decorGroup.add(cliffs)

    // 苔藓/地衣垫：扁球贴岩面，深绿-灰绿（岩背阴湿处）
    const mossGeo = new THREE.IcosahedronGeometry(0.35, 0)
    const mossMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true })
    const mossCount = 240
    const moss = new THREE.InstancedMesh(mossGeo, mossMat, mossCount)
    const mossPalette = [0x4a5d3a, 0x5c6b4f, 0x3f5240, 0x6b7355]
    for (let i = 0; i < mossCount; i++) {
      const [x, h, z] = getDecorPosition(i + 900, 15.5, 26) // 峰顶岩面苔藓（更高处，与崖壁带分层）
      dummy.position.set(x, h - 0.08, z)
      const s = 0.5 + seededRandom(i * 2.3 + 21) * 0.9
      dummy.scale.set(s, s * 0.28, s)
      dummy.rotation.set(0, seededRandom(i + 31) * Math.PI, (seededRandom(i + 33) - 0.5) * 0.4)
      dummy.updateMatrix()
      moss.setMatrixAt(i, dummy.matrix)
      tmpColor.setHex(mossPalette[Math.floor(seededRandom(i * 4.1 + 24) * mossPalette.length)] ?? 0x4a5d3a)
      moss.setColorAt(i, tmpColor)
    }
    if (moss.instanceColor) moss.instanceColor.needsUpdate = true
    moss.receiveShadow = true
    decorGroup.add(moss)

    // 岩生灌木：石隙小灌丛（比草大、暗绿、贴崖壁）
    const shrubGeo = new THREE.ConeGeometry(0.14, 0.9, 5)
    shrubGeo.translate(0, 0.45, 0)
    const shrubMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true })
    const shrubCount = 70
    const shrubs = new THREE.InstancedMesh(shrubGeo, shrubMat, shrubCount)
    for (let i = 0; i < shrubCount; i++) {
      const [x, h, z] = getDecorPosition(i + 1300, 9.6, 14.5)
      dummy.position.set(x, h, z)
      const s = 0.7 + seededRandom(i * 3.7 + 34) * 1.2
      dummy.scale.set(s, s, s)
      dummy.rotation.set(0, seededRandom(i + 44) * Math.PI, (seededRandom(i + 46) - 0.5) * 0.25)
      dummy.updateMatrix()
      shrubs.setMatrixAt(i, dummy.matrix)
      tmpColor.setHSL(0.22 + seededRandom(i * 5.1 + 47) * 0.05, 0.35, 0.22 + seededRandom(i * 6.3 + 48) * 0.12)
      shrubs.setColorAt(i, tmpColor)
    }
    if (shrubs.instanceColor) shrubs.instanceColor.needsUpdate = true
    shrubs.castShadow = true
    decorGroup.add(shrubs)
  }

  // ---- 勐海雨林林下（腐殖层生态）：蕨类大叶 + 蘑菇 + 苔藓，只长林下阴湿 3-9m ----
  if (p.id === 'yunnan') {
    // 蕨类（大叶蕨丛，林下阴湿）
    const fernGeo = new THREE.ConeGeometry(0.5, 1.8, 5)
    fernGeo.translate(0, 0.9, 0)
    const fernMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true })
    const fernCount = 220
    const ferns = new THREE.InstancedMesh(fernGeo, fernMat, fernCount)
    for (let i = 0; i < fernCount; i++) {
      const [x, h, z] = getDecorPosition(i + 2000, 3.2, 8.8)
      dummy.position.set(x, h, z)
      const s = 0.7 + seededRandom(i * 3.1 + 601) * 1.6
      dummy.scale.set(s, s, s)
      dummy.rotation.set(0, seededRandom(i + 602) * Math.PI, (seededRandom(i + 603) - 0.5) * 0.3)
      dummy.updateMatrix()
      ferns.setMatrixAt(i, dummy.matrix)
      tmpColor.setHSL(0.26 + seededRandom(i * 4.7 + 604) * 0.05, 0.42, 0.2 + seededRandom(i * 5.9 + 605) * 0.12)
      ferns.setColorAt(i, tmpColor)
    }
    if (ferns.instanceColor) ferns.instanceColor.needsUpdate = true
    ferns.castShadow = true
    decorGroup.add(ferns)

    // 腐殖蘑菇（白伞点缀，林下枯枝落叶层）
    const mushroomGeo = new THREE.SphereGeometry(0.13, 7, 4, 0, Math.PI * 2, 0, Math.PI * 0.5)
    const mushroomMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true })
    const mushroomCount = 60
    const mushrooms = new THREE.InstancedMesh(mushroomGeo, mushroomMat, mushroomCount)
    for (let i = 0; i < mushroomCount; i++) {
      const [x, h, z] = getDecorPosition(i + 2400, 2.6, 6.5)
      dummy.position.set(x, h + 0.06, z)
      dummy.scale.setScalar(0.7 + seededRandom(i * 3.7 + 701) * 1.3)
      dummy.rotation.set(0, seededRandom(i + 702) * Math.PI, 0)
      dummy.updateMatrix()
      mushrooms.setMatrixAt(i, dummy.matrix)
      tmpColor.setHSL(0.08 + seededRandom(i * 2.3 + 703) * 0.05, 0.3, 0.82 + seededRandom(i * 4.1 + 704) * 0.12)
      mushrooms.setColorAt(i, tmpColor)
    }
    if (mushrooms.instanceColor) mushrooms.instanceColor.needsUpdate = true
    decorGroup.add(mushrooms)

    // 林下苔藓（暗绿苔垫，树基/洼地）
    const yunMossGeo = new THREE.IcosahedronGeometry(0.3, 0)
    const yunMossMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true })
    const yunMossCount = 180
    const yunMoss = new THREE.InstancedMesh(yunMossGeo, yunMossMat, yunMossCount)
    for (let i = 0; i < yunMossCount; i++) {
      const [x, h, z] = getDecorPosition(i + 2600, 4.2, 9.4)
      dummy.position.set(x, h - 0.06, z)
      const s = 0.5 + seededRandom(i * 2.3 + 801) * 0.9
      dummy.scale.set(s, s * 0.22, s)
      dummy.rotation.set(0, seededRandom(i + 802) * Math.PI, (seededRandom(i + 803) - 0.5) * 0.4)
      dummy.updateMatrix()
      yunMoss.setMatrixAt(i, dummy.matrix)
      tmpColor.setHSL(0.28 + seededRandom(i * 4.1 + 804) * 0.06, 0.35, 0.18 + seededRandom(i * 5.3 + 805) * 0.1)
      yunMoss.setColorAt(i, tmpColor)
    }
    if (yunMoss.instanceColor) yunMoss.instanceColor.needsUpdate = true
    yunMoss.receiveShadow = true
    decorGroup.add(yunMoss)
  }

  scene.add(decorGroup)
}

