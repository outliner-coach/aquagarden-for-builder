import * as THREE from 'three'
import type { SceneEntity } from '../core/SceneRoot'
import { LIGHT } from '../../shared/config'
import { brightnessToIntensity, brightnessToAmbient, brightnessToEnvIntensity } from './lightingHelpers'
import { IDENTITY_MOOD, type Mood } from './moodHelpers'

export class Lighting implements SceneEntity {
  readonly object3d: THREE.Group
  private readonly _directional: THREE.DirectionalLight
  private readonly _ambient: THREE.AmbientLight
  private readonly _scene: THREE.Scene
  // 사용자 밝기(슬라이더)와 시간대 무드를 분리 보관하고 _apply에서 합성한다.
  private _userB01: number = LIGHT.default01
  private _mood: Mood = IDENTITY_MOOD

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

  /** 사용자 밝기 슬라이더(0~1). 무드 배율과 합성해 적용한다. */
  setBrightness01(b01: number): void {
    this._userB01 = b01
    this._apply()
  }

  /**
   * 시간대 무드 적용. 밝기 배율(사용자 밝기에 곱)과 광원 색 틴트를 반영한다.
   * 시간대 반응 OFF 시 main이 IDENTITY_MOOD를 넣어 현행(흰색·배율 1)으로 되돌린다.
   */
  setMood(mood: Mood): void {
    this._mood = mood
    this._apply()
  }

  private _apply(): void {
    // 무드 배율은 사용자 밝기에 곱해진다(사용자 슬라이더가 마스터). 0~1 클램프.
    const eff = Math.max(0, Math.min(1, this._userB01 * this._mood.brightnessScale))
    this._directional.intensity = brightnessToIntensity(eff, LIGHT.minIntensity, LIGHT.maxIntensity)
    this._ambient.intensity = brightnessToAmbient(eff, LIGHT.minAmbient, LIGHT.maxAmbient)
    this._scene.environmentIntensity = brightnessToEnvIntensity(
      eff,
      LIGHT.minEnvIntensity,
      LIGHT.maxEnvIntensity,
    )
    const [r, g, b] = this._mood.tint
    this._directional.color.setRGB(r, g, b)
    this._ambient.color.setRGB(r, g, b)
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
