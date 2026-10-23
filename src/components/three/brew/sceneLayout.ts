import { computed, ref } from 'vue'
import * as THREE from 'three'
import { smoothstep } from '@/composables/useBrewAnimation'

/**
 * 冲泡 3D 场景布局（从 TeaBrewSceneInner.vue 拆出，2026-10-22 B8）。
 * 整套茶席的坐标/缩放/旋转常量与动画联动 computed：position/scale 用 Vector3 实例，
 * rotation 一律用数组。依赖注入：anim（useBrewAnimation 实例，液面/倾斜等联动量）。
 * 每次调用生成一套独立实例（原为模块级共享，拆后按组件实例隔离，多实例更安全）。
 */
export function createSceneLayout(
  anim: ReturnType<typeof import('@/composables/useBrewAnimation').useBrewAnimation>,
) {
  // 构图：整套茶席沿 z 后移 SET_Z，远离相机，露出近景桌面边缘，
  // 形成「前景桌面 → 中景器具 → 远景茶室」三层纵深（近大远小更协调，也给上方 UI 让出空间）。
  const SET_Z = -0.7
  // 相机：第一人称 POV · 30° 高俯视（抖音短视频俯拍茶桌构图）。
  // look 压向桌面中心，抬高相机到 y=3.5、z=4.2：
  // 垂直差 3.5-1.15=2.35 / 水平差 4.2-0=4.2 → atan(0.56)≈29.2°。
  // 相机拉近让桌面占满画面下半，桌腿少露、桌下死黑减少。
  const camPos = new THREE.Vector3(0, 3.5, 4.2)
  const camLook = new THREE.Vector3(0, 1.15, 0)
  // 相机 fov：随视口宽高比适配。竖屏（手机 390×844 等）下水平视场自然收窄，
  // 固定 43 会把桌面两侧裁出画外，按 aspect 增大 fov 补偿横向视野；
  // 桌面 16:9 保持 43，窄屏上限 72（避免鱼眼失真）。
  const viewportAspect = ref(
    typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 16 / 9,
  )
  function syncViewportAspect() {
    viewportAspect.value = window.innerWidth / window.innerHeight
  }
  const camFov = computed(() => {
    const aspect = viewportAspect.value
    if (aspect >= 1) return 43
    return Math.min(72, Math.round(43 * (1.6 / aspect) ** 0.35))
  })
  const keyLightPos = new THREE.Vector3(3.2, 5.5, 4)
  const rimLightPos = new THREE.Vector3(-3, 2, -2)
  const floorPos = new THREE.Vector3(0, -0.001, 1.5)
  const tablePos = new THREE.Vector3(0, 1.1, SET_Z)
  const clothPos = new THREE.Vector3(0, 1.19, SET_Z)
  const legPositions: THREE.Vector3[] = [
    new THREE.Vector3(-2, 0.55, -0.9 + SET_Z),
    new THREE.Vector3(2, 0.55, -0.9 + SET_Z),
    new THREE.Vector3(-2, 0.55, 0.9 + SET_Z),
    new THREE.Vector3(2, 0.55, 0.9 + SET_Z),
  ]
  const gaiwanPos = new THREE.Vector3(-0.1, 1.19, SET_Z)
  const gaiwanScale = new THREE.Vector3(0.24, 0.24, 0.24)
  const liquidPos = new THREE.Vector3(0, 0.68, 0)
  // 盖碗盖子位置（闷泡时下移盖上碗口）。开盖只微抬、合盖盖沿与碗口齐平，
  // 避免旧值 0.98→0.68 的大行程让盖子悬空/合盖时像一颗大白球。
  const lidPosition = computed(
    () => new THREE.Vector3(0, 0.92 - 0.18 * smoothstep(anim.steep.value), 0),
  )

  // ==================== 公道杯（茶海，玻璃材质，出汤→分茶用） ====================
  // 比例修正：旧 scale 0.28 世界半径仅 0.126，远小于盖碗 0.288；真实公道杯与盖碗体量接近
  const fairnessPos = new THREE.Vector3(0.68, 1.19, 0.22 + SET_Z)
  const fairnessScale = new THREE.Vector3(0.4, 0.4, 0.4)
  const fairnessPts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.3, 0.02),
    new THREE.Vector2(0.42, 0.1),
    new THREE.Vector2(0.45, 0.35),
    new THREE.Vector2(0.42, 0.5),
    new THREE.Vector2(0.35, 0.55),
  ]
  const fairnessSpoutPos = new THREE.Vector3(0.48, 0.35, 0)
  const fairnessHandlePos = new THREE.Vector3(-0.45, 0.3, 0)
  const fairnessLiquidPos = new THREE.Vector3(0, 0.3, 0)
  // 公道杯液面（出汤时上升，分茶时下降）
  const fairnessLiquidScale = computed(() => {
    const poured = 0.1 + smoothstep(anim.pourOut.value) * 0.8
    const pouredOut = smoothstep(anim.fairnessPour.value) * 0.7
    return new THREE.Vector3(1, Math.max(0.05, poured - pouredOut), 1)
  })
  const fairnessLiquidOpacity = computed(() => Math.min(1, anim.pourOut.value * 2))
  // 公道杯旋转（分茶时向品茗杯倾斜）
  const fairnessRotation = computed<[number, number, number]>(() => [
    0,
    0,
    0.45 * smoothstep(anim.fairnessPour.value),
  ])

  // ==================== 品茗杯×3（黑釉，公道杯前方一字排开） ====================
  // 比例修正：scale 0.3→0.37，与盖碗/公道杯体量更协调
  const teacupScale = new THREE.Vector3(0.37, 0.37, 0.37)
  const teacupPts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.28, 0.02),
    new THREE.Vector2(0.36, 0.12),
    new THREE.Vector2(0.38, 0.28),
    new THREE.Vector2(0.34, 0.38),
    new THREE.Vector2(0.25, 0.42),
  ]
  const teacupPositions: THREE.Vector3[] = [
    new THREE.Vector3(1.2, 1.19, 0.55 + SET_Z),
    new THREE.Vector3(1.5, 1.19, 0.05 + SET_Z),
    new THREE.Vector3(1.2, 1.19, -0.42 + SET_Z),
  ]
  // 中景道具：茶席后移后桌面中景偏空，补茶巾/水盂/茶拨/杯托丰富层次。
  // 均位于右侧品茗杯区，不挡左侧注水流与放茶动画（3D_SPEC：只做视觉层）。
  const teaClothPos = new THREE.Vector3(1.7, 1.194, -0.15 + SET_Z)
  const waterPotPos = new THREE.Vector3(1.78, 1.27, 0.28 + SET_Z)
  const teaPickPos = new THREE.Vector3(1.68, 1.206, -0.15 + SET_Z)
  const teacupLiquidPos = new THREE.Vector3(0, 0.2, 0)
  // 品茗杯液面（分茶时上升，喝茶时减少）
  const teacupLiquidScale = computed(() => {
    const poured = 0.1 + smoothstep(anim.fairnessPour.value) * 0.7
    const drunk = smoothstep(anim.drink.value) * 0.3
    return new THREE.Vector3(1, Math.max(0.05, poured - drunk), 1)
  })
  const teacupLiquidOpacity = computed(() => Math.min(1, anim.fairnessPour.value * 2))
  // 品茗杯喝茶时的位移偏移（向上+向相机方向）
  const teacupDrinkOffset = computed(
    () =>
      new THREE.Vector3(
        0,
        0.25 * smoothstep(anim.drink.value),
        -0.15 * smoothstep(anim.drink.value),
      ),
  )
  // 品茗杯喝茶时的旋转（向后倾斜模拟端起）
  const teacupDrinkRotation = computed<[number, number, number]>(() => [
    0.15 * smoothstep(anim.drink.value),
    0,
    0,
  ])

  // 出汤水流位置：盖碗碗口到公道杯中心的中点（出汤动画）
  const pourOutStreamPos = computed(() => {
    const gaiwanSpout = new THREE.Vector3(gaiwanPos.x + 0.3, gaiwanPos.y + 0.4, gaiwanPos.z)
    const fairnessCenter = new THREE.Vector3(fairnessPos.x, fairnessPos.y + 0.3, fairnessPos.z)
    return gaiwanSpout.clone().add(fairnessCenter).multiplyScalar(0.5)
  })
  // 分茶水流位置：公道杯壶嘴到中间品茗杯中心的中点（分茶动画）
  const fairnessStreamPos = computed(() => {
    const fairnessSpout = new THREE.Vector3(
      fairnessPos.x + 0.4,
      fairnessPos.y + 0.35,
      fairnessPos.z,
    )
    const teacupCenter = teacupPositions[1]!.clone().add(new THREE.Vector3(0, 0.15, 0))
    return fairnessSpout.clone().add(teacupCenter).multiplyScalar(0.5)
  })
  const kettlePos = new THREE.Vector3(-1.25, 1.465, SET_Z)
  const kettleScale = new THREE.Vector3(0.24, 0.24, 0.24)
  const kettleLidPos = new THREE.Vector3(0, 1.62, 0)
  const knobPos = new THREE.Vector3(0, 1.78, 0)
  const spoutPos = new THREE.Vector3(1.35, 1.05, 0)
  const handlePos = new THREE.Vector3(-1.35, 0.95, 0)
  const stovePos = new THREE.Vector3(-1.25, 1.19, SET_Z)
  const stoveBasePos = new THREE.Vector3(0, 0.1375, 0)
  const flameLightPos = new THREE.Vector3(0, 0.45, 0)
  const stoveGlowScale = new THREE.Vector3(1.1, 1.1, 1)
  const streamPos = new THREE.Vector3(0.1, 1.0, 0)
  // 注水流位置：壶嘴到盖碗中心的中点（入水动画用）
  const waterStreamPos = computed(() => {
    const spoutWorld = new THREE.Vector3(kettlePos.x + 0.5, kettlePos.y + 0.3, kettlePos.z)
    const gaiwanCenter = new THREE.Vector3(gaiwanPos.x, gaiwanPos.y + 0.3, gaiwanPos.z)
    return spoutWorld.clone().add(gaiwanCenter).multiplyScalar(0.5)
  })
  // 盖碗液面 scale（入水时液面上升）
  const liquidScale = computed(
    () => new THREE.Vector3(1, 0.3 + smoothstep(anim.pourWater.value) * 0.5, 1),
  )
  // 茶则位置（从旁侧移入盖碗上方，放茶动画）
  const teaScoopPos = computed(() => {
    const start = new THREE.Vector3(1.8, 1.6, SET_Z)
    const end = new THREE.Vector3(gaiwanPos.x + 0.2, gaiwanPos.y + 0.8, gaiwanPos.z)
    return start.clone().lerp(end, smoothstep(anim.addLeaves.value))
  })

  return {
    SET_Z,
    camPos,
    camLook,
    syncViewportAspect,
    camFov,
    keyLightPos,
    rimLightPos,
    floorPos,
    tablePos,
    clothPos,
    legPositions,
    gaiwanPos,
    gaiwanScale,
    liquidPos,
    lidPosition,
    fairnessPos,
    fairnessScale,
    fairnessPts,
    fairnessSpoutPos,
    fairnessHandlePos,
    fairnessLiquidPos,
    fairnessLiquidScale,
    fairnessLiquidOpacity,
    fairnessRotation,
    teacupScale,
    teacupPts,
    teacupPositions,
    teaClothPos,
    waterPotPos,
    teaPickPos,
    teacupLiquidPos,
    teacupLiquidScale,
    teacupLiquidOpacity,
    teacupDrinkOffset,
    teacupDrinkRotation,
    pourOutStreamPos,
    fairnessStreamPos,
    kettlePos,
    kettleScale,
    kettleLidPos,
    knobPos,
    spoutPos,
    handlePos,
    stovePos,
    stoveBasePos,
    flameLightPos,
    stoveGlowScale,
    streamPos,
    waterStreamPos,
    liquidScale,
    teaScoopPos,
  }
}
