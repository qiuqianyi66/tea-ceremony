/**
 * 程序化真手（零外部模型：手掌盒体 + 胶囊手指 + 袖套）。
 * 从 TeaBrewSceneInner 拆出（2026-10-27）；只露手不露脸，低多边形，姿态由动画循环 lerp 驱动。
 */
import * as THREE from 'three'

export function createHandGroup(): THREE.Group {
  const handGroup = new THREE.Group()
  const handSkinMat = new THREE.MeshStandardMaterial({
    color: '#c89070',
    roughness: 0.75,
    envMapIntensity: 0.4,
  })
  const handSleeveMat = new THREE.MeshStandardMaterial({ color: '#2a3540', roughness: 0.9 })

  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.17, 0.045), handSkinMat)
  palm.castShadow = true
  handGroup.add(palm)
  // 四指（关节简化为单节胶囊，指尖略向外散）
  const fingerGeo = new THREE.CapsuleGeometry(0.018, 0.085, 4, 8)
  const fingerXs = [-0.048, -0.016, 0.016, 0.048]
  for (const fx of fingerXs) {
    const f = new THREE.Mesh(fingerGeo, handSkinMat)
    f.position.set(fx, 0.135, 0)
    f.castShadow = true
    handGroup.add(f)
  }
  // 拇指（斜伸）
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.06, 4, 8), handSkinMat)
  thumb.position.set(-0.085, -0.01, 0.02)
  thumb.rotation.z = 0.9
  thumb.castShadow = true
  handGroup.add(thumb)
  // 袖口（深靛蓝布袖，与茶巾同色；短一截让皮肤露出）
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.08, 16), handSleeveMat)
  cuff.position.set(0, -0.14, 0)
  handGroup.add(cuff)

  // 手默认藏在画面下方镜头外
  handGroup.position.set(0, -0.5, 4.2)
  handGroup.rotation.x = -1.0
  handGroup.visible = true
  handGroup.scale.setScalar(0.9)
  return handGroup
}
