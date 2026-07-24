import { describe, it, expect } from 'vitest'
import { isCacheFresh, advanceBackoffMs, extractOAuthToken, extractProcessToken } from './tokenUsage'
import { TOKEN } from '../shared/config'

// 순수 결정 로직만 테스트한다(시계는 인자로 주입 → 결정적). 네트워크·Keychain은
// 절대 호출하지 않는다(다운스트림 T8 스모크가 실경로를 검증). RISK=RISKY의 테스트 가능
// 지점(캐시 신선도·429 백오프 스케줄·Keychain JSON 만료 판정)을 test-first로 가드한다.

const MINUTE_MS = 60_000

describe('extractProcessToken — 실행 세션 env 토큰 추출(순수)', () => {
  const long = 'x'.repeat(80)
  it('ps eww 출력에서 CLAUDE_CODE_OAUTH_TOKEN 값을 뽑는다', () => {
    expect(extractProcessToken(`PID TT  STAT USER CLAUDE_CODE_OAUTH_TOKEN=${long} FOO=1`)).toBe(long)
  })
  it('여러 env 사이에서도 공백까지만 추출', () => {
    expect(extractProcessToken(`A=1 CLAUDE_CODE_OAUTH_TOKEN=${long} B=2\nnext`)).toBe(long)
  })
  it('토큰 없으면 null', () => {
    expect(extractProcessToken('PID TT STAT USER SOME_OTHER=abc')).toBeNull()
  })
  it('최소 길이 이하면 null(오탐 방지)', () => {
    expect(extractProcessToken('CLAUDE_CODE_OAUTH_TOKEN=short')).toBeNull()
  })
  it('빈 출력이면 null', () => {
    expect(extractProcessToken('')).toBeNull()
  })
})

describe('isCacheFresh — 캐시 신선도(주입 시계)', () => {
  it('TTL 미만 경과면 fresh(true)', () => {
    expect(isCacheFresh(0, TOKEN.cacheTtlMs - 1)).toBe(true)
  })

  it('정확히 TTL 경과면 stale(false, 경계)', () => {
    expect(isCacheFresh(0, TOKEN.cacheTtlMs)).toBe(false)
  })

  it('TTL 초과면 stale(false)', () => {
    expect(isCacheFresh(0, TOKEN.cacheTtlMs + 1)).toBe(false)
  })

  it('저장 직후(경과 0)면 fresh(true)', () => {
    expect(isCacheFresh(5_000, 5_000)).toBe(true)
  })

  it('시계 역행(now < storedAt)이어도 방어적으로 fresh(true)', () => {
    expect(isCacheFresh(5_000, 4_000)).toBe(true)
  })

  it('커스텀 TTL을 주입할 수 있다', () => {
    expect(isCacheFresh(0, 3, 5)).toBe(true)
    expect(isCacheFresh(0, 5, 5)).toBe(false)
    expect(isCacheFresh(0, 10, 5)).toBe(false)
  })
})

describe('advanceBackoffMs — 429 지수 백오프 스케줄(순수)', () => {
  // 기본 스케줄: base=TOKEN.pollIntervalMs(10분), ×2, 60분 상한 →
  // 10→20→40→60→60(분). 레퍼런스 App.swift(min(3600s, backoff*2), base 600s) 미러.
  it('백오프 없음(0)에서 시작하면 최소치(=10분)로', () => {
    expect(advanceBackoffMs(0)).toBe(TOKEN.pollIntervalMs)
    expect(advanceBackoffMs(0)).toBe(10 * MINUTE_MS)
  })

  it('10분 → 20분', () => {
    expect(advanceBackoffMs(10 * MINUTE_MS)).toBe(20 * MINUTE_MS)
  })

  it('20분 → 40분', () => {
    expect(advanceBackoffMs(20 * MINUTE_MS)).toBe(40 * MINUTE_MS)
  })

  it('40분 → 60분(상한 클램프)', () => {
    expect(advanceBackoffMs(40 * MINUTE_MS)).toBe(60 * MINUTE_MS)
  })

  it('60분 → 60분(상한에서 정체)', () => {
    expect(advanceBackoffMs(60 * MINUTE_MS)).toBe(60 * MINUTE_MS)
  })

  it('최소치 미만 값은 최소치로 끌어올린다(하한)', () => {
    expect(advanceBackoffMs(10, 50, 400, 2)).toBe(50)
  })

  it('커스텀 (min,max,factor) 주입', () => {
    expect(advanceBackoffMs(100, 50, 400, 2)).toBe(200)
    expect(advanceBackoffMs(300, 50, 400, 2)).toBe(400) // min(400, 600)
  })
})

describe('extractOAuthToken — Keychain JSON 파싱 + 만료 판정(주입 시계)', () => {
  const NOW_MS = 1_000_000_000_000
  // 길이 > 20의 명백한 가짜 값(실제 비밀 아님). 만료 판정·파싱 경로만 검증한다.
  const FAKE = 'sk-ant-oat-FAKE-0123456789abcdefghij'

  it('claudeAiOauth 래퍼 + 미래 만료 → accessToken 반환', () => {
    const json = JSON.stringify({ claudeAiOauth: { accessToken: FAKE, expiresAt: NOW_MS + 1_000 } })
    expect(extractOAuthToken(json, NOW_MS)).toBe(FAKE)
  })

  it('expiresAt 없으면 만료 검사 생략 → 반환(레퍼런스 미러)', () => {
    const json = JSON.stringify({ claudeAiOauth: { accessToken: FAKE } })
    expect(extractOAuthToken(json, NOW_MS)).toBe(FAKE)
  })

  it('expiresAt이 과거(ms 에폭)면 만료 → null', () => {
    const json = JSON.stringify({ claudeAiOauth: { accessToken: FAKE, expiresAt: NOW_MS - 1 } })
    expect(extractOAuthToken(json, NOW_MS)).toBeNull()
  })

  it('expiresAt === now는 아직 만료 아님(< 판정, 경계) → 반환', () => {
    const json = JSON.stringify({ claudeAiOauth: { accessToken: FAKE, expiresAt: NOW_MS } })
    expect(extractOAuthToken(json, NOW_MS)).toBe(FAKE)
  })

  it('래퍼 없이 최상위가 oauth여도 처리(레퍼런스 폴백)', () => {
    const json = JSON.stringify({ accessToken: FAKE, expiresAt: NOW_MS + 1 })
    expect(extractOAuthToken(json, NOW_MS)).toBe(FAKE)
  })

  it('비수치 expiresAt(문자열)은 무시 → 반환', () => {
    const json = JSON.stringify({ claudeAiOauth: { accessToken: FAKE, expiresAt: 'soon' } })
    expect(extractOAuthToken(json, NOW_MS)).toBe(FAKE)
  })

  it('accessToken 길이가 20(경계) 이하면 → null', () => {
    const short = 'a'.repeat(20)
    const json = JSON.stringify({ claudeAiOauth: { accessToken: short } })
    expect(extractOAuthToken(json, NOW_MS)).toBeNull()
  })

  it('accessToken 길이 21이면 통과(경계)', () => {
    const ok = 'a'.repeat(21)
    const json = JSON.stringify({ claudeAiOauth: { accessToken: ok } })
    expect(extractOAuthToken(json, NOW_MS)).toBe(ok)
  })

  it('accessToken이 문자열이 아니면 → null', () => {
    const json = JSON.stringify({ claudeAiOauth: { accessToken: 12345 } })
    expect(extractOAuthToken(json, NOW_MS)).toBeNull()
  })

  it('accessToken 부재 → null', () => {
    expect(extractOAuthToken(JSON.stringify({ claudeAiOauth: {} }), NOW_MS)).toBeNull()
  })

  it('깨진 JSON → null(never throw)', () => {
    expect(extractOAuthToken('{not valid json', NOW_MS)).toBeNull()
  })

  it('레코드가 아닌 JSON(숫자/문자열/배열) → null', () => {
    expect(extractOAuthToken('42', NOW_MS)).toBeNull()
    expect(extractOAuthToken('"str"', NOW_MS)).toBeNull()
    expect(extractOAuthToken('[1,2,3]', NOW_MS)).toBeNull()
  })

  it('빈 문자열 → null', () => {
    expect(extractOAuthToken('', NOW_MS)).toBeNull()
  })
})
