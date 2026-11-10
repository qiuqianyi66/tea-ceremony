/**
 * 程序化真手（零外部模型：圆润掌体 + 两节关节手指 + 袖套小臂）。
 * 从 TeaBrewSceneInner 拆出（2026-10-27）；只露手不露脸，低多边形，姿态由动画循环 lerp 驱动。
 * 旧版盒体手掌 + 单节直指读着像积木：掌体改缩放球，手指分两节并带自然弯曲与长短差。
 */
import * as THREE from 'three'

function makeFinger(
  material: THREE.Material,
  radius: number,
  totalLength: number,
  spread: number,
  curl: number,
): THREE.Group {
  // 关节组：knuckle 挂在掌沿，两节指骨各自向前（掌心方向）弯曲。
  const knuckle = new THREE.Group()
  knuckle.rotation.x = curl
  knuckle.rotation.z = spread

  const proximalLength = totalLength * 0.55
  const proximal = new THREE.Mesh(new THREE.CapsuleGeometry(radius, proximalLength, 4, 8), material)
  proximal.position.y = proximalLength / 2 + radius
  proximal.castShadow = true
  knuckle.add(proximal)

  const distal = new THREE.Group()
  distal.position.y = proximalLength + radius
  distal.rotation.x = curl * 0.8
  const distalLength = totalLength * 0.45
  const distalBone = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius * 0.88, distalLength, 4, 8),
    material,
  )
  distalBone.position.y = distalLength / 2 + radius * 0.88
  distalBone.castShadow = true
  distal.add(distalBone)
  knuckle.add(distal)
  return knuckle
}

export function createHandGroup(): THREE.Group {
  const handGroup = new THREE.Group()
  const handSkinMat = new THREE.MeshStandardMaterial({
    color: '#c89070',
    roughness: 0.75,
    envMapIntensity: 0.4,
  })
  const handSleeveMat = new THREE.MeshStandardMaterial({ color: '#2a3540', roughness: 0.9 })

  // 掌体：缩放球替代盒体，掌心（+z）一侧略鼓，边缘圆滑不再有棱角。
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.1, 18, 14), handSkinMat)
  palm.scale.set(0.78, 1.08, 0.48)
  palm.castShadow = true
  handGroup.add(palm)

  // 四指：中指最长，向两侧递减；根部沿掌弧排布，整体呈握拢弯曲（旧版近直指读着像张开的手掌）。
  const fingerSpecs = [
    { x: -0.052, length: 0.115, spread: 0.08, curl: 0.55 },
    { x: -0.017, length: 0.13, spread: 0.02, curl: 0.5 },
    { x: 0.017, length: 0.125, spread: -0.02, curl: 0.6 },
    { x: 0.05, length: 0.1, spread: -0.1, curl: 0.75 },
  ]
  for (const spec of fingerSpecs) {
    const finger = makeFinger(handSkinMat, 0.016, spec.length, spec.spread, spec.curl)
    finger.position.set(spec.x, 0.075, 0.01)
    handGroup.add(finger)
  }

  // 拇指：两节，从掌侧斜伸并向前扣，位置低于四指。
  const thumbKnuckle = new THREE.Group()
  thumbKnuckle.position.set(-0.082, -0.02, 0.02)
  thumbKnuckle.rotation.z = 0.7
  thumbKnuckle.rotation.x = 0.55
  const thumbProximal = new THREE.Mesh(new THREE.CapsuleGeometry(0.019, 0.05, 4, 8), handSkinMat)
  thumbProximal.position.y = 0.045
  thumbProximal.castShadow = true
  thumbKnuckle.add(thumbProximal)
  const thumbDistal = new THREE.Group()
  thumbDistal.position.y = 0.085
  thumbDistal.rotation.x = 0.5
  const thumbTip = new THREE.Mesh(new THREE.CapsuleGeometry(0.017, 0.04, 4, 8), handSkinMat)
  thumbTip.position.y = 0.038
  thumbTip.castShadow = true
  thumbDistal.add(thumbTip)
  thumbKnuckle.add(thumbDistal)
  handGroup.add(thumbKnuckle)

  // 袖口 + 小臂（深靛蓝布袖，与茶巾同色）：旧版只到腕部，画面里像一只悬空的手掌。
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.076, 0.088, 0.07, 16), handSleeveMat)
  cuff.position.set(0, -0.135, 0)
  cuff.castShadow = true
  handGroup.add(cuff)
  // 小臂：从腕口向后下方收细，长度够到手不再像断在腕上。
  const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.105, 0.34, 16), handSleeveMat)
  forearm.position.set(0, -0.32, -0.012)
  forearm.rotation.x = 0.12
  forearm.castShadow = true
  handGroup.add(forearm)

  // 手默认藏在画面下方镜头外。
  handGroup.position.set(0, -0.5, 4.2)
  // 掌心朝镜头侧（±z），只留一点前倾；旧值 -1.0 把掌心翻向上，握柄时会从器物里“长出来”。
  handGroup.rotation.x = -0.3
  handGroup.visible = true
  handGroup.scale.setScalar(0.9)
  return handGroup
}
