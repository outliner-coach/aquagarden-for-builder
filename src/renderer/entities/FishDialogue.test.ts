import { describe, it, expect } from 'vitest'
import { resolveTapLineSource } from './FishDialogue'
import { windowBand, formatReset } from '../../shared/tokenHelpers'
import { TOKEN } from '../../shared/config'
import type { TokenUsage } from '../../shared/types'

/**
 * resolveTapLineSource — 탭 시 (a) 평소 어종 flavor 대사 vs (b) 사용량 통계 대사, 그리고
 * (b)일 때 어느 창(주간/5시간)을 인용할지를 roll∈[0,1)로 가르는 순수 함수의 분기 커버리지.
 * roll은 호출자(handleTap)가 Math.random()으로 주입 — 여기선 고정값으로 결정적 검증한다.
 * FishDialogue 클래스(DOM·raycast)는 다루지 않는다 — 그건 스모크 게이트의 몫(CLAUDE.md).
 *
 * 분할(기본 usageTapChance=0.4): roll<0.2 → 주간, 0.2≤roll<0.4 → 5시간, roll≥0.4 → flavor.
 * 즉 사용량 40%(주간20%/5시간20% — 사용량 안에서 ~50/50)·평소 flavor 60%.
 */

const NOW = 1_700_000_000 // 임의의 고정 epoch 초(결정적 테스트)
const WEEK = 7 * 24 * 60 * 60

// 주간=창 초반 34%(과속→페이스 warn), 5시간=97%(절대 critical). 두 창의 톤 계산 차이를 함께 검증.
const OK_BOTH: TokenUsage = {
  state: 'ok',
  fiveHour: { pct: 0.97, resetsAt: NOW + 1800 },
  weekly: { pct: 0.34, resetsAt: NOW + Math.round((6 / 7) * WEEK) }, // ~14% 경과 → projected ~2.4
  fetchedAt: NOW,
}

describe('resolveTapLineSource — 가드(flavor로 폴백, roll 무관)', () => {
  // roll=0(가장 usage로 가기 쉬운 값)이어도 가드가 이기면 flavor여야 한다.
  it('기능이 꺼져 있으면(show=false) 데이터 완비·roll=0이어도 flavor', () => {
    expect(resolveTapLineSource(false, OK_BOTH, NOW, 0)).toEqual({ kind: 'flavor' })
  })

  it('usage가 null이면 flavor', () => {
    expect(resolveTapLineSource(true, null, NOW, 0)).toEqual({ kind: 'flavor' })
  })

  it("usage.state==='unavailable'이면 flavor", () => {
    const usage: TokenUsage = { state: 'unavailable', fetchedAt: NOW }
    expect(resolveTapLineSource(true, usage, NOW, 0)).toEqual({ kind: 'flavor' })
  })

  it("state==='ok'여도 fiveHour가 없으면 flavor (부분 데이터는 usage 경로로 안 감)", () => {
    const usage: TokenUsage = { state: 'ok', weekly: OK_BOTH.weekly, fetchedAt: NOW }
    expect(resolveTapLineSource(true, usage, NOW, 0)).toEqual({ kind: 'flavor' })
  })

  it("state==='ok'여도 weekly가 없으면 flavor", () => {
    const usage: TokenUsage = { state: 'ok', fiveHour: OK_BOTH.fiveHour, fetchedAt: NOW }
    expect(resolveTapLineSource(true, usage, NOW, 0)).toEqual({ kind: 'flavor' })
  })
})

describe('resolveTapLineSource — 평소 flavor 다수(roll ≥ usageTapChance)', () => {
  it('roll=0.6 → flavor', () => {
    expect(resolveTapLineSource(true, OK_BOTH, NOW, 0.6)).toEqual({ kind: 'flavor' })
  })

  it('roll이 정확히 usageTapChance면 flavor (경계 — usage는 roll<chance일 때만)', () => {
    expect(resolveTapLineSource(true, OK_BOTH, NOW, TOKEN.usageTapChance)).toEqual({ kind: 'flavor' })
  })

  it('roll이 1에 가까워도 flavor', () => {
    expect(resolveTapLineSource(true, OK_BOTH, NOW, 0.999)).toEqual({ kind: 'flavor' })
  })
})

describe('resolveTapLineSource — 사용량 대사(roll < usageTapChance): 주간/5시간 ~50/50 분할', () => {
  it('roll=0.1 → 주간(0.1<0.2): band=주간 페이스(warn)·label "주간"·pct 주간값·reset 절대표기', () => {
    const result = resolveTapLineSource(true, OK_BOTH, NOW, 0.1)
    expect(result.kind).toBe('usage')
    if (result.kind !== 'usage') return
    expect(result.band).toBe('warn') // 주간 과속 → 페이스 warn
    expect(result.band).toBe(windowBand(OK_BOTH.weekly!, true, NOW)) // 주간 창 톤과 일치
    expect(result.ctx.label).toBe('주간')
    expect(result.ctx.pct).toBe(0.34)
    // 주간 focus는 절대표기(요일+시)로 리셋을 표기한다.
    expect(result.ctx.resetText).toBe(formatReset(OK_BOTH.weekly!.resetsAt, NOW, 'absolute'))
  })

  it('roll=0.3 → 5시간(0.2≤0.3<0.4): band=5시간 절대(critical)·label "5시간"·pct 5시간값·reset 상대표기', () => {
    const result = resolveTapLineSource(true, OK_BOTH, NOW, 0.3)
    expect(result.kind).toBe('usage')
    if (result.kind !== 'usage') return
    expect(result.band).toBe('critical') // 0.97 ≥ criticalPct(절대치, 페이스 무관)
    expect(result.band).toBe(windowBand(OK_BOTH.fiveHour!, false, NOW)) // 5시간 창 톤과 일치
    expect(result.ctx.label).toBe('5시간')
    expect(result.ctx.pct).toBe(0.97)
    expect(result.ctx.resetText).toBe(formatReset(OK_BOTH.fiveHour!.resetsAt, NOW, 'relative'))
  })

  it('roll=0 → 주간(하한 경계)', () => {
    const result = resolveTapLineSource(true, OK_BOTH, NOW, 0)
    expect(result.kind === 'usage' && result.ctx.label).toBe('주간')
  })

  it('분할 경계: roll이 usageTapChance/2 직전이면 주간, 정확히 usageTapChance/2면 5시간', () => {
    const half = TOKEN.usageTapChance / 2
    const justBelow = resolveTapLineSource(true, OK_BOTH, NOW, half - 1e-9)
    const atHalf = resolveTapLineSource(true, OK_BOTH, NOW, half)
    expect(justBelow.kind === 'usage' && justBelow.ctx.label).toBe('주간')
    expect(atHalf.kind === 'usage' && atHalf.ctx.label).toBe('5시간')
  })

  it('사용량 상한 경계: roll이 usageTapChance 직전이면 아직 5시간(usage)', () => {
    const justBelow = resolveTapLineSource(true, OK_BOTH, NOW, TOKEN.usageTapChance - 1e-9)
    expect(justBelow.kind).toBe('usage')
    expect(justBelow.kind === 'usage' && justBelow.ctx.label).toBe('5시간')
  })
})
