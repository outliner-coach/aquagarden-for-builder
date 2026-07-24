import { TOKEN } from './config'
import type { TokenUsage, TokenUsageWindow, TokenUsageCache } from './types'

/**
 * 토큰 사용량 순수 헬퍼. 부수효과 없음(네트워크/시계/스토리지 접근 금지) — 시각은 모두 인자로
 * 주입해 결정적이다. main/renderer에 의존하지 않는다(shared는 leaf 레이어).
 *
 * 파싱은 Anthropic 공식 사용률 API(`token_dashboard/Sources/Official.swift`) 스키마를 그대로
 * 옮긴 것: `limits[]`가 정본({kind, utilization(0..100 %), resets_at(ISO8601 문자열)}),
 * 톱레벨 `five_hour`/`seven_day`는 보충 폴백. utilization은 0..100이므로 100으로 나눠 0..1로.
 */

/** 사용량 밴드. TOKEN.warnPct/criticalPct 임계값으로 결정. */
export type UsageLevel = 'ok' | 'warn' | 'critical'

/** parseUsageResponse 결과 — 파싱 가능한 창만 채워진다. */
export interface ParsedUsage {
  fiveHour?: TokenUsageWindow
  weekly?: TokenUsageWindow
}

// 단위 상수 (매직 넘버 회피).
const PERCENT = 100
const MS_PER_SEC = 1000
const SEC_PER_MIN = 60
const MIN_PER_HOUR = 60
const SEC_PER_HOUR = SEC_PER_MIN * MIN_PER_HOUR
const HOUR_PER_DAY = 24
const SEC_PER_DAY = SEC_PER_HOUR * HOUR_PER_DAY

/** 요일 표기 (Date.getDay() 0=일 ~ 6=토). */
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** 유한 숫자만 통과. 비수치/NaN/Infinity → null. */
function numeric(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/**
 * resets_at → epoch 초. 실제 응답은 ISO8601 문자열(마이크로초 6자리 포함)이라 소수 초를 떼고
 * 파싱한다(초 단위 출력이라 소수부는 어차피 버려짐 — Swift parseISO와 동일 접근). 숫자면 초로 간주.
 * 파싱 불가/부재 → 0(방어; 창의 정본 신호는 pct이고 resetsAt는 보조).
 */
function toEpochSeconds(v: unknown): number {
  const n = numeric(v)
  if (n !== null) return Math.floor(n)
  if (typeof v === 'string' && v.length > 0) {
    const stripped = v.replace(/\.\d+/, '')
    const ms = Date.parse(stripped)
    if (!Number.isNaN(ms)) return Math.floor(ms / MS_PER_SEC)
    const msRaw = Date.parse(v)
    if (!Number.isNaN(msRaw)) return Math.floor(msRaw / MS_PER_SEC)
  }
  return 0
}

/** 한 항목({utilization|percent, resets_at})을 창으로. 수치 사용률이 없으면 null. */
function toWindow(d: unknown): TokenUsageWindow | null {
  if (!isRecord(d)) return null
  const rawUtil = numeric(d.utilization) ?? numeric(d.percent)
  if (rawUtil === null) return null
  return { pct: rawUtil / PERCENT, resetsAt: toEpochSeconds(d.resets_at) }
}

/**
 * 공식 사용률 API JSON을 파싱한다(순수·비throw). 파싱 가능한 창만 반환하고, 아무것도 못 얻으면 null.
 * 매핑: kind==='session' 또는 'five' 포함 → fiveHour, kind==='weekly_all' → weekly.
 * weekly_scoped 및 기타 kind는 무시. limits가 없거나 특정 창이 비면 톱레벨 five_hour/seven_day로 폴백.
 */
export function parseUsageResponse(json: unknown): ParsedUsage | null {
  if (!isRecord(json)) return null
  const result: ParsedUsage = {}

  // 1) limits[] — kind로 분류 (정본)
  if (Array.isArray(json.limits)) {
    for (const entry of json.limits) {
      if (!isRecord(entry)) continue
      const kind = typeof entry.kind === 'string' ? entry.kind.toLowerCase() : ''
      const win = toWindow(entry)
      if (win === null) continue
      if (kind === 'session' || kind.includes('five')) {
        if (result.fiveHour === undefined) result.fiveHour = win
      } else if (kind === 'weekly_all') {
        if (result.weekly === undefined) result.weekly = win
      }
      // weekly_scoped 및 기타 kind는 의도적으로 무시
    }
  }

  // 2) 톱레벨 폴백 — limits가 없거나(absent) 특정 창이 비었을 때(incomplete) 보충
  if (result.fiveHour === undefined) {
    const win = toWindow(json.five_hour)
    if (win !== null) result.fiveHour = win
  }
  if (result.weekly === undefined) {
    const win = toWindow(json.seven_day)
    if (win !== null) result.weekly = win
  }

  if (result.fiveHour === undefined && result.weekly === undefined) return null
  return result
}

/**
 * 사용률(0..1)을 밴드로. pct>=criticalPct → critical, >=warnPct → warn, 그 외 ok.
 * 임계값 기본은 TOKEN.warnPct/criticalPct.
 */
export function usageLevel(
  pct: number,
  warnPct: number = TOKEN.warnPct,
  criticalPct: number = TOKEN.criticalPct,
): UsageLevel {
  if (pct >= criticalPct) return 'critical'
  if (pct >= warnPct) return 'warn'
  return 'ok'
}

/** 두 창 중 더 제약적인(높은) 사용률이 밴드를 결정한다. */
export function bandForUsage(
  fiveHourPct: number,
  weeklyPct: number,
  warnPct: number = TOKEN.warnPct,
  criticalPct: number = TOKEN.criticalPct,
): UsageLevel {
  return usageLevel(Math.max(fiveHourPct, weeklyPct), warnPct, criticalPct)
}

/** 한 주(초). windowBand의 주간 창 경과 비율 계산에 쓴다. */
const WEEK_SEC = 7 * 24 * 60 * 60

/**
 * 주간 창의 톤 밴드 — 절대치 위에 페이스 보정을 얹는다(5시간과 달리 긴 창이라 페이스가 의미 있음).
 * critical은 절대치 전용(정말 한도에 임박) — 페이스로 critical을 만들지 않는다. 페이스는 ok→warn만
 * 올린다(리셋 시점 예상 사용률 projected = pct/경과비율 이 임계 이상이면 과속으로 본다).
 * nowSec는 주입 — 내부에서 시계를 읽지 않아 결정적이다.
 */
function weeklyToneLevel(
  w: TokenUsageWindow,
  nowSec: number,
  warnPct: number,
  criticalPct: number,
): UsageLevel {
  const abs = usageLevel(w.pct, warnPct, criticalPct)
  if (abs === 'critical') return 'critical' // critical은 절대치 전용(실제 한도 임박)
  const elapsed = 1 - (w.resetsAt - nowSec) / WEEK_SEC
  if (w.pct >= TOKEN.pacePctFloor && elapsed >= TOKEN.paceMinElapsed && elapsed <= 1) {
    const projected = w.pct / elapsed // 창 끝까지 선형 투영
    if (projected >= TOKEN.paceWarnProjection) return abs === 'ok' ? 'warn' : abs // 페이스는 ok→warn만 상향
  }
  return abs
}

/**
 * 한 창(5시간 또는 주간)의 대사 톤 밴드를 정한다. isWeekly=true면 주간 페이스 인지
 * (weeklyToneLevel — 긴 창이라 리셋까지 남은 시간 대비 사용률로 ok→warn만 상향), false면 5시간
 * 절대치(usageLevel — 짧은 롤링 창이라 페이스가 자기보정적·노이즈가 커서 절대치만 본다). 어느
 * 창을 말할지는 호출자가 정한다(이 함수는 한 창만 본다). 게이지(패널 링)와 분리된 개념 — 링은
 * 절대 사용률만 색으로 쓴다. nowSec는 주입 — 순수·결정적(시계 미접근).
 */
export function windowBand(
  window: TokenUsageWindow,
  isWeekly: boolean,
  nowSec: number,
  warnPct: number = TOKEN.warnPct,
  criticalPct: number = TOKEN.criticalPct,
): UsageLevel {
  return isWeekly
    ? weeklyToneLevel(window, nowSec, warnPct, criticalPct)
    : usageLevel(window.pct, warnPct, criticalPct)
}

/** 밴드 → 게이지 색(hex). */
export function gaugeColor(level: UsageLevel): string {
  return TOKEN.colors[level]
}

/**
 * 리셋 시각 표기(한국어). now는 결정성을 위해 주입 — 내부에서 시계를 읽지 않는다.
 * relative: "H시간 M분 후"(정시면 "H시간 후") / "M분 후"(1시간 미만) / "곧"(1분 미만·이미 리셋).
 * absolute: "요일 H시" (요일·시각은 new Date(resetsAt*1000) 로컬 기준, 일~토).
 */
export function formatReset(resetsAt: number, now: number, mode: 'relative' | 'absolute'): string {
  if (mode === 'absolute') {
    const d = new Date(resetsAt * MS_PER_SEC)
    return `${WEEKDAYS[d.getDay()]} ${d.getHours()}시`
  }
  const diff = resetsAt - now
  if (diff < SEC_PER_MIN) return '곧' // 이미 지났거나(≤0) 1분 미만 임박
  if (diff < SEC_PER_HOUR) {
    return `${Math.floor(diff / SEC_PER_MIN)}분 후`
  }
  const hours = Math.floor(diff / SEC_PER_HOUR)
  const mins = Math.floor((diff % SEC_PER_HOUR) / SEC_PER_MIN)
  return mins === 0 ? `${hours}시간 후` : `${hours}시간 ${mins}분 후`
}

/**
 * 마지막 성공 조회로부터의 경과(초)를 한국어 표기로 — 마지막 성공값을 "N분 전 기준"으로 보여줄 때 쓴다.
 * formatReset과 달리 시계를 아예 읽지 않는다(경과를 인자로만 받아 완전히 결정적). 경계:
 * <60초 → "방금", <60분 → "N분 전", <24시간 → "N시간 전", 그 이상 → "N일 전". 각 구간은 내림.
 * 음수 경과(시계 역행/저장 시점 오차)는 0으로 방어한다.
 */
export function formatAgo(ageSec: number): string {
  const age = ageSec > 0 ? ageSec : 0
  if (age < SEC_PER_MIN) return '방금'
  if (age < SEC_PER_HOUR) return `${Math.floor(age / SEC_PER_MIN)}분 전`
  if (age < SEC_PER_DAY) return `${Math.floor(age / SEC_PER_HOUR)}시간 전`
  return `${Math.floor(age / SEC_PER_DAY)}일 전`
}

/**
 * resolveDisplayUsage 결과. display=표시할 사용량(null=진짜 '연결 안 됨'), staleAgeSec=마지막
 * 성공값을 stale로 보여줄 때의 경과(초, fresh/none이면 undefined), lastKnownGood=갱신된 캐시
 * (라이브 ok면 그 값을 담은 새 항목, 그 외엔 입력 캐시를 그대로 반환 — 호출자가 참조 비교로
 * 영속 재기록 여부를 판단한다).
 */
export interface DisplayUsageResolution {
  display: TokenUsage | null
  staleAgeSec?: number
  lastKnownGood: TokenUsageCache | null
}

/**
 * 라이브 조회 결과 + 기존 last-known-good → 표시 사용량을 정한다(순수·결정적, nowSec 주입).
 *  - live.state==='ok' → live를 fresh로 표시하고 last-known-good을 live로 갱신(savedAt=nowSec).
 *  - live가 unavailable/null(예외) → last-known-good이 있으면 그것을 stale로(age=max(0,nowSec−savedAt)),
 *    없으면 display=null(진짜 연결 안 됨). last-known-good은 그대로 유지한다(동일 참조 반환).
 * 패널 링과 물고기 대사가 함께 이 display를 쓰므로, 끊겨도 마지막 수치가 이어진다.
 */
export function resolveDisplayUsage(
  live: TokenUsage | null,
  lastKnownGood: TokenUsageCache | null,
  nowSec: number,
): DisplayUsageResolution {
  if (live !== null && live.state === 'ok') {
    return { display: live, lastKnownGood: { usage: live, savedAt: nowSec } }
  }
  if (lastKnownGood !== null) {
    const age = Math.max(0, nowSec - lastKnownGood.savedAt)
    return { display: lastKnownGood.usage, staleAgeSec: age, lastKnownGood }
  }
  return { display: null, lastKnownGood: null }
}

/**
 * 스모크/QA 훅 문자열 파싱: "34,87"(퍼센트 0..100 두 개) → { fiveHour: 0.34, weekly: 0.87 }.
 * 공백 허용. 형식 불량(필드≠2개·비수치·빈 필드)·빈 문자열·undefined → null.
 */
export function parseSmokeToken(str: string | undefined): { fiveHour: number; weekly: number } | null {
  if (str === undefined) return null
  const parts = str.split(',')
  if (parts.length !== 2) return null
  const rawA = parts[0].trim()
  const rawB = parts[1].trim()
  if (rawA === '' || rawB === '') return null
  const a = Number(rawA)
  const b = Number(rawB)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return { fiveHour: a / PERCENT, weekly: b / PERCENT }
}
