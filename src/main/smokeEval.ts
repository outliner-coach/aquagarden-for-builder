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

export interface SmokeHealth {
  ready: boolean
  fishActive: number
  errors: string[]
  frames: number
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
    for (const e of input.health.errors) {
      if (textMatchesError(e)) failures.push(`renderer error: ${truncate(e)}`)
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
