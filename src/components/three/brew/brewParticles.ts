/**
 * 程序化粒子系统：茶叶粒子（放茶动画）+ 蒸汽粒子（上飘循环）。
 * 从 TeaBrewSceneInner 拆出（2026-10-27）；创建工厂，组件持有返回对象并逐帧驱动。
 */
import * as THREE from 'three'

export interface TeaLeavesSystem {
  points: THREE.Points
  velocities: THREE.Vector3[]
}

/** 茶叶粒子（放茶动画：从盖碗上方落入的 80 个绿色粒子）。 */
export function createTeaLeaves(
  count: number,
  gaiwanPos: THREE.Vector3,
  setZ: number,
): TeaLeavesSystem {
  const positions = new Float32Array(count * 3)
  const velocities: THREE.Vector3[] = []
  for (let i = 0; i < count; i++) {
    positions[i * 3] = gaiwanPos.x + 0.2 + (Math.random() - 0.5) * 0.3
    positions[i * 3 + 1] = gaiwanPos.y + 0.8 + Math.random() * 0.1
    positions[i * 3 + 2] = setZ + (Math.random() - 0.5) * 0.2
    velocities.push(
      new THREE.Vector3(
        (Math.random() - 0.5) * 0.3,
        -0.5 - Math.random() * 0.5,
        (Math.random() - 0.5) * 0.2,
      ),
    )
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const mat = new THREE.PointsMaterial({
    color: '#5a7a3a',
    size: 0.03,
    transparent: true,
    opacity: 0.9,
  })
  const points = new THREE.Points(geo, mat)
  points.visible = false
  return { points, velocities }
}

export interface SteamSystem {
  points: THREE.Points
  geometry: THREE.BufferGeometry
  positions: Float32Array
  vel: Float32Array
  top: Float32Array
}

/** 蒸汽粒子系统（源偏向盖碗/公道杯区域，上飘到 top 后重生）。 */
export function createSteamParticles(
  count: number,
  setZ: number,
  softCircleTex: THREE.Texture,
): SteamSystem {
  const positions = new Float32Array(count * 3)
  const vel = new Float32Array(count)
  const top = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    positions[i * 3] = 0.25 + (Math.random() - 0.5) * 0.7
    positions[i * 3 + 1] = Math.random() * 1.2 + 2.4 // 起始在桌面附近
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.5 + setZ
    vel[i] = 0.4 + Math.random() * 0.5
    top[i] = 3.4 + Math.random() * 1.6
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 0.22,
      map: softCircleTex,
      // 蒸汽压暗一档：暖灯下纯白 additive 会在盖碗上炸成死白斑，改暖灰降低过曝
      color: '#e0d4c0',
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  )
  return { points, geometry, positions, vel, top }
}
