/**
 * 스모크 eval 판정 — 순수 로직 (ADR-004, 단위 테스트 대상).
 * Electron/WebGL 부수효과(smoke.ts)와 분리한다.
 */

export interface ConsoleMsg {
  level: number // 0 verbose, 1 info, 2 warning, 3 error
  message: string
  sourceId: string
  line: number
}

/**
 * 토큰 사용량 게이지 헬스 리드백(health.ts TokenHealth의 스모크측 미러). 보안: 토큰/자격증명은
 * 절대 담기지 않는다 — 표시 토글·조회 상태·사용률(%)만.
 */
export interface SmokeTokenHealth {
  enabled: boolean
  state: 'ok' | 'unavailable'
  fiveHourPct: number | null
  weeklyPct: number | null
}

export interface SmokeHealth {
  ready: boolean
  fishActive: number
  errors: string[]
  frames: number
  /** 적용된 배경 테마 id (health.ts 리드백). 옵셔널: 구버전 리포트/테스트 호환. */
  theme?: string
  /**
   * 물고기 지형 표면 관통 누적 감지 횟수(health.ts 리드백). 0이어야 정상 —
   * 정적 캡처로는 모션 관통을 못 보므로 런타임 카운터로 게이트한다.
   * 옵셔널: 구버전 리포트/테스트 호환.
   */
  terrainClips?: number
  /**
   * 토큰 사용량 게이지 헬스(health.ts 리드백). 스모크가 표시 토글·조회 상태·사용률(%)을 대조한다.
   * 옵셔널: 구버전 리포트/테스트 호환. 보안: 사용률(%)·상태만 — 토큰/자격증명은 담기지 않는다.
   */
  token?: SmokeTokenHealth
}

export interface PixelStats {
  sampled: number
  opaqueRatio: number
  transparentRatio: number
  uniqueBuckets: number
  lumVariance: number
  blank: boolean
}

/** 콘솔/헬스 메시지에서 "치명적 렌더 오류"로 간주할 패턴 */
export const ERROR_PATTERNS: readonly RegExp[] = [
  /shader error/i,
  /program not valid/i,
  /undeclared identifier/i,
  /context lost/i,
  /render-process-gone/i,
  /uncaught/i,
  /unhandledrejection/i,
  /net::err/i,
  /failed to load/i,
  /로드 실패/,
  /초기화 실패/,
  /THREE\.\w+: .*error/i,
]

export function messageIsError(msg: ConsoleMsg): boolean {
  if (msg.level >= 3) return true // console.error
  return ERROR_PATTERNS.some((re) => re.test(msg.message))
}

export function textMatchesError(text: string): boolean {
  return ERROR_PATTERNS.some((re) => re.test(text))
}

/**
 * BGRA 비트맵을 샘플링해 화면이 비었거나(blank) 단색인지 판정.
 * bitmap이 null이면 캡처 실패로 간주(blank=true).
 */
export function evaluatePixels(
  bitmap: Uint8Array | null,
  width: number,
  height: number,
  step = 137, // 소수 스텝으로 균등 샘플
): PixelStats {
  if (!bitmap || width <= 0 || height <= 0 || bitmap.length < 4) {
    return { sampled: 0, opaqueRatio: 0, transparentRatio: 0, uniqueBuckets: 0, lumVariance: 0, blank: true }
  }

  const total = width * height
  let sampled = 0
  let opaque = 0
  let transparent = 0
  let lumSum = 0
  let lumSqSum = 0
  const buckets = new Set<number>()

  for (let p = 0; p < total; p += step) {
    const i = p * 4
    const b = bitmap[i]
    const g = bitmap[i + 1]
    const r = bitmap[i + 2]
    const a = bitmap[i + 3]
    sampled++
    // a < 128: 충분히 투과(완전투명 + 수중 베일 같은 반투명 포함) → 바탕화면 비침
    if (a < 128) {
      transparent++
      continue
    }
    opaque++
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    lumSum += lum
    lumSqSum += lum * lum
    // 색을 32단계로 양자화해 고유 색 다양성 측정
    buckets.add(((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5))
  }

  const opaqueRatio = sampled > 0 ? opaque / sampled : 0
  const transparentRatio = sampled > 0 ? transparent / sampled : 0
  const mean = opaque > 0 ? lumSum / opaque : 0
  const lumVariance = opaque > 0 ? lumSqSum / opaque - mean * mean : 0
  const uniqueBuckets = buckets.size

  // blank: 그려진 게 거의 없거나(opaque 매우 적음) 단색(고유색 ≤2 + 분산 낮음)
  const blank = opaqueRatio < 0.005 || (uniqueBuckets <= 2 && lumVariance < 25)

  return { sampled, opaqueRatio, transparentRatio, uniqueBuckets, lumVariance, blank }
}

export interface SmokeInput {
  consoleMsgs: ConsoleMsg[]
  health: SmokeHealth | null
  pixel: PixelStats
  fatal: string | null
  /** 최소 활성 물고기 수 (기본 1) */
  minFish?: number
  /** 최소 렌더 프레임 수 (기본 5) */
  minFrames?: number
  /** 투명 픽셀 최소 비율 — 투과 보존 (기본 0.01) */
  minTransparentRatio?: number
  /**
   * 요청된 배경 테마 id (AQUA_SMOKE_THEME). 지정되면 health.theme과 대조해 불일치(유령 id 등
   * 훅이 무시한 경우 포함) 시 fail — 물고기 위치가 매 실행 달라 캡처 diff로는 전환을 검증할 수
   * 없으므로, 리드백 대조가 유일한 객관적 판정 수단이다.
   */
  requestedTheme?: string | null
  /**
   * 토큰 스모크 게이트 기대값 — `parseSmokeToken(AQUA_SMOKE_TOKEN)` 결과(사용률 0..1, %가 아님).
   * 두 모드를 한 경로로 판정한다(스모크는 실네트워크/Keychain 미접촉 — T3가 AQUA_SMOKE에서 격리):
   *  - `{fiveHour, weekly}`(주입): health.token이 state==='ok' & enabled===true & 사용률 근사 일치여야 함.
   *  - `null`(미주입/형식불량): health.token.state==='unavailable'여야 함(격리 경로가 지켜졌다는 증거).
   * `undefined`(미지정)면 토큰 게이트 스킵 — 구버전 스모크/유닛테스트 하위호환.
   * 보안: 이 필드에는 토큰/자격증명이 아니라 사용률(%)만 담긴다.
   */
  requestedToken?: { fiveHour: number; weekly: number } | null
}

export interface SmokeResult {
  pass: boolean
  failures: string[]
}

/** 객관적 깨짐 게이트. 미적 판정(비전 LLM)은 별도 단계. */
export function evaluateSmoke(input: SmokeInput): SmokeResult {
  const failures: string[] = []
  const minFish = input.minFish ?? 1
  const minFrames = input.minFrames ?? 5
  const minTransparent = input.minTransparentRatio ?? 0.01

  if (input.fatal) failures.push(`fatal: ${input.fatal}`)

  if (!input.health) {
    failures.push('헬스 신호 없음 (렌더러가 __AQUA_HEALTH__를 노출하지 못함)')
  } else {
    if (!input.health.ready) failures.push('renderer ready 도달 못함')
    if (input.health.frames < minFrames) failures.push(`렌더 프레임 부족 (${input.health.frames} < ${minFrames})`)
    if (input.health.fishActive < minFish) failures.push(`활성 물고기 부족 (${input.health.fishActive} < ${minFish})`)
    const clips = input.health.terrainClips ?? 0
    if (clips > 0) failures.push(`물고기 지형 관통 감지 (${clips}회 — 지형 회피/클램프 불변식 위반)`)
    for (const e of input.health.errors) {
      if (textMatchesError(e)) failures.push(`renderer error: ${truncate(e)}`)
    }
  }

  if (input.requestedTheme != null) {
    const applied = input.health?.theme
    if (applied !== input.requestedTheme) {
      failures.push(`테마 리드백 불일치 (요청=${input.requestedTheme}, 적용=${applied ?? '없음'})`)
    }
  }

  // 토큰 사용량 게이지 리드백 대조(AQUA_SMOKE_TOKEN). 실네트워크/Keychain을 태우지 않고도(T3 격리)
  // 게이지가 진짜 구동됐는지 health.token으로 검증한다. 한 경로가 주입/미주입 두 모드를 처리한다.
  // 보안: state·enabled·사용률(%)만 읽는다 — 토큰/자격증명은 절대 기대·기록하지 않는다.
  if (input.requestedToken !== undefined) {
    const tok = input.health?.token
    if (input.requestedToken === null) {
      // 미주입 모드 — 조회 격리(네트워크/Keychain 미접촉)의 증거로 unavailable이어야 한다.
      if (tok?.state !== 'unavailable') {
        failures.push(`토큰 리드백: 미주입인데 state≠unavailable (state=${tok?.state ?? '없음'})`)
      }
    } else if (!tok) {
      failures.push('토큰 리드백 없음 (health.token 부재)')
    } else {
      // 주입 모드 — state ok + 표시 ON + 두 창 사용률이 주입값과 근사 일치.
      if (tok.state !== 'ok') failures.push(`토큰 리드백: state≠ok (state=${tok.state})`)
      if (tok.enabled !== true) failures.push(`토큰 리드백: enabled≠true (enabled=${tok.enabled})`)
      if (!approxPct(tok.fiveHourPct, input.requestedToken.fiveHour)) {
        failures.push(`토큰 리드백: 5시간 사용률 불일치 (기대≈${input.requestedToken.fiveHour}, 적용=${tok.fiveHourPct ?? '없음'})`)
      }
      if (!approxPct(tok.weeklyPct, input.requestedToken.weekly)) {
        failures.push(`토큰 리드백: 주간 사용률 불일치 (기대≈${input.requestedToken.weekly}, 적용=${tok.weeklyPct ?? '없음'})`)
      }
    }
  }

  const errMsgs = input.consoleMsgs.filter(messageIsError)
  if (errMsgs.length > 0) {
    const uniq = Array.from(new Set(errMsgs.map((m) => truncate(m.message)))).slice(0, 10)
    for (const m of uniq) failures.push(`console: ${m}`)
  }

  if (input.pixel.blank) {
    failures.push(`화면이 비었거나 단색 (opaque=${input.pixel.opaqueRatio.toFixed(3)}, 색다양성=${input.pixel.uniqueBuckets}, 분산=${input.pixel.lumVariance.toFixed(1)})`)
  }
  if (input.pixel.transparentRatio < minTransparent) {
    failures.push(`투명 배경 미보존 (투명비율=${input.pixel.transparentRatio.toFixed(3)} < ${minTransparent})`)
  }

  return { pass: failures.length === 0, failures }
}

function truncate(s: string, n = 160): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

/** 토큰 사용률(0..1) 근사 비교 허용오차. 주입·리드백이 동일 parseSmokeToken에서 나와 사실상 동일값이나, 스펙대로 소폭 epsilon으로 대조. */
const TOKEN_PCT_EPSILON = 1e-6

/** 리드백 사용률(actual, null 가능)이 기대값(expected)과 epsilon 내로 일치하는지. null이면 불일치. */
function approxPct(actual: number | null, expected: number): boolean {
  return actual !== null && Math.abs(actual - expected) <= TOKEN_PCT_EPSILON
}
