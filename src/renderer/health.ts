/**
 * 런타임 헬스 신호 — 스모크 eval(main 프로세스)이 읽어 렌더링 상태를 판정한다.
 * window.__AQUA_HEALTH__ 로 노출. console.error / 미처리 예외도 수집한다.
 *
 * 상시 로드되지만 비용은 0에 가깝다(이벤트 핸들러 등록 + 작은 객체).
 */

export interface AquaHealth {
  ready: boolean
  fishActive: number
  errors: string[]
  /** 첫 프레임 렌더 이후 경과 프레임 수 (eval이 렌더 루프 생존을 확인) */
  frames: number
}

const health: AquaHealth = {
  ready: false,
  fishActive: 0,
  errors: [],
  frames: 0,
}

function pushError(msg: string): void {
  if (health.errors.length < 200) health.errors.push(msg)
}

// console.error 후킹 (THREE의 셰이더 컴파일 에러 등 포함)
const origError = console.error.bind(console)
console.error = (...args: unknown[]): void => {
  pushError(args.map((a) => (typeof a === 'string' ? a : safeStr(a))).join(' '))
  origError(...args)
}

function safeStr(v: unknown): string {
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

window.addEventListener('error', (e) => {
  pushError(`window.onerror: ${e.message} @ ${e.filename}:${e.lineno}`)
})
window.addEventListener('unhandledrejection', (e) => {
  pushError(`unhandledrejection: ${safeStr(e.reason)}`)
})

// main 프로세스(executeJavaScript)에서 읽는 진입점
;(window as unknown as { __AQUA_HEALTH__: AquaHealth }).__AQUA_HEALTH__ = health

export function markReady(): void {
  health.ready = true
}

export function setFishActive(n: number): void {
  health.fishActive = n
}

export function tickFrame(): void {
  health.frames++
}
