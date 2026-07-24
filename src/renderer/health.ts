/**
 * 런타임 헬스 신호 — 스모크 eval(main 프로세스)이 읽어 렌더링 상태를 판정한다.
 * window.__AQUA_HEALTH__ 로 노출. console.error / 미처리 예외도 수집한다.
 *
 * 상시 로드되지만 비용은 0에 가깝다(이벤트 핸들러 등록 + 작은 객체).
 */

/**
 * 토큰 사용량 게이지 헬스(스모크 리드백). 보안: 토큰/자격증명(accessToken 등)은 절대 넣지 않는다 —
 * 표시 토글 여부·조회 상태·사용률(%)만 노출한다.
 */
export interface TokenHealth {
  /** 사용자 토큰 사용량 표시 토글(settings.showTokenUsage) 상태. */
  enabled: boolean
  /** 최신 스냅샷 조회 상태. 미조회/실패 시 'unavailable'. */
  state: 'ok' | 'unavailable'
  /** 5시간 창 사용률(0..1). 데이터 없으면 null. */
  fiveHourPct: number | null
  /** 주간 창 사용률(0..1). 데이터 없으면 null. */
  weeklyPct: number | null
  /**
   * 표시값이 마지막 성공값(stale)인지. 라이브 ok(fresh)면 false, 라이브 실패로 캐시를 보여주면 true.
   * 스모크 주입 경로는 라이브 ok라 항상 fresh(false) — 게이트는 state/enabled/%만 대조한다.
   */
  stale: boolean
}

export interface AquaHealth {
  ready: boolean
  fishActive: number
  errors: string[]
  /** 첫 프레임 렌더 이후 경과 프레임 수 (eval이 렌더 루프 생존을 확인) */
  frames: number
  /**
   * 토큰 사용량 게이지 상태. 스모크가 표시 토글·조회 상태·사용률(%)을 리드백 검증한다.
   * 보안: 토큰/자격증명 값은 절대 담기지 않는다(사용률 %와 상태만).
   */
  token: TokenHealth
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
  token: { enabled: false, state: 'unavailable', fiveHourPct: null, weeklyPct: null, stale: false },
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

/**
 * 토큰 사용량 헬스를 반영한다(표시 토글·매 조회마다 main.ts에서 호출).
 * 보안: 인자로 토큰/자격증명을 받지 않는다 — 표시 여부·조회 상태·사용률(%)만.
 */
export function setTokenUsageHealth(t: TokenHealth): void {
  health.token = t
}
