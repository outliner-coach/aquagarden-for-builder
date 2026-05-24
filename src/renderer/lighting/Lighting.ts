import * as THREE from 'three'
import type { SceneEntity } from '../core/SceneRoot'
import { LIGHT } from '../../shared/config'
import { brightnessToIntensity, brightnessToAmbient, brightnessToEnvIntensity } from './lightingHelpers'

export class Lighting implements SceneEntity {
  readonly object3d: THREE.Group
  private readonly _directional: THREE.DirectionalLight
  private readonly _ambient: THREE.AmbientLight
  private readonly _scene: THREE.Scene

  constructor(scene: THREE.Scene) {
    this.object3d = new THREE.Group()
    this._scene = scene

    // 상단에서 아래로 비추는 메인 조명
    this._directional = new THREE.DirectionalLight(0xffffff)
    this._directional.position.set(0, 10, 5)
    this.object3d.add(this._directional)

    // 약한 ambient 채움광
    this._ambient = new THREE.AmbientLight(0xffffff)
    this.object3d.add(this._ambient)

    // 초기 밝기 적용
    this.setBrightness01(LIGHT.default01)
  }

  setBrightness01(b01: number): void {
    this._directional.intensity = brightnessToIntensity(
      b01,
      LIGHT.minIntensity,
      LIGHT.maxIntensity,
    )
    this._ambient.intensity = brightnessToAmbient(
      b01,
      LIGHT.minAmbient,
      LIGHT.maxAmbient,
    )
    this._scene.environmentIntensity = brightnessToEnvIntensity(
      b01,
      LIGHT.minEnvIntensity,
      LIGHT.maxEnvIntensity,
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(dt: number): void {
    // no-op: 조명은 정적. 슬라이더 연동은 step 9에서.
  }

  dispose(): void {
    this._directional.dispose()
    this._ambient.dispose()
  }
}
