import { describe, it, expect } from 'vitest'
import {
  parseUsageResponse,
  usageLevel,
  bandForUsage,
  windowBand,
  gaugeColor,
  formatReset,
  parseSmokeToken,
  formatAgo,
  resolveDisplayUsage,
} from './tokenHelpers'
import { TOKEN } from './config'
import type { TokenUsage, TokenUsageCache } from './types'

describe('parseUsageResponse — limits[]', () => {
  it("kind 'session'을 fiveHour로 매핑 (utilization 0..100 → 0..1)", () => {
    const r = parseUsageResponse({ limits: [{ kind: 'session', utilization: 80 }] })
    expect(r?.fiveHour?.pct).toBe(0.8)
    expect(r?.weekly).toBeUndefined()
  })

  it("kind에 'five'가 포함되면 fiveHour로 매핑", () => {
    const r = parseUsageResponse({ limits: [{ kind: 'five_hour', utilization: 25 }] })
    expect(r?.fiveHour?.pct).toBe(0.25)
  })

  it("kind 'weekly_all'을 weekly로 매핑", () => {
    const r = parseUsageResponse({ limits: [{ kind: 'weekly_all', utilization: 45 }] })
    expect(r?.weekly?.pct).toBe(0.45)
    expect(r?.fiveHour).toBeUndefined()
  })

  it("kind 'weekly_scoped'은 완전히 무시", () => {
    const r = parseUsageResponse({
      limits: [
        { kind: 'weekly_scoped', utilization: 90 },
        { kind: 'session', utilization: 10 },
      ],
    })
    expect(r?.weekly).toBeUndefined()
    expect(r?.fiveHour?.pct).toBe(0.1)
  })

  it('utilization이 없으면 percent 필드로 폴백', () => {
    const r = parseUsageResponse({ limits: [{ kind: 'session', percent: 50 }] })
    expect(r?.fiveHour?.pct).toBe(0.5)
  })

  it('utilization 100 → pct 1.0, 0 → 0 (경계)', () => {
    const hi = parseUsageResponse({ limits: [{ kind: 'session', utilization: 100 }] })
    const lo = parseUsageResponse({ limits: [{ kind: 'weekly_all', utilization: 0 }] })
    expect(hi?.fiveHour?.pct).toBe(1)
    expect(lo?.weekly?.pct).toBe(0)
  })

  it('resets_at ISO8601 문자열 → epoch 초', () => {
    const iso = '2026-07-23T18:00:00.254192+00:00'
    const expected = Math.floor(Date.parse('2026-07-23T18:00:00Z') / 1000)
    const r = parseUsageResponse({ limits: [{ kind: 'session', utilization: 50, resets_at: iso }] })
    expect(r?.fiveHour?.resetsAt).toBe(expected)
  })

  it('resets_at이 없으면 resetsAt 0으로 방어', () => {
    const r = parseUsageResponse({ limits: [{ kind: 'session', utilization: 50 }] })
    expect(r?.fiveHour?.resetsAt).toBe(0)
  })

  it('두 창을 동시에 파싱', () => {
    const r = parseUsageResponse({
      limits: [
        { kind: 'session', utilization: 30 },
        { kind: 'weekly_all', utilization: 70 },
      ],
    })
    expect(r?.fiveHour?.pct).toBe(0.3)
    expect(r?.weekly?.pct).toBe(0.7)
  })
})

describe('parseUsageResponse — 톱레벨 폴백', () => {
  it('limits가 없으면 top-level five_hour / seven_day로 폴백', () => {
    const r = parseUsageResponse({
      five_hour: { utilization: 33 },
      seven_day: { utilization: 12 },
    })
    expect(r?.fiveHour?.pct).toBe(0.33)
    expect(r?.weekly?.pct).toBe(0.12)
  })

  it('limits가 불완전하면(session만) 빈 창을 seven_day로 보충', () => {
    const r = parseUsageResponse({
      limits: [{ kind: 'session', utilization: 40 }],
      seven_day: { utilization: 88 },
    })
    expect(r?.fiveHour?.pct).toBe(0.4)
    expect(r?.weekly?.pct).toBe(0.88)
  })

  it('limits가 배열이 아니어도 폴백 경로로 안전 처리', () => {
    const r = parseUsageResponse({ limits: 'nope', five_hour: { percent: 20 } })
    expect(r?.fiveHour?.pct).toBe(0.2)
  })
})

describe('parseUsageResponse — 방어(never throw, null when unusable)', () => {
  it('null → null', () => {
    expect(parseUsageResponse(null)).toBeNull()
  })

  it('문자열/숫자/배열 → null', () => {
    expect(parseUsageResponse('x')).toBeNull()
    expect(parseUsageResponse(42)).toBeNull()
    expect(parseUsageResponse([{ kind: 'session', utilization: 10 }])).toBeNull()
  })

  it('빈 객체 → null', () => {
    expect(parseUsageResponse({})).toBeNull()
  })

  it('limits가 빈 배열이고 폴백도 없으면 → null', () => {
    expect(parseUsageResponse({ limits: [] })).toBeNull()
  })

  it('숫자 필드가 전혀 없으면(파싱 가능한 것 없음) → null', () => {
    expect(parseUsageResponse({ limits: [{ kind: 'session' }] })).toBeNull()
  })

  it('utilization이 비수치(문자열)면 무시', () => {
    expect(parseUsageResponse({ limits: [{ kind: 'session', utilization: 'high' }] })).toBeNull()
  })
})

describe('usageLevel', () => {
  it('warnPct 미만이면 ok', () => {
    expect(usageLevel(0.5)).toBe('ok')
  })

  it('정확히 warnPct면 warn (경계)', () => {
    expect(usageLevel(TOKEN.warnPct)).toBe('warn')
  })

  it('warn 대역', () => {
    expect(usageLevel(0.9)).toBe('warn')
  })

  it('정확히 criticalPct면 critical (경계)', () => {
    expect(usageLevel(TOKEN.criticalPct)).toBe('critical')
  })

  it('criticalPct 초과면 critical', () => {
    expect(usageLevel(1.0)).toBe('critical')
  })

  it('커스텀 임계값 사용', () => {
    expect(usageLevel(0.5, 0.4, 0.6)).toBe('warn')
    expect(usageLevel(0.6, 0.4, 0.6)).toBe('critical')
    expect(usageLevel(0.3, 0.4, 0.6)).toBe('ok')
  })
})

describe('bandForUsage — 더 제약적인 창이 밴드를 결정 (max)', () => {
  it('fiveHour가 더 높을 때', () => {
    expect(bandForUsage(0.9, 0.1)).toBe('warn')
  })

  it('weekly가 더 높을 때', () => {
    expect(bandForUsage(0.1, 0.97)).toBe('critical')
  })

  it('둘 다 낮으면 ok', () => {
    expect(bandForUsage(0.1, 0.2)).toBe('ok')
  })

  it('usageLevel(max)와 동일', () => {
    expect(bandForUsage(0.82, 0.5)).toBe(usageLevel(0.82))
  })

  it('커스텀 임계값 전달', () => {
    expect(bandForUsage(0.5, 0.55, 0.5, 0.9)).toBe('warn')
  })
})

describe('windowBand — 주간(isWeekly=true)은 페이스 인지', () => {
  const WEEK = 7 * 24 * 60 * 60
  const NOW = 1_700_000_000
  // 경과 비율(0..1)로부터 resetsAt 역산: elapsed = 1 - (resetsAt - now) / WEEK.
  const resetAtElapsed = (elapsed: number): number => NOW + Math.round((1 - elapsed) * WEEK)

  it('사용자 시나리오: 주간 34%인데 창 초반(~14% 경과) → 과속 → warn', () => {
    const weekly = { pct: 0.34, resetsAt: resetAtElapsed(1 / 7) } // ~14.3% 경과 → projected ~2.4
    expect(windowBand(weekly, true, NOW)).toBe('warn')
  })

  it('같은 34%라도 창 중반(~60% 경과)이면 정상 페이스 → ok', () => {
    const weekly = { pct: 0.34, resetsAt: resetAtElapsed(0.6) } // projected ~0.57
    expect(windowBand(weekly, true, NOW)).toBe('ok')
  })

  it('pacePctFloor 미만(주간 5%)은 과속이어도 여유로 봄 → ok', () => {
    const weekly = { pct: 0.05, resetsAt: resetAtElapsed(0.035) } // projected ~1.43(≥1.2)지만 pct<floor
    expect(windowBand(weekly, true, NOW)).toBe('ok')
  })

  it('주간 절대 critical(97%)은 페이스와 무관하게 critical', () => {
    const weekly = { pct: 0.97, resetsAt: resetAtElapsed(0.9) } // 경과가 많아도(느린 페이스) 절대 critical
    expect(windowBand(weekly, true, NOW)).toBe('critical')
  })

  it('주간 페이스는 ok→warn만 올린다 (절대 warn 대역+과속이어도 critical로는 못 만든다)', () => {
    const weekly = { pct: 0.85, resetsAt: resetAtElapsed(0.5) } // 절대 warn(≥0.8), projected 1.7(≥1.2)
    expect(windowBand(weekly, true, NOW)).toBe('warn')
  })

  it('nowSec를 주입받아 결정적이다 (같은 입력 반복 호출 시 불변, 시계 미접근)', () => {
    const wk = { pct: 0.34, resetsAt: resetAtElapsed(1 / 7) }
    const first = windowBand(wk, true, NOW)
    for (let i = 0; i < 10; i++) {
      expect(windowBand(wk, true, NOW)).toBe(first)
    }
  })

  it('커스텀 임계값을 전달할 수 있다 (warnPct/criticalPct override)', () => {
    // 절대 40%면 커스텀 warn 임계(0.4)로 warn — 정상 페이스여도 절대치가 이미 warn
    const weekly = { pct: 0.4, resetsAt: resetAtElapsed(0.9) }
    expect(windowBand(weekly, true, NOW, 0.4, 0.9)).toBe('warn')
  })
})

describe('windowBand — 5시간(isWeekly=false)은 절대치 전용(페이스 무보정)', () => {
  const NOW = 1_700_000_000

  it('신선한 5시간 창 50%는 절대치로 ok (창 초반이어도 페이스 보정 없음)', () => {
    const fiveHour = { pct: 0.5, resetsAt: NOW + 5 * 3600 } // 방금 시작한 5시간 블록
    expect(windowBand(fiveHour, false, NOW)).toBe('ok')
  })

  it('정확히 warnPct(경계)면 warn', () => {
    expect(windowBand({ pct: TOKEN.warnPct, resetsAt: NOW + 1800 }, false, NOW)).toBe('warn')
  })

  it('5시간 90% → warn (절대치)', () => {
    expect(windowBand({ pct: 0.9, resetsAt: NOW + 1800 }, false, NOW)).toBe('warn')
  })

  it('5시간 97% → critical (절대치)', () => {
    expect(windowBand({ pct: 0.97, resetsAt: NOW + 1800 }, false, NOW)).toBe('critical')
  })

  it('resetsAt/경과와 무관 — 같은 pct면 창 초반이든 임박이든 같은 밴드(페이스 미적용)', () => {
    const early = { pct: 0.5, resetsAt: NOW + 5 * 3600 }
    const late = { pct: 0.5, resetsAt: NOW + 60 }
    expect(windowBand(early, false, NOW)).toBe(windowBand(late, false, NOW))
    expect(windowBand(early, false, NOW)).toBe('ok')
  })

  it('usageLevel(절대치)과 동일한 결과를 낸다', () => {
    const w = { pct: 0.82, resetsAt: NOW + 1800 }
    expect(windowBand(w, false, NOW)).toBe(usageLevel(w.pct))
  })
})

describe('gaugeColor', () => {
  it('ok', () => {
    expect(gaugeColor('ok')).toBe(TOKEN.colors.ok)
  })
  it('warn', () => {
    expect(gaugeColor('warn')).toBe(TOKEN.colors.warn)
  })
  it('critical', () => {
    expect(gaugeColor('critical')).toBe(TOKEN.colors.critical)
  })
})

describe('formatReset — relative', () => {
  const now = 1_000_000

  it('1시간 초과: "H시간 M분 후"', () => {
    expect(formatReset(now + 2 * 3600 + 11 * 60, now, 'relative')).toBe('2시간 11분 후')
  })

  it('정확히 정시(분=0): "H시간 후"', () => {
    expect(formatReset(now + 3 * 3600, now, 'relative')).toBe('3시간 후')
  })

  it('1시간 미만: "M분 후"', () => {
    expect(formatReset(now + 45 * 60, now, 'relative')).toBe('45분 후')
  })

  it('정확히 1시간 경계', () => {
    expect(formatReset(now + 3600, now, 'relative')).toBe('1시간 후')
  })

  it('1분 미만(임박) → "곧"', () => {
    expect(formatReset(now + 30, now, 'relative')).toBe('곧')
  })

  it('이미 리셋됨(diff 0) → "곧"', () => {
    expect(formatReset(now, now, 'relative')).toBe('곧')
  })

  it('음수(과거) → "곧"', () => {
    expect(formatReset(now - 500, now, 'relative')).toBe('곧')
  })
})

describe('formatReset — absolute (요일+시)', () => {
  it('요일(일~토) + 24시간 시각, now는 무시', () => {
    // 로컬 타임존과 무관하도록 입력·기대값을 같은 로컬 Date에서 파생
    const local = new Date(2026, 6, 23, 18, 30, 0, 0)
    const resetsAt = Math.floor(local.getTime() / 1000)
    const wd = ['일', '월', '화', '수', '목', '금', '토'][local.getDay()]
    expect(formatReset(resetsAt, 1_000, 'absolute')).toBe(`${wd} 18시`)
  })

  it('자정(0시) 표기', () => {
    const local = new Date(2026, 0, 1, 0, 5, 0, 0)
    const resetsAt = Math.floor(local.getTime() / 1000)
    const wd = ['일', '월', '화', '수', '목', '금', '토'][local.getDay()]
    expect(formatReset(resetsAt, 0, 'absolute')).toBe(`${wd} 0시`)
  })
})

describe('parseSmokeToken', () => {
  it('"34,87" → {0.34, 0.87}', () => {
    expect(parseSmokeToken('34,87')).toEqual({ fiveHour: 0.34, weekly: 0.87 })
  })

  it('공백 허용', () => {
    expect(parseSmokeToken('  12 , 6 ')).toEqual({ fiveHour: 0.12, weekly: 0.06 })
  })

  it('0,100 경계', () => {
    expect(parseSmokeToken('0,100')).toEqual({ fiveHour: 0, weekly: 1 })
  })

  it('undefined → null', () => {
    expect(parseSmokeToken(undefined)).toBeNull()
  })

  it('빈 문자열 → null', () => {
    expect(parseSmokeToken('')).toBeNull()
  })

  it('필드 개수가 2가 아니면 → null', () => {
    expect(parseSmokeToken('34')).toBeNull()
    expect(parseSmokeToken('1,2,3')).toBeNull()
  })

  it('비수치 → null', () => {
    expect(parseSmokeToken('a,b')).toBeNull()
    expect(parseSmokeToken('34,x')).toBeNull()
  })

  it('빈 필드 → null', () => {
    expect(parseSmokeToken('34,')).toBeNull()
    expect(parseSmokeToken(',87')).toBeNull()
  })
})

describe('formatAgo — 경과 표기(순수·결정적, 시계 미접근)', () => {
  it('0초 → "방금" (경계)', () => {
    expect(formatAgo(0)).toBe('방금')
  })

  it('59초 → "방금" (분 경계 직전)', () => {
    expect(formatAgo(59)).toBe('방금')
  })

  it('60초 → "1분 전" (분 경계)', () => {
    expect(formatAgo(60)).toBe('1분 전')
  })

  it('중간 분값은 내림', () => {
    expect(formatAgo(61)).toBe('1분 전')
    expect(formatAgo(150)).toBe('2분 전')
  })

  it('59분(3540초) → "59분 전" (시간 경계 직전)', () => {
    expect(formatAgo(59 * 60)).toBe('59분 전')
  })

  it('60분(3600초) → "1시간 전" (시간 경계)', () => {
    expect(formatAgo(60 * 60)).toBe('1시간 전')
  })

  it('23시간(82800초) → "23시간 전" (일 경계 직전)', () => {
    expect(formatAgo(23 * 3600)).toBe('23시간 전')
  })

  it('24시간(86400초) → "1일 전" (일 경계)', () => {
    expect(formatAgo(24 * 3600)).toBe('1일 전')
  })

  it('여러 날은 내림 표기', () => {
    expect(formatAgo(3 * 24 * 3600 + 5)).toBe('3일 전')
  })

  it('음수 경과는 0으로 방어 → "방금" (시계 역행/저장 오차)', () => {
    expect(formatAgo(-10)).toBe('방금')
  })
})

describe('resolveDisplayUsage — 라이브 결과 → 표시 사용량(fresh/stale/none)', () => {
  const okUsage: TokenUsage = {
    state: 'ok',
    fiveHour: { pct: 0.34, resetsAt: 5000 },
    weekly: { pct: 0.87, resetsAt: 9000 },
    fetchedAt: 1000,
  }
  const unavailable: TokenUsage = { state: 'unavailable', fetchedAt: 2000 }

  it('라이브 ok → fresh 표시(staleAgeSec 없음) + last-known 갱신(savedAt=now)', () => {
    const r = resolveDisplayUsage(okUsage, null, 12345)
    expect(r.display).toBe(okUsage)
    expect(r.staleAgeSec).toBeUndefined()
    expect(r.lastKnownGood).toEqual({ usage: okUsage, savedAt: 12345 })
  })

  it('라이브 ok는 기존 캐시가 있어도 새 성공값으로 교체', () => {
    const prev: TokenUsageCache = { usage: okUsage, savedAt: 100 }
    const fresh: TokenUsage = { ...okUsage, fiveHour: { pct: 0.5, resetsAt: 6000 } }
    const r = resolveDisplayUsage(fresh, prev, 200)
    expect(r.display).toBe(fresh)
    expect(r.lastKnownGood).toEqual({ usage: fresh, savedAt: 200 })
  })

  it('라이브 unavailable + 캐시 있음 → 캐시를 stale로(age=now−savedAt), 캐시는 유지', () => {
    const prev: TokenUsageCache = { usage: okUsage, savedAt: 1000 }
    const r = resolveDisplayUsage(unavailable, prev, 1600)
    expect(r.display).toBe(okUsage)
    expect(r.staleAgeSec).toBe(600)
    expect(r.lastKnownGood).toBe(prev) // 동일 참조 — 영속 재기록 안 함
  })

  it('라이브 null(예외로 간주) + 캐시 있음 → 동일하게 stale', () => {
    const prev: TokenUsageCache = { usage: okUsage, savedAt: 1000 }
    const r = resolveDisplayUsage(null, prev, 2200)
    expect(r.display).toBe(okUsage)
    expect(r.staleAgeSec).toBe(1200)
    expect(r.lastKnownGood).toBe(prev)
  })

  it('라이브 unavailable + 캐시 없음 → display null(진짜 연결 안 됨), staleAgeSec 없음', () => {
    const r = resolveDisplayUsage(unavailable, null, 5000)
    expect(r.display).toBeNull()
    expect(r.staleAgeSec).toBeUndefined()
    expect(r.lastKnownGood).toBeNull()
  })

  it('stale age는 음수로 내려가지 않는다(now < savedAt 방어)', () => {
    const prev: TokenUsageCache = { usage: okUsage, savedAt: 9000 }
    const r = resolveDisplayUsage(unavailable, prev, 8000)
    expect(r.staleAgeSec).toBe(0)
  })
})
