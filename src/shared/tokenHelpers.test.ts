import { describe, it, expect } from 'vitest'
import {
  parseUsageResponse,
  usageLevel,
  bandForUsage,
  fishTone,
  gaugeColor,
  formatReset,
  parseSmokeToken,
} from './tokenHelpers'
import { TOKEN } from './config'

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

describe('fishTone — 주간은 페이스 인지, 5시간은 절대치', () => {
  const WEEK = 7 * 24 * 60 * 60
  const NOW = 1_700_000_000
  // 경과 비율(0..1)로부터 resetsAt 역산: elapsed = 1 - (resetsAt - now) / WEEK.
  const resetAtElapsed = (elapsed: number): number => NOW + Math.round((1 - elapsed) * WEEK)

  it('사용자 시나리오: 주간 34%인데 창 초반(~14% 경과) → 과속 → warn, focus weekly', () => {
    const fiveHour = { pct: 0.1, resetsAt: NOW + 3600 }
    const weekly = { pct: 0.34, resetsAt: resetAtElapsed(1 / 7) } // ~14.3% 경과 → projected ~2.4
    expect(fishTone(fiveHour, weekly, NOW)).toEqual({ band: 'warn', focus: 'weekly' })
  })

  it('같은 34%라도 창 중반(~60% 경과)이면 정상 페이스 → ok', () => {
    const fiveHour = { pct: 0.1, resetsAt: NOW + 3600 }
    const weekly = { pct: 0.34, resetsAt: resetAtElapsed(0.6) } // projected ~0.57
    expect(fishTone(fiveHour, weekly, NOW).band).toBe('ok')
  })

  it('pacePctFloor 미만(주간 5%)은 과속이어도 여유로 봄 → ok', () => {
    const fiveHour = { pct: 0.05, resetsAt: NOW + 3600 }
    const weekly = { pct: 0.05, resetsAt: resetAtElapsed(0.035) } // projected ~1.43(≥1.2)지만 pct<floor
    expect(fishTone(fiveHour, weekly, NOW).band).toBe('ok')
  })

  it('5시간 절대 사용률이 높으면(90%) 정상 페이스 주간을 눌러 focus fiveHour', () => {
    const fiveHour = { pct: 0.9, resetsAt: NOW + 3600 }
    const weekly = { pct: 0.2, resetsAt: resetAtElapsed(0.6) } // on-track
    const tone = fishTone(fiveHour, weekly, NOW)
    expect(tone.band).toBe('warn')
    expect(tone.focus).toBe('fiveHour')
  })

  it('주간 절대 critical(97%)은 페이스와 무관하게 critical, focus weekly', () => {
    const fiveHour = { pct: 0.1, resetsAt: NOW + 3600 }
    const weekly = { pct: 0.97, resetsAt: resetAtElapsed(0.9) } // 경과가 많아도(느린 페이스) 절대 critical
    expect(fishTone(fiveHour, weekly, NOW)).toEqual({ band: 'critical', focus: 'weekly' })
  })

  it('5시간은 페이스 보정을 받지 않는다 (창 초반 50%도 그대로 ok)', () => {
    const fiveHour = { pct: 0.5, resetsAt: NOW + 5 * 3600 } // 방금 시작한 5시간 블록(초반)
    const weekly = { pct: 0.1, resetsAt: resetAtElapsed(0.5) }
    expect(fishTone(fiveHour, weekly, NOW).band).toBe('ok')
  })

  it('동률 밴드면 사용률이 높은 창을 focus로 (tie → higher %)', () => {
    // 둘 다 ok, weekly가 더 높음 → weekly
    const a = fishTone({ pct: 0.3, resetsAt: NOW + 3600 }, { pct: 0.5, resetsAt: resetAtElapsed(0.9) }, NOW)
    expect(a).toEqual({ band: 'ok', focus: 'weekly' })
    // 둘 다 ok, fiveHour가 더 높음 → fiveHour
    const b = fishTone({ pct: 0.5, resetsAt: NOW + 3600 }, { pct: 0.3, resetsAt: resetAtElapsed(0.9) }, NOW)
    expect(b).toEqual({ band: 'ok', focus: 'fiveHour' })
  })

  it('nowSec를 주입받아 결정적이다 (같은 입력 반복 호출 시 불변, 시계 미접근)', () => {
    const fh = { pct: 0.9, resetsAt: NOW + 3600 }
    const wk = { pct: 0.34, resetsAt: resetAtElapsed(1 / 7) }
    const first = fishTone(fh, wk, NOW)
    for (let i = 0; i < 10; i++) {
      expect(fishTone(fh, wk, NOW)).toEqual(first)
    }
  })

  it('커스텀 임계값을 전달할 수 있다 (warnPct/criticalPct override)', () => {
    // 절대 40%면 커스텀 warn 임계(0.4)로 warn — 페이스 무관
    const fiveHour = { pct: 0.4, resetsAt: NOW + 3600 }
    const weekly = { pct: 0.1, resetsAt: resetAtElapsed(0.9) }
    expect(fishTone(fiveHour, weekly, NOW, 0.4, 0.9).band).toBe('warn')
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
