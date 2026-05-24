import * as THREE from 'three'
import { SceneRoot } from './core/SceneRoot'
import { RenderLoop } from './core/RenderLoop'

const container = document.getElementById('app')!

const sceneRoot = new SceneRoot(container)

// 검증용 임시 와이어프레임 (step 5에서 제거)
const geo = new THREE.IcosahedronGeometry(0.3, 0)
const mat = new THREE.MeshBasicMaterial({ wireframe: true, color: 0x4fd1c5, transparent: true, opacity: 0.4 })
const marker = new THREE.Mesh(geo, mat)
sceneRoot.scene.add(marker)

const loop = new RenderLoop((dt) => {
  marker.rotation.y += dt * 0.5
  sceneRoot.update(dt)
  sceneRoot.render()
})

loop.start()

// TODO(step-9): hidden 시 loop.stop(), 표시 시 loop.start() 배선
// document.addEventListener('visibilitychange', () => {
//   document.hidden ? loop.stop() : loop.start()
// })
