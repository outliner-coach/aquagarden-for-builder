import { execFileSync } from 'node:child_process'
import os from 'node:os'
import { TOKEN } from '../shared/config'
import {
  parseUsageResponse,
  parseSmokeToken,
  parseSmokeStaleAge,
  type ParsedUsage,
} from '../shared/tokenHelpers'
import type { TokenUsage } from '../shared/types'

/**
 * main(Node) 전용 토큰 사용량 조회. Anthropic 공식 OAuth 사용률 API를 읽어 계정 전체 %·리셋
 * 시각을 얻고, 인메모리 캐시(TOKEN.cacheTtlMs)로 중복 조회를, 429 지수 백오프로 레이트리밋
 * 과다 호출을 막는다. 스키마·토큰 출처·백오프 패턴은 레퍼런스(token_dashboard: Official.swift,
 * App.swift)를 그대로 옮긴 것.
 *
 * 보안(하드 게이트): OAuth 토큰은 절대 로그/stdout/디스크/반환 TokenUsage에 남기지 않는다 —
 * 오직 로컬 변수로만 취급한다(획득 → Authorization 헤더에 즉시 사용 → 스코프 소멸). 캐시는
 * TokenUsage(토큰 필드 없음)만 담는다. getTokenUsage는 호출자에게 절대 throw하지 않는다
 * (내부에서 모두 잡아 state:'unavailable'로).
 *
 * 부수효과(Keychain/네트워크)는 이 파일에 격리하고, 순수 결정 로직(캐시 신선도·백오프 스케줄·
 * Keychain 만료 판정)은 시계를 주입받는 export 함수로 분리해 tokenUsage.test.ts가 test-first로
 * 가드한다(RISK=RISKY: 실제 네트워크/Keychain은 테스트하지 않음).
 */

// 단위·프로토콜 상수 (매직 넘버 회피).
const MS_PER_SEC = 1000
const HTTP_TOO_MANY_REQUESTS = 429
/** Keychain accessToken 최소 길이(초과여야 유효). 레퍼런스 Official.swift: token.count > 20. */
const MIN_TOKEN_LEN = 20
/** Claude Code CLI가 관리하는 Keychain 항목명(레퍼런스와 동일). */
const KEYCHAIN_SERVICE = 'Claude Code-credentials'
/** 우선순위 ② 환경변수 이름. */
const ENV_TOKEN_KEY = 'CLAUDE_CODE_OAUTH_TOKEN'
/**
 * ps eww로 스캔할 claude 매칭 프로세스 상한. 실행 중인 Claude Code 세션 자체가 'claude' 매칭
 * 프로세스를 여럿(20+) 띄우면 토큰 보유 프로세스가 뒤로 밀려, 상한이 낮으면 놓친다(라이브에서
 * 실제로 26개 중 토큰이 21번째 이후라 head-20이 놓침). 넉넉히 잡되 인자 폭주는 막는다.
 */
const MAX_SCAN_PROCS = 100

/**
 * 429 백오프 스케줄. 레퍼런스 App.swift: officialBackoff = min(cap, ×factor), base 600s.
 * 하한(base)은 TOKEN.pollIntervalMs(10분)와 동일 값이라 재사용하고, 상한·배율은 TOKEN에 둔다.
 */
const BACKOFF_MIN_MS = TOKEN.pollIntervalMs // 10분(정상 폴링 간격 = 백오프 하한)

/** 스모크 resetsAt 스텁(초). 결정적 평가를 위해 near-future 고정 오프셋. */
const SMOKE_RESET_STUB_SEC = 60 * 60 // 1시간 후
/** 요청 식별용 User-Agent(레퍼런스도 지정 — 일부 엔드포인트가 UA 부재를 거절). */
const USER_AGENT = 'Aquagarden/1.0 (local)'

// ─────────────────────────────────────────────────────────────────────────────
// 순수 결정 로직 (시계 주입 · export 하여 유닛테스트) — 네트워크/스토리지/시계 접근 없음.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 캐시 신선도(순수·주입 시계). 저장 시각(ms)으로부터 ttlMs 미만 경과면 fresh(true).
 * 경계(정확히 ttl 경과)는 stale로 본다(재조회). 시계 역행(now<stored)도 fresh로 방어한다.
 */
export function isCacheFresh(
  storedAtMs: number,
  nowMs: number,
  ttlMs: number = TOKEN.cacheTtlMs,
): boolean {
  return nowMs - storedAtMs < ttlMs
}

/**
 * 429 지수 백오프 다음 값(순수·주입 파라미터). currentMs를 factor배로 늘리되 [minMs, maxMs]로
 * 클램프한다. current=0(백오프 없음)에서 시작하면 minMs → minMs×factor → … → maxMs로 수렴.
 * 기본값 스케줄(10분 base, ×2, 60분 cap): 10→20→40→60→60(분). 레퍼런스 App.swift 미러.
 */
export function advanceBackoffMs(
  currentMs: number,
  minMs: number = BACKOFF_MIN_MS,
  maxMs: number = TOKEN.backoffMaxMs,
  factor: number = TOKEN.backoffFactor,
): number {
  return Math.min(maxMs, Math.max(minMs, currentMs * factor))
}

/**
 * 조회 실패(429/네트워크/자격증명 없음) 시 반환할 스냅샷(순수·주입 시각). 마지막 성공 캐시가
 * 있으면 값은 그대로 이어 보여주되 `stale: true`를 실어 보낸다 — 이 플래그가 없으면 렌더러가
 * state:'ok'만 보고 fresh로 오판해 오래된 값을 현재값처럼 표시한다(2026-07-27 실기기: 429
 * 락아웃 55시간 동안 옛 값이 최신처럼 노출된 회귀). 캐시가 없으면 진짜 'unavailable'.
 * 원본 캐시 객체는 변형하지 않는다(복사).
 */
export function staleOrUnavailable(cached: TokenUsage | null, nowSec: number): TokenUsage {
  if (cached === null) return { state: 'unavailable', fetchedAt: nowSec }
  return { ...cached, stale: true }
}

/**
 * Keychain 항목 JSON에서 OAuth accessToken을 추출한다(순수·주입 시계·never throw). 레퍼런스
 * Official.swift.tokenFromKeychain 미러: `{ claudeAiOauth: { accessToken, expiresAt } }`, 래퍼가
 * 없으면 최상위를 oauth로 간주. accessToken은 길이 > MIN_TOKEN_LEN인 문자열이어야 하고, expiresAt이
 * 수치(ms 에폭)이며 nowMs보다 과거면 만료로 보고 null. 파싱 불가/부적합은 모두 null.
 * 반환 문자열(토큰)은 호출자가 즉시 로컬로만 소비한다(로그·저장 금지).
 */
export function extractOAuthToken(jsonText: string, nowMs: number): string | null {
  let obj: unknown
  try {
    obj = JSON.parse(jsonText)
  } catch {
    return null
  }
  if (!isRecord(obj)) return null
  const wrapped = obj['claudeAiOauth']
  const oauth = isRecord(wrapped) ? wrapped : obj
  const token = oauth['accessToken']
  if (typeof token !== 'string' || token.length <= MIN_TOKEN_LEN) return null
  const expiresAt = oauth['expiresAt']
  if (typeof expiresAt === 'number' && Number.isFinite(expiresAt) && expiresAt < nowMs) {
    return null // 만료(레퍼런스: expiresAt은 ms 에폭)
  }
  return token
}

// ─────────────────────────────────────────────────────────────────────────────
// 내부 헬퍼 (부수효과 포함) — export 하지 않는다.
// ─────────────────────────────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function nowSeconds(): number {
  return Math.floor(Date.now() / MS_PER_SEC)
}

function unavailable(fetchedAtSec: number): TokenUsage {
  return { state: 'unavailable', fetchedAt: fetchedAtSec }
}

/** ParsedUsage(창만) → TokenUsage(state:'ok'). 토큰/자격증명 필드는 담지 않는다. */
function buildUsage(parsed: ParsedUsage): TokenUsage {
  const usage: TokenUsage = { state: 'ok', fetchedAt: nowSeconds() }
  if (parsed.fiveHour !== undefined) usage.fiveHour = parsed.fiveHour
  if (parsed.weekly !== undefined) usage.weekly = parsed.weekly
  return usage
}

function isSmoke(): boolean {
  return process.env['AQUA_SMOKE'] === '1'
}

/**
 * 스모크 격리 경로: Keychain/네트워크를 절대 건드리지 않고 AQUA_SMOKE_TOKEN("fiveHour,weekly"
 * 퍼센트)만으로 결정적 스냅샷을 만든다. 미설정/형식불량이면 unavailable. 실제 레이트리밋 미소모.
 */
function smokeUsage(): TokenUsage {
  const parsed = parseSmokeToken(process.env['AQUA_SMOKE_TOKEN'])
  if (parsed === null) return unavailable(nowSeconds())
  const resetsAt = nowSeconds() + SMOKE_RESET_STUB_SEC
  // AQUA_SMOKE_TOKEN_STALE=<초>: 라이브 실패 상태(마지막 성공값 표시)를 강제해 흐린 링 +
  // "N분 전 기준" 노트를 캡처 검증한다. 미지정이면 평소처럼 fresh.
  const staleAgeSec = parseSmokeStaleAge(process.env['AQUA_SMOKE_TOKEN_STALE'])
  const usage: TokenUsage = {
    state: 'ok',
    fiveHour: { pct: parsed.fiveHour, resetsAt },
    weekly: { pct: parsed.weekly, resetsAt },
    fetchedAt: staleAgeSec === null ? nowSeconds() : nowSeconds() - staleAgeSec,
  }
  if (staleAgeSec !== null) usage.stale = true
  return usage
}

/**
 * 토큰 확보(우선순위): ① 실행 중인 Claude 세션 env의 CLAUDE_CODE_OAUTH_TOKEN(항상 신선) → ②
 * macOS Keychain 'Claude Code-credentials'(만료 안 됐을 때만) → ③ 직접 지정한 환경변수. 모두 없으면
 * null. Keychain 저장 accessToken은 CLI가 메모리에서 갱신해 자주 만료 상태이므로 실행 세션 토큰을
 * 우선한다(token_dashboard와 동일 전략). 반환 토큰은 로컬로만 다룬다(로그 금지).
 */
function acquireToken(): string | null {
  const fromProc = tokenFromRunningProcess()
  if (fromProc !== null) return fromProc
  const fromKeychain = tokenFromKeychain()
  if (fromKeychain !== null) return fromKeychain
  const env = process.env[ENV_TOKEN_KEY]
  if (typeof env === 'string' && env.trim().length > 0) return env.trim()
  return null
}

/**
 * macOS Keychain에서 토큰을 읽는다. `security find-generic-password -s <svc> -a <user> -w`로 항목
 * JSON을 얻어 extractOAuthToken으로 파싱·만료 검사. macOS가 아니거나 항목 없음/권한 거부 등은
 * 조용히 null(폴백). 비밀 누출 방지를 위해 raw 출력·오류를 절대 로깅하지 않는다(stderr는 버림).
 */
function tokenFromKeychain(): string | null {
  if (process.platform !== 'darwin') return null // security(1)은 macOS 전용
  try {
    const user = os.userInfo().username
    const raw = execFileSync(
      'security',
      ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', user, '-w'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: TOKEN.requestTimeoutMs },
    )
    return extractOAuthToken(raw, Date.now())
  } catch {
    return null // 항목 없음/security 실패 — 토큰·오류를 로깅하지 않는다
  }
}

/**
 * 실행 중인 Claude 세션의 프로세스 env에서 CLAUDE_CODE_OAUTH_TOKEN을 읽는다(신선한 토큰). pgrep으로
 * claude pid를 찾아 `ps eww`로 env를 덤프하고 extractProcessToken으로 추출한다. Windows 미지원(null).
 * 실패/미발견은 조용히 null. 토큰·오류는 로깅하지 않는다(security 규칙).
 */
function tokenFromRunningProcess(): string | null {
  if (process.platform === 'win32') return null // pgrep/ps eww는 unix 전용
  try {
    const pidsRaw = execFileSync('pgrep', ['-f', 'claude'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: TOKEN.requestTimeoutMs,
    })
    const pids = pidsRaw
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => /^\d+$/.test(s))
      .slice(0, MAX_SCAN_PROCS)
    if (pids.length === 0) return null
    const out = execFileSync('ps', ['eww', ...pids], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: TOKEN.requestTimeoutMs,
    })
    return extractProcessToken(out)
  } catch {
    return null // pgrep/ps 실패 — 로깅하지 않는다
  }
}

/** `ps eww` 출력에서 CLAUDE_CODE_OAUTH_TOKEN 값을 추출한다(순수). 최소 길이 초과만 유효. */
export function extractProcessToken(psOutput: string): string | null {
  const m = psOutput.match(/CLAUDE_CODE_OAUTH_TOKEN=(\S+)/)
  if (m === null) return null
  const tok = m[1]
  return tok.length > MIN_TOKEN_LEN ? tok : null
}

type FetchOutcome =
  | { kind: 'ok'; usage: TokenUsage }
  | { kind: 'rate-limited' }
  | { kind: 'failed' }

/**
 * 공식 사용률 API GET. Authorization: Bearer <token> + anthropic-beta 헤더, AbortController로
 * TOKEN.requestTimeoutMs 후 취소. 200이면 parseUsageResponse로 파싱, 429는 rate-limited,
 * 그 외 비200·타임아웃·네트워크 오류·파싱 실패는 failed. 절대 throw하지 않는다. 토큰은 헤더에만
 * 쓰이고 이 함수를 벗어나지 않는다.
 */
async function fetchUsage(token: string): Promise<FetchOutcome> {
  const controller = new AbortController()
  const timer: ReturnType<typeof setTimeout> = setTimeout(
    () => controller.abort(),
    TOKEN.requestTimeoutMs,
  )
  try {
    const res = await fetch(TOKEN.apiUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'anthropic-beta': TOKEN.betaHeader,
        'User-Agent': USER_AGENT,
      },
      signal: controller.signal,
    })
    if (res.status === HTTP_TOO_MANY_REQUESTS) return { kind: 'rate-limited' }
    if (!res.ok) return { kind: 'failed' }
    const json: unknown = await res.json()
    const parsed = parseUsageResponse(json)
    if (parsed === null) return { kind: 'failed' }
    return { kind: 'ok', usage: buildUsage(parsed) }
  } catch {
    return { kind: 'failed' } // 타임아웃(abort)·네트워크 오류 — 절대 throw 안 함
  } finally {
    clearTimeout(timer)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 인메모리 상태 + 공개 진입점.
// ─────────────────────────────────────────────────────────────────────────────

let cache: TokenUsage | null = null // 마지막 성공(state:'ok') 스냅샷 — 토큰 필드 없음
let cacheStoredAtMs = 0 // cache 저장 시각(ms, 신선도 판정)
let currentBackoffMs = 0 // 현재 429 백오프 폭(0=백오프 없음)
let backoffUntilMs = 0 // 이 시각(ms) 전에는 429 백오프로 fetch 억제
let inFlight: Promise<TokenUsage> | null = null // 진행 중 조회(중복 fetch 방지 = 레이트리밋 보호)

/**
 * 현재 토큰 사용량을 반환한다. 신선한 캐시가 있으면 즉시 그 값을, 아니면 새로 조회한다. 스모크
 * 모드(AQUA_SMOKE==='1')에서는 Keychain·네트워크를 건드리지 않고 AQUA_SMOKE_TOKEN 기반 결정적
 * 값을 낸다. 어떤 경우에도 throw하지 않는다(실패 → state:'unavailable', 단 마지막 성공 캐시가
 * 있으면 그 값을 유지).
 */
export async function getTokenUsage(): Promise<TokenUsage> {
  try {
    if (isSmoke()) return smokeUsage() // 스모크: 실경로 완전 격리(레이트리밋 미소모)

    const nowMs = Date.now()
    if (cache !== null && isCacheFresh(cacheStoredAtMs, nowMs)) return cache // 신선 캐시
    if (inFlight !== null) return inFlight // 진행 중 요청에 합류(중복 fetch 방지)

    inFlight = doRefresh(nowMs).finally(() => {
      inFlight = null
    })
    return inFlight
  } catch {
    // 동기 구간의 예기치 못한 오류까지 방어(스펙 하드 게이트: 절대 throw 금지).
    return staleOrUnavailable(cache, nowSeconds())
  }
}

/**
 * 실제 조회 1회(never throw). 백오프 창 안이면 억제, 토큰 없으면 unavailable, 조회 결과에 따라
 * 캐시·백오프 상태를 갱신한다. 실패/백오프 시 마지막 성공 캐시가 있으면 유지한다.
 */
async function doRefresh(nowMs: number): Promise<TokenUsage> {
  try {
    if (nowMs < backoffUntilMs) return staleOrUnavailable(cache, nowSeconds()) // 429 백오프 창

    const token = acquireToken()
    if (token === null) return staleOrUnavailable(cache, nowSeconds()) // 자격증명 없음

    const outcome = await fetchUsage(token)
    // 여기서부터 token은 더 이상 참조되지 않고 스코프를 벗어난다(어디에도 저장 안 됨).

    if (outcome.kind === 'ok') {
      cache = outcome.usage
      cacheStoredAtMs = Date.now()
      currentBackoffMs = 0 // 성공 → 백오프 리셋
      backoffUntilMs = 0
      return cache
    }
    if (outcome.kind === 'rate-limited') {
      currentBackoffMs = advanceBackoffMs(currentBackoffMs) // 10→20→40→60분
      backoffUntilMs = Date.now() + currentBackoffMs
      return staleOrUnavailable(cache, nowSeconds()) // 캐시 유지(있으면)
    }
    // failed(비200/타임아웃/파싱): 429가 아니므로 백오프 리셋, 캐시 유지.
    currentBackoffMs = 0
    backoffUntilMs = 0
    return staleOrUnavailable(cache, nowSeconds())
  } catch {
    currentBackoffMs = 0
    backoffUntilMs = 0
    return staleOrUnavailable(cache, nowSeconds())
  }
}
