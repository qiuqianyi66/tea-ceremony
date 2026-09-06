<script setup lang="ts">
/**
 * TeaGardenSceneInner — 3D茶园场景内容（TresCanvas 内部）
 * 一期：HDRI环境 + 太阳光 + 雾 + 程序化梯田地形 + OrbitControls
 *
 * TresJS 5 坑：rotation 必须传 [x,y,z] 数组，不能传 Vector3。
 */
import { onMounted, shallowRef } from 'vue'
import { useTresContext } from '@tresjs/core'
import * as THREE from 'three'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

const sceneCtx = useTresContext()

// ============ 程序化噪声（Simplex-like，无需外部库） ============
function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function smoothNoise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const a = hash(ix, iy), b = hash(ix + 1, iy)
  const c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1)
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
}
function fbm(x: number, y: number, octaves = 5): number {
  let value = 0, amplitude = 1, frequency = 1, max = 0
  for (let i = 0; i < octaves; i++) {
    value += smoothNoise(x * frequency, y * frequency) * amplitude
    max += amplitude
    amplitude *= 0.5
    frequency *= 2
  }
  return value / max
}

// ============ 地形生成 ============
const TERRAIN_SIZE = 200
const TERRAIN_SEGMENTS = 200
const TERRAIN_AMPLITUDE = 18

function createTerrainGeometry(): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position!
  const colors = new Float32Array(pos.count * 3)

  // 颜色定义
  const grassColor = new THREE.Color(0x4a6b3a)    // 草地绿
  const grassLight = new THREE.Color(0x5d7e45)    // 亮草绿
  const soilColor = new THREE.Color(0x6b5344)     // 泥土褐
  const rockColor = new THREE.Color(0x7a7570)     // 岩石灰
  const rockDark = new THREE.Color(0x5a5550)      // 深岩

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)

    // 多层噪声生成起伏
    let h = fbm(x * 0.015, z * 0.015, 5) * TERRAIN_AMPLITUDE
    h += fbm(x * 0.04, z * 0.04, 3) * 4
    h -= TERRAIN_AMPLITUDE * 0.4 // 整体下移，留出低处平地

    // 梯田效果：在中低高度范围做量化台阶（模拟茶山梯田）
    const terraceStart = 2
    const terraceEnd = 12
    const terraceStep = 1.8
    if (h > terraceStart && h < terraceEnd) {
      const localH = h - terraceStart
      h = terraceStart + Math.floor(localH / terraceStep) * terraceStep
      // 梯田边缘加一点噪声，避免太规整
      h += (smoothNoise(x * 0.3, z * 0.3) - 0.5) * 0.3
    }

    pos.setY(i, h)

    // 顶点色：按高度混合
    const color = new THREE.Color()
    if (h < 1) {
      // 低处：草地
      color.lerpColors(grassColor, grassLight, smoothNoise(x * 0.1, z * 0.1))
    } else if (h < terraceEnd) {
      // 梯田：草地和泥土混合（梯田面是草，边缘是土）
      const terracePos = ((h - terraceStart) % terraceStep) / terraceStep
      if (terracePos < 0.15) {
        color.copy(soilColor) // 梯田边缘是泥土
      } else {
        color.lerpColors(grassColor, grassLight, smoothNoise(x * 0.15, z * 0.15))
      }
    } else if (h < 15) {
      // 中高：泥土
      color.lerpColors(soilColor, rockDark, (h - terraceEnd) / 3)
    } else {
      // 高处：岩石
      color.lerpColors(rockDark, rockColor, smoothNoise(x * 0.2, z * 0.2))
    }

    // 加一点颜色噪声，避免纯色
    const noise = (smoothNoise(x * 0.5, z * 0.5) - 0.5) * 0.08
    color.r = Math.max(0, Math.min(1, color.r + noise))
    color.g = Math.max(0, Math.min(1, color.g + noise))
    color.b = Math.max(0, Math.min(1, color.b + noise))

    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  return geo
}

const terrainGeo = shallowRef<THREE.PlaneGeometry | null>(null)

onMounted(() => {
  terrainGeo.value = createTerrainGeometry()

  // 加载 HDRI 环境贴图
  const scene = sceneCtx.scene.value
  if (!scene) return

  const rgbeLoader = new RGBELoader()
  rgbeLoader.load(
    '/3d/hdri/kloofendal_2k.hdr',
    (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping
      scene.environment = texture
      scene.background = texture
      scene.backgroundBlurriness = 0.3 // 背景稍微模糊，突出前景
    },
    undefined,
    () => {
      // 加载失败：纯色背景兜底（HDRI是PBR反射的关键，失败后真实感会下降）
      console.warn('[TeaGarden] HDRI 加载失败，使用纯色背景兜底')
      scene.background = new THREE.Color(0x87a5c4)
    }
  )
})
</script>

<template>
  <!-- 雾效：指数雾，远处山朦胧 -->
  <FogExp2 :args="['#a8b8c8', 0.008]" attach="fog" />

  <!-- 太阳光：平行光，带软阴影 -->
  <DirectionalLight
    :position="[40, 60, 30]"
    :intensity="2.5"
    :color="'#fff5e0'"
    :cast-shadow="true"
    :shadow-mapSize-width="2048"
    :shadow-mapSize-height="2048"
    :shadow-camera-near="1"
    :shadow-camera-far="200"
    :shadow-camera-left="-80"
    :shadow-camera-right="80"
    :shadow-camera-top="80"
    :shadow-camera-bottom="-80"
    :shadow-bias="-0.0005"
  />

  <!-- 半球光：天空蓝 + 地面绿，模拟环境漫反射 -->
  <HemisphereLight
    :args="['#b8d4e8', '#3a5a3a', 0.6]"
  />

  <!-- 环境光：补光，避免阴影死黑 -->
  <AmbientLight :intensity="0.2" />

  <!-- 程序化梯田地形 -->
  <Mesh v-if="terrainGeo" :geometry="terrainGeo" :receive-shadow="true">
    <MeshStandardMaterial
      :vertex-colors="true"
      :roughness="0.95"
      :metalness="0"
      :env-map-intensity="0.3"
    />
  </Mesh>

  <!-- 轨道控制器 -->
  <OrbitControls
    :make-default="true"
    :enable-damping="true"
    :damping-factor="0.05"
    :min-distance="8"
    :max-distance="120"
    :max-polar-angle="Math.PI / 2.05"
    :target="[0, 3, 0]"
  />
</template>
