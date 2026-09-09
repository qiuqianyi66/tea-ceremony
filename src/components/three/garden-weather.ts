/**
 * garden-weather.ts — 茶园天气系统（晴天/雨天）
 * 1. 雨丝：InstancedMesh 细长平面，onBeforeCompile 顶点下落（重力+风偏，CPU 零更新）
 * 2. 地面湿润：地形 shader 注入 uWetness（变暗 + 反光增强），雨天渐变
 * 3. 天气状态机：光强/色温/雾密度/曝光/湿润 按目标参数 lerp 平滑过渡（参考 CK42BB procedural-weather 状态机思路）
 *
 * 依据：threejs-precipitation-surfaces 技能 —— 降水必须与地面响应耦合（雨丝 + 湿润是同一事件的两个面）
 */
import * as THREE from 'three'

/** 固定种子随机 */
function seededRandom(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

export type WeatherMode = 'sunny' | 'rain'

interface WeatherTargets {
  sunLight: THREE.DirectionalLight
  ambientLight: THREE.AmbientLight
  fog: THREE.FogExp2 | null
  renderer: THREE.WebGLRenderer
  wetnessUniform: { value: number }
}

interface WeatherParams {
  sunI: number
  sunColor: string
  ambI: number
  fogD: number
  fogColor: string
  exposure: number
  wet: number
}

const PARAMS: Record<WeatherMode, WeatherParams> = {
  sunny: { sunI: 2.5, sunColor: '#fff5e0', ambI: 0.2, fogD: 0.006, fogColor: '#b9cfdf', exposure: 1.12, wet: 0 },
  rain: { sunI: 0.6, sunColor: '#a9bccf', ambI: 0.4, fogD: 0.02, fogColor: '#8fa6ba', exposure: 0.92, wet: 1 },
}

const RAIN_COUNT = 1000
const RAIN_HEIGHT = 40
const RAIN_TOP = 34

const sunColorTmp = new THREE.Color()
const fogColorTmp = new THREE.Color()

/** 创建雨丝 InstancedMesh（顶点 shader 下落，CPU 零更新；Additive 加法混合，走不透明通道可渲染） */
function createRain(): THREE.InstancedMesh {
  const geo = new THREE.PlaneGeometry(0.3, 2.8)
  const mat = new THREE.MeshBasicMaterial({
    color: 0xf2f8ff,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.InstancedMesh(geo, mat, RAIN_COUNT)
  mesh.frustumCulled = false
  mesh.visible = false

  // 每根雨丝的种子（下落速度/相位）+ 初始位置
  const seeds = new Float32Array(RAIN_COUNT)
  const dummy = new THREE.Object3D()
  for (let i = 0; i < RAIN_COUNT; i++) {
    seeds[i] = seededRandom(i * 1.7 + 101)
    dummy.position.set(
      (seededRandom(i * 3.3 + 102) - 0.5) * 180,
      seededRandom(i * 5.1 + 103) * RAIN_HEIGHT,
      (seededRandom(i * 7.7 + 104) - 0.5) * 180,
    )
    dummy.rotation.set(0, 0, 0)
    dummy.scale.setScalar(1)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
  }
  mesh.instanceMatrix.needsUpdate = true
  // 每根雨丝的种子必须作为 instanced attribute 挂到 geometry（而非 mesh）
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1))

  // 顶点 shader：下落 + 风偏（y 循环回绕）；编译后把 uniforms 挂到 material.userData 供逐帧更新
  mat.onBeforeCompile = (shader) => {
    const uTime = { value: 0 }
    const uWindX = { value: 0 }
    shader.uniforms.uTime = uTime
    shader.uniforms.uWindX = uWindX
    mat.userData.rainUniforms = { uTime, uWindX }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uWindX;
        attribute float aSeed;
        varying float vAlpha;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float spd = 30.0 + aSeed * 18.0;
        float fall = mod(uTime * spd + aSeed * 40.0, ${RAIN_HEIGHT.toFixed(1)}) - ${(RAIN_TOP - RAIN_HEIGHT).toFixed(1)};
        transformed.y += fall;
        transformed.x += uWindX * fall * 0.18;
        vAlpha = 0.55 + aSeed * 0.45;`
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying float vAlpha;`
      )
      .replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
        gl_FragColor.a *= vAlpha;`
      )
  }
  // 自定义缓存键，避免多实例共用编译缓存
  mat.customProgramCacheKey = () => 'rain-1'
  return mesh
}

export interface GardenWeather {
  update: (delta: number) => void
  setWeather: (mode: WeatherMode) => void
  getMode: () => WeatherMode
  dispose: () => void
}

/** 创建天气系统 */
export function createWeather(targets: WeatherTargets): GardenWeather {
  const { sunLight, ambientLight, fog, renderer, wetnessUniform } = targets
  const rain = createRain()
  // 挂到太阳光所在场景（主场景）
  const parentScene = sunLight.parent as THREE.Scene | THREE.Object3D | null
  const scene = (parentScene?.type === 'Scene' ? parentScene : undefined) as THREE.Scene | undefined
  if (scene) scene.add(rain)
  else sunLight.add(rain)

  let mode: WeatherMode = 'sunny'
  let from: WeatherParams = PARAMS.sunny
  let to: WeatherParams = PARAMS.sunny
  let t = 1 // 渐变进度 0→1

  function apply(p: WeatherParams): void {
    sunLight.intensity = p.sunI
    sunColorTmp.set(p.sunColor)
    sunLight.color.copy(sunColorTmp)
    ambientLight.intensity = p.ambI
    if (fog) {
      fog.density = p.fogD
      fogColorTmp.set(p.fogColor)
      fog.color.copy(fogColorTmp)
    }
    renderer.toneMappingExposure = p.exposure
    wetnessUniform.value = p.wet
    rain.visible = mode === 'rain'
  }

  function lerpParams(a: WeatherParams, b: WeatherParams, k: number): WeatherParams {
    return {
      sunI: a.sunI + (b.sunI - a.sunI) * k,
      sunColor: b.sunColor,
      ambI: a.ambI + (b.ambI - a.ambI) * k,
      fogD: a.fogD + (b.fogD - a.fogD) * k,
      fogColor: b.fogColor,
      exposure: a.exposure + (b.exposure - a.exposure) * k,
      wet: a.wet + (b.wet - a.wet) * k,
    }
  }

  let disposed = false
  return {
    update(delta: number) {
      if (disposed) return
      if (t < 1) {
        t = Math.min(1, t + delta / 1.6) // 1.6s 平滑过渡
        apply(lerpParams(from, to, t))
      }
      if (mode === 'rain') {
        const time = ((rain.userData.time as number | undefined) ?? 0) + delta
        rain.userData.time = time
        const uniforms = (rain.material as THREE.Material & { userData: { rainUniforms?: Record<string, { value: number }> } }).userData.rainUniforms
        if (uniforms) {
          if (uniforms.uTime) uniforms.uTime.value = time
          if (uniforms.uWindX) uniforms.uWindX.value = 1.6
        }
      }
    },
    setWeather(m: WeatherMode) {
      if (m === mode) return
      from = {
        sunI: sunLight.intensity,
        sunColor: sunLight.color.getStyle(),
        ambI: ambientLight.intensity,
        fogD: fog?.density ?? PARAMS.sunny.fogD,
        fogColor: fog?.color.getStyle() ?? PARAMS.sunny.fogColor,
        exposure: renderer.toneMappingExposure,
        wet: wetnessUniform.value,
      }
      to = PARAMS[m]
      mode = m
      t = 0
    },
    getMode: () => mode,
    dispose() {
      disposed = true
      rain.geometry.dispose()
      ;(rain.material as THREE.Material).dispose()
      rain.removeFromParent()
    },
  }
}
