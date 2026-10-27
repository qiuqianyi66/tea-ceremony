/**
 * 渲染管线：ACES 色调映射 + PCF 软阴影 + 程序化 IBL（RoomEnvironment/PMREM）。
 * 从 TeaBrewSceneInner 拆出（2026-10-27）；纯函数，组件 onMounted 时调用一次。
 */
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

export function setupRenderPipeline(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer | undefined,
  keyLight: THREE.DirectionalLight | null,
  setZ: number,
): void {
  // 雾化伪景深：线性雾 near=7.8 / far=10.2。
  // 茶席距相机约 8.1 → 约 12% 雾（夜色氛围，主体仍清晰）；
  // 远景 cabinet/shelf/scroll 距相机约 9.6 → 约 75% 雾（明显虚化），
  // 与 scene.background 夜色纹理自然融合。scene.background 本身不受雾影响。
  scene.fog = new THREE.Fog(0x221810, 7.8, 10.2)
  if (renderer) {
    // 电影级 ACES 色调映射：暖光不过曝、暗部有层次；曝光补偿背景图被压暗的部分
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.08
    // three r185 起 PCFSoftShadowMap 已废弃（内部强制回退 PCFShadowMap 并告警），显式用 PCFShadowMap
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.shadowMap.needsUpdate = true
    // 程序化环境反射（IBL）：RoomEnvironment 是中性影棚环境，零外部素材；
    // 经 PMREM 预滤波后赋给 scene.environment，所有 PBR 材质自动获得环境反光，
    // 白瓷釉面/玻璃/紫砂不再是死面。暖调由灯光承担。
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envScene = new RoomEnvironment()
    const envTex = pmrem.fromScene(envScene, 0.04).texture
    scene.environment = envTex
    scene.environmentIntensity = 0.55
    pmrem.dispose()
  }
  // 主方向光阴影相机：必须手动收紧，默认视锥覆盖范围与分辨率对本场景都不合适
  if (keyLight) {
    keyLight.target.position.set(0, 1.2, setZ)
    scene.add(keyLight.target)
    const cam = keyLight.shadow.camera
    cam.near = 0.5
    cam.far = 18
    cam.left = -3
    cam.right = 3
    cam.top = 3
    cam.bottom = -3
    cam.updateProjectionMatrix()
    keyLight.shadow.mapSize.set(2048, 2048)
    keyLight.shadow.bias = -0.0002
    keyLight.shadow.normalBias = 0.02
  }
}
