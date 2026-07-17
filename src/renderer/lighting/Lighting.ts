import * as THREE from 'three'
import type { SceneEntity } from '../core/SceneRoot'
import { LIGHT, MOOD } from '../../shared/config'
import { brightnessToIntensity, brightnessToAmbient, brightnessToEnvIntensity } from './lightingHelpers'
import { IDENTITY_MOOD, moodLerp, moodEquals, type Mood } from './moodHelpers'

/** 전환 수렴 스냅 허용 오차 — 이보다 가까우면 목표로 스냅하고 재계산을 멈춘다. */
const MOOD_EPS = 0.002

export class Lighting implements SceneEntity {
  readonly object3d: THREE.Group
  private readonly _directional: THREE.DirectionalLight
  private readonly _ambient: THREE.AmbientLight
  private readonly _scene: THREE.Scene
  // 사용자 밝기(슬라이더)와 시간대 무드를 분리 보관하고 _apply에서 합성한다.
  private _userB01: number = LIGHT.default01
  // 무드는 목표(_moodTarget)를 향해 update(dt)에서 점진 수렴한다(_mood가 현재 적용값).
  private _mood: Mood = IDENTITY_MOOD
  private _moodTarget: Mood = IDENTITY_MOOD

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
   * 현재 적용 중인(전환 보간된) 무드. 비조명 요소(수초 셰이더·커스틱)가 같은 무드를
   * 따라가도록 main 렌더 루프가 읽는다. 수렴 후에는 참조가 안정되므로 참조 비교로 변화 감지 가능.
   */
  get currentMood(): Mood {
    return this._mood
  }

  /**
   * 시간대 무드 목표 설정. 실제 적용은 update(dt)가 MOOD.transitionSeconds에 걸쳐
   * 부드럽게 수렴시킨다(토글 순간의 급변 방지 + 변화가 눈에 들어오게).
   * 시간대 반응 OFF 시 main이 IDENTITY_MOOD를 넣어 현행(흰색·배율 1)으로 되돌린다.
   */
  setMood(mood: Mood): void {
    this._moodTarget = mood
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

  /** 무드 전환 수렴. 목표와 같으면 아무 일도 하지 않는다(평상시 비용 0). */
  update(dt: number): void {
    if (moodEquals(this._mood, this._moodTarget, MOOD_EPS)) {
      if (this._mood !== this._moodTarget) {
        this._mood = this._moodTarget // 스냅(잔여 오차 제거·재계산 중단)
        this._apply()
      }
      return
    }
    // 지수 수렴: transitionSeconds 안에 사실상 도달(3τ). dt가 전환 시간 이상이면 즉시 도달.
    const alpha =
      dt >= MOOD.transitionSeconds ? 1 : 1 - Math.exp((-3 * dt) / MOOD.transitionSeconds)
    this._mood = moodLerp(this._mood, this._moodTarget, alpha)
    if (moodEquals(this._mood, this._moodTarget, MOOD_EPS)) this._mood = this._moodTarget
    this._apply()
  }

  dispose(): void {
    this._directional.dispose()
    this._ambient.dispose()
  }
}
