import * as THREE from 'three'
import { FISH, LURE } from '../../shared/config'
import type { FishSchool } from './FishSchool'
import type { FoodParticles } from './FoodParticles'

export type LureMode = 'feed' | 'scare' | null

/**
 * 먹이주기/놀래키기 컨트롤러.
 * armed 모드를 보유하고, 캔버스 pointerdown에서 화면→월드 좌표 변환 후
 * FishSchool/FoodParticles를 호출한다.
 * clickThrough===false && hidden===false 일 때만 동작.
 */
export class FoodLure {
  private _mode: LureMode = null
  private readonly _camera: THREE.PerspectiveCamera
  private readonly _canvas: HTMLCanvasElement
  private readonly _fishSchool: FishSchool
  private readonly _foodParticles: FoodParticles
  private readonly _isInteractive: () => boolean
  private readonly _raycaster = new THREE.Raycaster()
  private readonly _pointer = new THREE.Vector2()
  /** armed 무활동 자동 해제 타이머 — 켜 둔 채 잊으면 대사가 계속 억제되는 문제 방지. */
  private _idleTimer: ReturnType<typeof setTimeout> | null = null

  /** 모드 변경 콜백 (UI 동기용) */
  onModeChange: ((mode: LureMode) => void) | null = null

  constructor(
    camera: THREE.PerspectiveCamera,
    canvas: HTMLCanvasElement,
    fishSchool: FishSchool,
    foodParticles: FoodParticles,
    isInteractive: () => boolean,
  ) {
    this._camera = camera
    this._canvas = canvas
    this._fishSchool = fishSchool
    this._foodParticles = foodParticles
    this._isInteractive = isInteractive

    this._canvas.addEventListener('pointerdown', this._onPointerDown)
  }

  get mode(): LureMode {
    return this._mode
  }

  setMode(mode: LureMode): void {
    if (this._mode === mode) {
      // 같은 모드를 다시 선택하면 해제(토글)
      this._mode = null
    } else {
      this._mode = mode
    }
    this._resetIdleTimer()
    this.onModeChange?.(this._mode)
  }

  dispose(): void {
    this._canvas.removeEventListener('pointerdown', this._onPointerDown)
    if (this._idleTimer !== null) clearTimeout(this._idleTimer)
  }

  /** armed 상태에서 일정 시간 클릭이 없으면 자동 해제. 클릭(사용)마다 타이머 리셋. */
  private _resetIdleTimer(): void {
    if (this._idleTimer !== null) {
      clearTimeout(this._idleTimer)
      this._idleTimer = null
    }
    if (this._mode === null) return
    this._idleTimer = setTimeout(() => {
      this._idleTimer = null
      this._mode = null
      this.onModeChange?.(null)
    }, LURE.armedIdleTimeoutMs)
  }

  private _onPointerDown = (e: PointerEvent): void => {
    if (!this._isInteractive()) return
    if (!this._mode) return

    const worldPoint = this._screenToWorld(e.clientX, e.clientY)
    if (!worldPoint) return

    this._resetIdleTimer() // 사용 중에는 armed 유지

    if (this._mode === 'feed') {
      this._foodParticles.spawn(worldPoint)
      this._fishSchool.feedAt()
    } else if (this._mode === 'scare') {
      this._fishSchool.scareAt(worldPoint)
    }
  }

  /**
   * 화면 좌표를 월드 좌표(y=0 평면 근사 또는 FISH.bounds 내 클램프)로 변환.
   * 레이캐스트를 y=0 평면에 교차시켜 월드 XZ를 구한다.
   */
  private _screenToWorld(clientX: number, clientY: number): THREE.Vector3 | null {
    const rect = this._canvas.getBoundingClientRect()
    this._pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
    this._pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1

    this._raycaster.setFromCamera(this._pointer, this._camera)

    // y=0 평면과의 교차
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const target = new THREE.Vector3()
    const hit = this._raycaster.ray.intersectPlane(plane, target)
    if (!hit) return null

    // FISH.bounds 내로 클램프
    const b = FISH.bounds
    target.x = Math.max(b.minX, Math.min(b.maxX, target.x))
    target.y = Math.max(b.minY, Math.min(b.maxY, target.y))
    target.z = Math.max(b.minZ, Math.min(b.maxZ, target.z))

    return target
  }
}
