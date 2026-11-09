/**
 * Lathe 轮廓点（盖碗碗身 / 茶壶壶身）。从 TeaBrewSceneInner 拆出（2026-10-27）。
 */
import * as THREE from 'three'

/** 盖碗碗身 */
export const bowlPts: THREE.Vector2[] = [
  new THREE.Vector2(0, 0),
  new THREE.Vector2(0.9, 0.02),
  new THREE.Vector2(1.05, 0.12),
  new THREE.Vector2(1.2, 0.5),
  new THREE.Vector2(1.15, 0.95),
]

/**
 * 盖碗碗盖（以碗沿为 y=0 起算的扁穹顶轮廓）。
 * 真实盖碗的盖是浅穹顶：盖径略大于碗沿（1.22 vs 1.15）、穹顶高约碗高 1/3。
 * 旧实现用半径 0.82 的半球，穹顶高 0.82≈碗高，侧视就是一颗白球。
 */
export const lidPts: THREE.Vector2[] = [
  new THREE.Vector2(0, 0.34),
  new THREE.Vector2(0.36, 0.33),
  new THREE.Vector2(0.78, 0.24),
  new THREE.Vector2(1.06, 0.1),
  new THREE.Vector2(1.2, 0.03),
  new THREE.Vector2(1.22, 0),
]

/** 茶壶壶身 */
export const potPts: THREE.Vector2[] = [
  new THREE.Vector2(0, 0),
  new THREE.Vector2(1.05, 0.04),
  new THREE.Vector2(1.3, 0.2),
  new THREE.Vector2(1.45, 0.75),
  new THREE.Vector2(1.3, 1.35),
  new THREE.Vector2(1.05, 1.55),
  new THREE.Vector2(0.62, 1.62),
]
