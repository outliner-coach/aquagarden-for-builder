/**
 * 순수 헬퍼: 이전/현재 타임스탬프(ms)로 dt(초) 계산.
 * prevMs가 0이면 첫 프레임이므로 0 반환. 음수·과도한 dt는 클램프.
 */
export function computeDelta(prevMs: number, nowMs: number, maxDt: number): number {
  if (prevMs === 0) return 0
  const dtSec = (nowMs - prevMs) / 1000
  if (dtSec <= 0) return 0
  return dtSec > maxDt ? maxDt : dtSec
}

const MAX_DT = 0.1

/**
 * 순수 헬퍼: 이번 rAF 프레임에서 틱을 실행할지(FPS 캡). minIntervalMs<=0이면 캡 없음.
 * lastTickMs=0은 첫 프레임(항상 틱). rAF 도착 시각의 지터(±0.5ms)로 경계 틱을 놓치지 않게
 * 반 밀리초의 여유를 둔다.
 */
export function shouldTick(lastTickMs: number, nowMs: number, minIntervalMs: number): boolean {
  if (minIntervalMs <= 0) return true
  if (lastTickMs === 0) return true
  return nowMs - lastTickMs >= minIntervalMs - 0.5
}

export class RenderLoop {
  private _running = false
  private _rafId = 0
  private _prevMs = 0
  private readonly _onTick: (dt: number) => void
  /** 틱 최소 간격(ms). 0이면 디스플레이 주사율 그대로. */
  private readonly _minIntervalMs: number

  constructor(onTick: (dt: number) => void, maxFps = 0) {
    this._onTick = onTick
    this._minIntervalMs = maxFps > 0 ? 1000 / maxFps : 0
  }

  get running(): boolean {
    return this._running
  }

  start(): void {
    if (this._running) return // 중복 호출 가드
    this._running = true
    this._prevMs = 0
    this._rafId = requestAnimationFrame(this._loop)
  }

  stop(): void {
    if (!this._running) return
    this._running = false
    cancelAnimationFrame(this._rafId)
    this._rafId = 0
    this._prevMs = 0
  }

  private _loop = (nowMs: number): void => {
    if (!this._running) return
    // FPS 캡: 간격 미달 프레임은 렌더 없이 다음 rAF만 예약(CPU/GPU 절약). dt는 실제 경과라 속도 불변.
    if (!shouldTick(this._prevMs, nowMs, this._minIntervalMs)) {
      this._rafId = requestAnimationFrame(this._loop)
      return
    }
    const dt = computeDelta(this._prevMs, nowMs, MAX_DT)
    this._prevMs = nowMs
    this._onTick(dt)
    this._rafId = requestAnimationFrame(this._loop)
  }
}
