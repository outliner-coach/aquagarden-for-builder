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

export class RenderLoop {
  private _running = false
  private _rafId = 0
  private _prevMs = 0
  private readonly _onTick: (dt: number) => void

  constructor(onTick: (dt: number) => void) {
    this._onTick = onTick
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
    const dt = computeDelta(this._prevMs, nowMs, MAX_DT)
    this._prevMs = nowMs
    this._onTick(dt)
    this._rafId = requestAnimationFrame(this._loop)
  }
}
