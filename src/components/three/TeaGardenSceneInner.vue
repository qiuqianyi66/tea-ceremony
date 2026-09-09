<script setup lang="ts">
/**
 * TeaGardenSceneInner — 3D茶园场景内容（TresCanvas 内部）
 * 一期：HDRI环境 + 太阳光 + 雾 + 程序化梯田地形 + OrbitControls
 * 二期：程序化茶树渲染（按生长阶段变化形态，基于plant.id确定性分布）
 * 三期：点击/悬停交互（点击茶树高亮并通知父组件打开详情）
 *
 * TresJS 5 坑：rotation 必须传 [x,y,z] 数组，不能传 Vector3。
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useLoop, useTresContext } from '@tresjs/core'
import { createAmbient } from './garden-ambient'
import { createAnimals } from './garden-animals'
import { createScenery } from './garden-scenery'
import { createWeather, type WeatherMode } from './garden-weather'
import { createAmbientAudio, type AmbientAudio } from './ambient-audio'
import { createTeaField } from './tea-field'
import { createTerrainGeometry, getTerrainHeight, fbm, smoothNoise, setTerrainPreset } from './terrain'
import { getGardenPreset } from './garden-presets'
import {
  seededRandom,
  STAGE_VISUALS,
  type StageVisual,
  type LeafBlade,
  type PlantVisual,
  getPlantPosition,
  getLeafBlades,
  createLeafBladeTexture,
  createBarkTexture,
  buildLeafClusters,
} from './tea-plant'
import { createDecorations } from './garden-ecology'
import { OrbitControls } from '@tresjs/cientos'
import type { PointerEvent as TresPointerEvent } from '@pmndrs/pointer-events'
import * as THREE from 'three'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { getGrowthStage } from '@/services/garden'
import type { PlantedTea } from '@/types/garden'

const props = defineProps<{
  plants: PlantedTea[]
  /** 茶园地区 id（四茶园差异化场景；缺省 = 杭州龙井） */
  regionId?: string

}>()

/** 当前茶园预设（四茶园差异化：地形/土壤/雾/天空/茶行/装饰） */
const gardenPreset = getGardenPreset(props.regionId)

const emit = defineEmits<{
  'select-plant': [id: number]
}>()


const sceneCtx = useTresContext()
/** 六期：OrbitControls 实例引用（DEV 调试钩子暴露，供自动化特写/验证） */
const controlsRef = ref<InstanceType<typeof OrbitControls> | null>(null)
const sunLightRef = ref<THREE.DirectionalLight | null>(null)
const ambientLightRef = ref<THREE.AmbientLight | null>(null)

// 地面湿润度（雨天渐变，地形 shader 读取；天气模块写入）
const wetnessUniform = { value: 0 }

/** 四期：渲染函数替换（后处理接管渲染循环）；五期：粒子动画钩子 */
const { render: replaceRender, onBeforeRender } = useLoop()
let ambientLayer: ReturnType<typeof createAmbient> | null = null
let animalsLayer: ReturnType<typeof createAnimals> | null = null
let sceneryLayer: ReturnType<typeof createScenery> | null = null
let weatherLayer: ReturnType<typeof createWeather> | null = null
let teaFieldLayer: ReturnType<typeof createTeaField> | null = null
let audioLayer: AmbientAudio | null = null
let currentWeather: WeatherMode = 'sunny'
let audioEnabled = false

onBeforeRender(({ delta, elapsed }) => {
  updateWater(delta)
  ambientLayer?.update(elapsed, delta)
  animalsLayer?.update(elapsed)
  sceneryLayer?.update(elapsed)
  weatherLayer?.update(delta)
  // 风动：叶簇整簇轻微摇摆（绕组原点，树干不动；幅度 ~2°，微风感）
  for (const [id, g] of leafClusterByPlant) {
    g.rotation.z = Math.sin(elapsed * 0.8 + id * 1.7) * 0.035
    g.rotation.x = Math.sin(elapsed * 0.55 + id * 2.3) * 0.02
  }
})

// ============ 程序化噪声（Simplex-like，无需外部库） ============
/** 程序化"万里晴空"背景：Equirect 球面渐变（天顶蔚蓝 → 地平线浅蓝白） */
function createSkyTexture(sky: [string, string, string, string, string] = gardenPreset.sky): THREE.CanvasTexture {
  const w = 64
  const h = 256
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d 不可用')
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, sky[0]) // 天顶：蔚蓝
  g.addColorStop(0.32, sky[1]) // 高天：明蓝
  g.addColorStop(0.62, sky[2]) // 中天：浅蓝
  g.addColorStop(0.85, sky[3]) // 低空：蓝白
  g.addColorStop(1, sky[4]) // 地平线：近白
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  // 近地平线加一层淡淡晨光暖白（云朵下缘光感）
  const glow = ctx.createLinearGradient(0, h * 0.78, 0, h)
  glow.addColorStop(0, 'rgba(255,255,255,0)')
  glow.addColorStop(1, 'rgba(255,246,230,0.9)')
  ctx.fillStyle = glow
  ctx.fillRect(0, h * 0.78, w, h * 0.22)
  const tex = new THREE.CanvasTexture(canvas)
  tex.mapping = THREE.EquirectangularReflectionMapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// ============ 地形生成（古籍山场逻辑，实现在 ./terrain.ts） ============
// 顶层激活茶园预设（terrainGeo 生成前必须完成，茶行/种茶/装饰都依赖地形带）
setTerrainPreset(gardenPreset)
const terrainGeo = createTerrainGeometry()
const terrainMeshRef = ref<THREE.Mesh | null>(null)

// ============ 六期写实化：程序化叶片 / 树皮贴图（同步生成，全局复用，实现见 tea-plant.ts） ============
const leafBladeTexture = createLeafBladeTexture()
const barkTexture = createBarkTexture()

// ============ 茶树渲染（二期，实现见 tea-plant.ts） ============

const plantVisuals = computed<PlantVisual[]>(() => {
  return props.plants.map(plant => {
    const stage = plant.status === 'dead' ? 'dead' : getGrowthStage(plant)
    const config: StageVisual = STAGE_VISUALS[stage] ?? STAGE_VISUALS.growing!
    const seed = (plant.id ?? 0) * 1000 + plant.teaId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const position = getPlantPosition(seed)
    const crownY = config.trunkHeight * config.scale
    const blades = getLeafBlades(seed, config.leafCount, config.crownRadius, crownY, config.leafColor)
    const rotationY = seededRandom(seed + 99) * Math.PI * 2
    const plantId = plant.id ?? 0
    return {
      id: plantId,
      position,
      rotation: [0, rotationY, 0] as [number, number, number],
      trunkPos: [0, config.trunkHeight * config.scale / 2, 0] as [number, number, number],
      glowPos: config.hasGlow
        ? [0, config.trunkHeight * config.scale + 0.45, 0] as [number, number, number]
        : null,
      hitPos: [0, config.trunkHeight * config.scale * 0.6, 0] as [number, number, number],
      hitRadius: Math.max(1.1, config.crownRadius * config.scale * 1.6),
      hitUserData: { plantId },
      config,
      blades,
      rotationY,
    }
  })
})

// ============ 点击 / 悬停交互（三期） ============

const hoveredPlantId = ref<number | null>(null)
const selectedPlantId = ref<number | null>(null)

function onPlantOver(id: number): void {
  hoveredPlantId.value = id
}

function onPlantOut(id: number): void {
  if (hoveredPlantId.value === id) hoveredPlantId.value = null
}

function onPlantClick(id: number): void {
  selectedPlantId.value = id
  emit('select-plant', id)
}

/** 从事件对象 userData 中取 plantId（事件处理器必须用稳定引用，避免 TresJS 反复重绑导致渲染循环） */
function getEventPlantId(e: TresPointerEvent): number | undefined {
  const raw = (e.object as THREE.Object3D | undefined)?.userData?.plantId
  return typeof raw === 'number' ? raw : undefined
}

function onPlantOverEvent(e: TresPointerEvent): void {
  const id = getEventPlantId(e)
  if (id !== undefined) onPlantOver(id)
}

function onPlantOutEvent(e: TresPointerEvent): void {
  const id = getEventPlantId(e)
  if (id !== undefined) onPlantOut(id)
}

function onPlantClickEvent(e: TresPointerEvent): void {
  const id = getEventPlantId(e)
  if (id !== undefined) onPlantClick(id)
}

/** 悬停/选中时整体放大，提示可交互 */
function getPlantScale(id: number): number {
  return hoveredPlantId.value === id || selectedPlantId.value === id ? 1.15 : 1
}


// ============ 六期写实化：地形 PBR 材质（三贴图按高度混合） ============

/**
 * 给地形材质注入三张真实贴图（Poly Haven CC0）：
 * 低处草地 → 梯田泥土 → 高处岩石，按世界高度 smoothstep 混合，
 * 顶点色保留为明暗系数参与调制。
 */
function applyTerrainTextures(
  material: THREE.MeshStandardMaterial,
  textures: { grass: THREE.Texture; mud: THREE.Texture; rock: THREE.Texture; grassNormal: THREE.Texture },
  wetness: { value: number }
): void {
  // 平铺采样：三张贴图必须 RepeatWrapping，否则 UV×N 超出 1 的部分被边缘像素 clamp 平铺
  for (const t of [textures.grass, textures.mud, textures.rock, textures.grassNormal]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
  }
  material.map = textures.grass
  material.normalMap = textures.grassNormal
  material.normalScale = new THREE.Vector2(0.9, 0.9)
  material.needsUpdate = true

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTexGrass = { value: textures.grass }
    shader.uniforms.uTexMud = { value: textures.mud }
    shader.uniforms.uTexRock = { value: textures.rock }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWorldPos;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;`
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uTexGrass;
        uniform sampler2D uTexMud;
        uniform sampler2D uTexRock;
        uniform float uWetness;
        varying vec3 vWorldPos;`
      )
      .replace(
        '#include <map_fragment>',
        `vec4 texGrass = texture2D(uTexGrass, vMapUv * 10.0);
        vec4 texMud = texture2D(uTexMud, vMapUv * 7.0);
        vec4 texRock = texture2D(uTexRock, vMapUv * 5.0);
        float terrH = vWorldPos.y;
        float tMud = smoothstep(2.0, 6.0, terrH) * 0.38;   // 草地 → 梯田泥（茶园区草皮为主）
        float tRock = smoothstep(12.0, 16.0, terrH);       // 梯田 → 高处裸岩
        vec3 terrMix = mix(texGrass.rgb, texMud.rgb, tMud);
        terrMix = mix(terrMix, texRock.rgb, tRock);
        vec4 sampledDiffuseColor = vec4(terrMix, 1.0);
        #ifdef USE_COLOR
          sampledDiffuseColor.rgb *= vColor.rgb; // 顶点色明暗系数（r185: vColor 为 vec4）
        #endif
        sampledDiffuseColor.rgb *= (1.0 - uWetness * 0.3); // 雨天地面湿润变暗
        diffuseColor *= sampledDiffuseColor;`
      )
    shader.uniforms.uWetness = wetness // 共享对象引用，运行时 wetness.value 变化实时生效
  }
}

// ============ 六期写实化：叶簇层（真实叶片 InstancedMesh） ============

/** 每棵树一个叶簇 Group（含 1 个叶片 InstancedMesh），100 树 ≈ 100 draw call（原 900 球大幅减少） */
const leafClusterRoot = ref<THREE.Group | null>(null)
const leafClusterByPlant = new Map<number, THREE.Group>()

/** 重建全部叶簇（plants 增删/阶段变化时调用；共享几何与材质，只重建实例矩阵） */
function rebuildLeafClusters(scene: THREE.Scene): void {
  const oldRoot = leafClusterRoot.value
  if (oldRoot) {
    oldRoot.removeFromParent()
    oldRoot.traverse(o => { if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose() })
  }
  leafClusterByPlant.clear()
  const layer = buildLeafClusters(scene, plantVisuals.value, leafBladeTexture)
  leafClusterRoot.value = layer.root
  for (const [id, g] of layer.byPlant) leafClusterByPlant.set(id, g)
}

/** 悬停/选中时对应叶簇同步放大（与模板 Group scale 一致） */
function syncLeafClusterScale(): void {
  const s = (id: number) => hoveredPlantId.value === id || selectedPlantId.value === id ? 1.15 : 1
  for (const [id, g] of leafClusterByPlant) g.scale.setScalar(s(id))
}

watch([hoveredPlantId, selectedPlantId], syncLeafClusterScale)

// ============ 装饰植被（四期） ============

// ============ 后处理（四期：SSAO + Bloom） ============

/** 组装后处理管线：RenderPass → SSAO（桌面）→ Bloom → OutputPass（ACES 色调映射） */
function setupPostProcessing(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  sizes: { width: () => number; height: () => number }
): { composer: EffectComposer; dispose: () => void } {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))

  let ssao: SSAOPass | null = null
  if (!isMobile) {
    ssao = new SSAOPass(scene, camera, sizes.width(), sizes.height())
    // 柔和 AO：中等采样半径，深度范围取场景尺度（避免近处全黑）
    ssao.kernelRadius = 0.6
    ssao.minDistance = 0.005
    ssao.maxDistance = 0.12
    composer.addPass(ssao)
  }

  // Bloom：阈值 1.3（HDR 亮度），只让成熟新芽（emissive 2.5）等强发光点辉光，
  // 普通叶子与环境反光不发光（避免场景整体泛光发晕）
  const bloom = new UnrealBloomPass(new THREE.Vector2(sizes.width(), sizes.height()), 0.35, 0.6, 1.3)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  const onResize = () => {
    composer.setSize(sizes.width(), sizes.height())
    if (ssao) ssao.setSize(sizes.width(), sizes.height())
  }
  window.addEventListener('resize', onResize)
  return {
    composer,
    dispose: () => window.removeEventListener('resize', onResize),
  }
}

// ============ 浇水水滴粒子（五期：点击浇水后的视觉反馈） ============

const WATER_PARTICLE_COUNT = 80
const WATER_MAX_LIFE = 1.2 // 秒
const WATER_GRAVITY = 7

interface WaterState {
  t: number
  maxT: number
  velocities: Float32Array
}

const waterPoints = ref<THREE.Points | null>(null)
const waterState = ref<WaterState | null>(null)

/** 创建水滴粒子系统（Points，蓝色半透明，一次性池化复用） */
function createWaterPoints(): THREE.Points {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WATER_PARTICLE_COUNT * 3), 3))
  // 注意：transparent:true 在本渲染管线不渲染，用不透明圆点 + 整体淡出
  const mat = new THREE.PointsMaterial({
    color: 0x9fdcff,
    size: 0.55,
    depthWrite: false,
  })
  const points = new THREE.Points(geo, mat)
  points.visible = false
  points.frustumCulled = false
  return points
}

/** 在指定茶树上方播放下雨粒子（不改变任何状态机，纯视觉反馈） */
function playWater(plantId: number): void {
  const points = waterPoints.value
  if (!points || waterState.value) return
  const pv = plantVisuals.value.find(p => p.id === plantId)
  if (!pv) return
  const pos = points.geometry.attributes.position as THREE.BufferAttribute
  const velocities = new Float32Array(WATER_PARTICLE_COUNT * 3)
  const [px, py, pz] = pv.position
  for (let i = 0; i < WATER_PARTICLE_COUNT; i++) {
    const angle = seededRandom(i * 5.3 + 2) * Math.PI * 2
    const r = 0.5 + seededRandom(i * 3.7 + 1) * 1.1
    pos.setXYZ(
      i,
      px + Math.cos(angle) * r * 0.5,
      py + 1.6 + seededRandom(i * 7.1 + 3) * 0.9,
      pz + Math.sin(angle) * r * 0.5
    )
    velocities[i * 3] = (seededRandom(i * 11.3 + 4) - 0.5) * 1.4
    velocities[i * 3 + 1] = 0
    velocities[i * 3 + 2] = (seededRandom(i * 13.7 + 5) - 0.5) * 1.4
  }
  pos.needsUpdate = true
  waterState.value = { t: 0, maxT: WATER_MAX_LIFE, velocities }
  points.visible = true
}

/** 每帧更新水滴：重力下落 + 整体淡出 */
function updateWater(delta: number): void {
  const points = waterPoints.value
  const state = waterState.value
  if (!points || !state) return
  state.t += delta
  if (state.t >= state.maxT) {
    points.visible = false
    waterState.value = null
    return
  }
  const pos = points.geometry.attributes.position as THREE.BufferAttribute
  const vel = state.velocities
  for (let i = 0; i < WATER_PARTICLE_COUNT; i++) {
    const idx = i * 3
    vel[idx + 1] = (vel[idx + 1] ?? 0) - WATER_GRAVITY * delta
    pos.setXYZ(
      i,
      pos.getX(i) + (vel[idx] ?? 0) * delta,
      pos.getY(i) + (vel[idx + 1] ?? 0) * delta,
      pos.getZ(i) + (vel[idx + 2] ?? 0) * delta
    )
  }
  pos.needsUpdate = true
  ;(points.material as THREE.PointsMaterial).opacity = 0.9 * (1 - state.t / state.maxT)
}

defineExpose({ playWater, setWeather, setAudioEnabled })

/** 切换天气（晴天/雨天），由 GardenView 按钮触发 */
function setWeather(mode: WeatherMode): void {
  currentWeather = mode
  weatherLayer?.setWeather(mode)
  // 晨雾为雨天专属（晴天"万里晴空"；雾带在晴天蓝天下会成"白色地块"）
  ambientLayer?.setFogVisible(mode === 'rain')
  // 音效联动：雨天雨声强度跟随
  audioLayer?.setRainIntensity(mode === 'rain' ? 1 : 0)
}

/** 环境音效开关（需用户手势，AudioContext 在此启动） */
function setAudioEnabled(on: boolean): void {
  audioEnabled = on
  audioLayer?.setEnabled(on)
}

// ============ HDRI 环境加载 ============
onMounted(() => {
  const scene = sceneCtx.scene.value
  if (!scene) return

  // DEV 调试钩子：暴露场景与茶树列表，便于自动化验证与排查
  if (import.meta.env.DEV) {
    const w = window as unknown as Record<string, unknown>
    w.__teaGarden = {
      scene: () => sceneCtx.scene.value,
      plantVisuals: () => plantVisuals.value,
      activeCamera: () => sceneCtx.camera.activeCamera,
      controls: () => controlsRef.value,
      THREE,
    }
  }

  // 六期：ACES 电影级色调映射 + 柔和软阴影（真实感光照）
  const renderer = sceneCtx.renderer.instance as unknown as THREE.WebGLRenderer
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.12
  renderer.shadowMap.type = THREE.PCFShadowMap

  // 六期：加载 Poly Haven 真实地形贴图（CC0）并应用到地形材质
  const texLoader = new THREE.TextureLoader()
  Promise.all([
    texLoader.loadAsync('/3d/textures/terrain/aerial_grass_rock_diff_2k.jpg'),
    texLoader.loadAsync('/3d/textures/terrain/brown_mud_dry_diff_2k.jpg'),
    texLoader.loadAsync('/3d/textures/terrain/rock_ground_02_diff_2k.jpg'),
    texLoader.loadAsync('/3d/textures/terrain/aerial_grass_rock_nor_gl_2k.jpg'),
  ])
    .then(([grass, mud, rock, grassNormal]) => {
      grass.colorSpace = THREE.SRGBColorSpace
      mud.colorSpace = THREE.SRGBColorSpace
      rock.colorSpace = THREE.SRGBColorSpace
      grassNormal.colorSpace = THREE.NoColorSpace
      const terrain = terrainMeshRef.value
      if (terrain) {
        applyTerrainTextures(terrain.material as THREE.MeshStandardMaterial, { grass, mud, rock, grassNormal }, wetnessUniform)
      }
    })
    .catch((error: unknown) => {
      console.warn('[TeaGarden] 地形贴图加载失败，回退程序化着色:', error)
    })

  // 四期：装饰植被（石头 + 草 + 野花）挂到场景（密度随茶园预设）
  createDecorations(scene, gardenPreset)

  // 六期：真实叶片叶簇层（初始挂载 + 后续 plants 变化时重建）
  rebuildLeafClusters(scene)
  watch(plantVisuals, () => { rebuildLeafClusters(scene) })

  // 五期：浇水水滴粒子系统挂到场景
  const wp = createWaterPoints()
  scene.add(wp)
  waterPoints.value = wp

  // 活茶园：环境氛围层（云朵/晨雾） + 小动物（蝴蝶/蜜蜂/飞鸟）
  const activeCam2 = sceneCtx.camera.activeCamera as unknown
  const camRef2 = ((activeCam2 as { value?: THREE.PerspectiveCamera }).value ?? activeCam2) as THREE.PerspectiveCamera
  ambientLayer = createAmbient(scene, camRef2)
  animalsLayer = createAnimals(scene)
  sceneryLayer = createScenery(scene)
  // 古籍茶园：南坡成垄茶行 + 上缘遮阴树（《茶经》阳崖阴林 /《茶解》丛生成行）
  teaFieldLayer = createTeaField(scene, gardenPreset)
  // 天气系统（晴天/雨天：雨丝 + 地面湿润 + 光照/雾联动）
  const sun = sunLightRef.value
  const amb = ambientLightRef.value
  if (sun && amb) {
    weatherLayer = createWeather({
      sunLight: sun,
      ambientLight: amb,
      fog: (scene.fog as THREE.FogExp2 | null) ?? null,
      renderer,
      wetnessUniform,
    }, gardenPreset)
  }
  // 环境音效（WebAudio 合成，默认静音，需用户手势后开启）
  audioLayer = createAmbientAudio()

  // 四期：后处理管线（SSAO + Bloom），用 useLoop().render 接管渲染循环
  const activeCam = sceneCtx.camera.activeCamera as unknown
  const cam = ((activeCam as { value?: THREE.PerspectiveCamera }).value ?? activeCam) as THREE.PerspectiveCamera
  const { composer, dispose } = setupPostProcessing(renderer, scene, cam, {
    width: () => sceneCtx.sizes.width.value,
    height: () => sceneCtx.sizes.height.value,
  })
  replaceRender(() => { composer.render() })
  onUnmounted(() => {
    dispose()
    ambientLayer?.dispose()
    animalsLayer?.dispose()
    sceneryLayer?.dispose()
    weatherLayer?.dispose()
    teaFieldLayer?.dispose()
    audioLayer?.dispose()
  })

  const rgbeLoader = new RGBELoader()
  rgbeLoader.load(
    '/3d/hdri/kloofendal_2k.hdr',
    (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping
      // HDRI 只做环境反射（PBR 材质质感），背景用程序化"蓝天白云"渐变球
      scene.environment = texture
      // 压环境强度：HDRI 太阳亮斑被物体反射 + Bloom 放大 = 用户多次反馈的"右侧刺眼白光"
      scene.environmentIntensity = 0.3
      scene.background = createSkyTexture()
      scene.backgroundBlurriness = 0.3
    },
    undefined,
    () => {
      console.warn('[TeaGarden] HDRI 加载失败，使用纯色背景兜底')
      scene.background = createSkyTexture()
    }
  )
})
</script>

<template>
  <!-- 相机：近景俯视中央茶园 -->
  <PerspectiveCamera
    :make-default="true"
    :position="[30, 23, 30]"
    :fov="50"
    :near="0.1"
    :far="500"
  />

  <!-- 雾效：晴天淡蓝白雾（远处山朦胧），雨天由天气状态机调浓 -->
  <FogExp2 :args="[gardenPreset.fogColor, gardenPreset.fogDensity]" attach="fog" />

  <!-- 太阳光：平行光，带软阴影 -->
  <DirectionalLight
    ref="sunLightRef"
    :position="[40, 60, 30]"
    :intensity="gardenPreset.sunIntensity"
    :color="gardenPreset.sunColor"
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
  <HemisphereLight :args="['#b8d4e8', '#3a5a3a', 0.6]" />

  <!-- 环境光：补光，避免阴影死黑 -->
  <AmbientLight ref="ambientLightRef" :intensity="0.2" />

  <!-- 六期：程序化梯田地形（真实 PBR 贴图在 onMounted 异步加载后注入） -->
  <Mesh ref="terrainMeshRef" :geometry="terrainGeo" :receive-shadow="true">
    <MeshStandardMaterial
      :vertex-colors="true"
      :roughness="0.9"
      :metalness="0"
      :env-map-intensity="0.35"
    />
  </Mesh>

  <!-- 茶树（二期：程序化模型，按生长阶段变化；三期：点击/悬停交互） -->
  <Group
    v-for="plant in plantVisuals"
    :key="plant.id"
    :position="plant.position"
    :rotation="plant.rotation"
    :scale="getPlantScale(plant.id)"
  >
    <!-- 枝干（六期：粗糙树皮贴图，取代纯色） -->
    <Mesh
      :cast-shadow="true"
      :position="plant.trunkPos"
    >
      <CylinderGeometry
        :args="[
          plant.config.trunkRadius * plant.config.scale * 0.55,
          plant.config.trunkRadius * plant.config.scale,
          plant.config.trunkHeight * plant.config.scale,
          10
        ]"
      />
      <MeshStandardMaterial
        :map="barkTexture"
        :bump-map="barkTexture"
        :bump-scale="0.6"
        :roughness="0.95"
      />
    </Mesh>

    <!-- 叶簇（六期：真实叶片卡片，由 buildLeafClusters 编程层 InstancedMesh 渲染，
         这里不再渲染球体叶子；叶簇随 Group 一起参与悬停/选中缩放） -->

    <!-- 成熟茶树：顶部发光新芽 -->
    <Mesh
      v-if="plant.glowPos"
      :position="plant.glowPos"
    >
      <SphereGeometry :args="[0.13, 10, 10]" />
      <MeshStandardMaterial
        :color="'#c5e1a5'"
        :emissive="'#7cb342'"
        :emissive-intensity="2.5"
      />
    </Mesh>

    <!-- 透明点击包围球（只做拾取，不渲染；事件用稳定函数引用避免渲染循环） -->
    <Mesh
      :position="plant.hitPos"
      :user-data="plant.hitUserData"
      @click="onPlantClickEvent"
      @pointer-over="onPlantOverEvent"
      @pointer-out="onPlantOutEvent"
    >
      <SphereGeometry :args="[plant.hitRadius, 10, 10]" />
      <MeshBasicMaterial
        :transparent="true"
        :opacity="0"
        :depth-write="false"
        :color-write="false"
      />
    </Mesh>
  </Group>

  <!-- 轨道控制器（cientos 组件，内部已处理 camera/domElement） -->
  <OrbitControls
    ref="controlsRef"
    :make-default="true"
    :enable-damping="true"
    :damping-factor="0.05"
    :min-distance="8"
    :max-distance="120"
    :max-polar-angle="Math.PI / 2.05"
    :target="[0, 3, 0]"
  />
</template>











