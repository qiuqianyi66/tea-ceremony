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
