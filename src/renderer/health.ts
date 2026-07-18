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
  /**
   * 현재 적용된 배경 테마 id. 스모크(AQUA_SMOKE_THEME)가 요청 id와 대조해 전환이 실제
   * 반영됐는지 리드백 검증한다(물고기 위치가 매 실행 달라 캡처 diff로는 검증 불가).
   */
  theme: string
  /**
   * 물고기 지형 표면 관통 누적 감지 횟수(FishSchool 런타임 불변식 감시). 회피+클램프가
   * 정상이라면 항상 0 — 스모크가 0을 게이트한다(캡처로는 모션 관통을 못 보는 것의 보완).
   */
  terrainClips: number
}

const health: AquaHealth = {
  ready: false,
  fishActive: 0,
  errors: [],
  frames: 0,
  theme: '',
  terrainClips: 0,
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

/** 적용된 배경 테마 id를 헬스에 반영한다(초기 적용 시·Aquascape.setTheme 전환 시 호출). */
export function setAppliedTheme(id: string): void {
  health.theme = id
}

/** 물고기 지형 관통 누적 감지 횟수를 헬스에 반영한다(렌더 루프에서 FishSchool 값 미러링). */
export function setTerrainClips(n: number): void {
  health.terrainClips = n
}
