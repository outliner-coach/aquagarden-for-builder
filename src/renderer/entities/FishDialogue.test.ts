import { describe, it, expect } from 'vitest'
import { resolveTapLineSource } from './FishDialogue'
import { bandForUsage, formatReset } from '../../shared/tokenHelpers'
import type { TokenUsage } from '../../shared/types'

/**
 * resolveTapLineSource — 탭 시 사용량 대사(usage) vs 어종 flavor 대사 중 어느 경로를
 * 쓸지 결정하는 순수 함수의 분기 커버리지. FishDialogue 클래스(DOM·raycast)는 다루지
 * 않는다 — 그건 스모크 게이트의 몫(CLAUDE.md).
 */

const NOW = 1_700_000_000 // 임의의 고정 epoch 초(결정적 테스트)

const OK_BOTH: TokenUsage = {
  state: 'ok',
  fiveHour: { pct: 0.5, resetsAt: NOW + 3600 },
  weekly: { pct: 0.5, resetsAt: NOW + 86400 },
  fetchedAt: NOW,
}

describe('resolveTapLineSource — flavor로 폴백하는 경우', () => {
  it('기능이 꺼져 있으면(show=false) 데이터가 완비돼도 flavor', () => {
    expect(resolveTapLineSource(false, OK_BOTH, NOW)).toEqual({ kind: 'flavor' })
  })

  it('usage가 null이면 flavor', () => {
    expect(resolveTapLineSource(true, null, NOW)).toEqual({ kind: 'flavor' })
  })

  it("usage.state==='unavailable'이면 flavor", () => {
    const usage: TokenUsage = { state: 'unavailable', fetchedAt: NOW }
    expect(resolveTapLineSource(true, usage, NOW)).toEqual({ kind: 'flavor' })
  })

  it("state==='ok'여도 fiveHour가 없으면 flavor (부분 데이터는 usage 경로로 안 감)", () => {
    const usage: TokenUsage = { state: 'ok', weekly: OK_BOTH.weekly, fetchedAt: NOW }
    expect(resolveTapLineSource(true, usage, NOW)).toEqual({ kind: 'flavor' })
  })

  it("state==='ok'여도 weekly가 없으면 flavor", () => {
    const usage: TokenUsage = { state: 'ok', fiveHour: OK_BOTH.fiveHour, fetchedAt: NOW }
    expect(resolveTapLineSource(true, usage, NOW)).toEqual({ kind: 'flavor' })
  })
})

describe('resolveTapLineSource — usage 경로(show && state==="ok" && 두 창 모두 존재)', () => {
  it('kind가 usage이고 ctx가 fiveHour/weekly pct·resetText를 그대로 담는다', () => {
    const result = resolveTapLineSource(true, OK_BOTH, NOW)
    expect(result.kind).toBe('usage')
    if (result.kind !== 'usage') return
    expect(result.ctx.fiveHourPct).toBe(OK_BOTH.fiveHour!.pct)
    expect(result.ctx.weeklyPct).toBe(OK_BOTH.weekly!.pct)
    expect(result.ctx.resetText).toBe(formatReset(OK_BOTH.fiveHour!.resetsAt, NOW, 'relative'))
  })

  it('band는 bandForUsage(fiveHourPct, weeklyPct)와 일치한다', () => {
    const result = resolveTapLineSource(true, OK_BOTH, NOW)
    expect(result.kind).toBe('usage')
    if (result.kind !== 'usage') return
    expect(result.band).toBe(bandForUsage(OK_BOTH.fiveHour!.pct, OK_BOTH.weekly!.pct))
  })

  it('weekly가 critical이고 fiveHour가 ok여도 더 제약적인 weekly가 band를 정한다', () => {
    const usage: TokenUsage = {
      state: 'ok',
      fiveHour: { pct: 0.1, resetsAt: NOW + 3600 },
      weekly: { pct: 0.97, resetsAt: NOW + 86400 },
      fetchedAt: NOW,
    }
    const result = resolveTapLineSource(true, usage, NOW)
    expect(result.kind).toBe('usage')
    if (result.kind !== 'usage') return
    expect(result.band).toBe('critical')
  })

  it('fiveHour가 critical이고 weekly가 ok여도 더 제약적인 fiveHour가 band를 정한다', () => {
    const usage: TokenUsage = {
      state: 'ok',
      fiveHour: { pct: 0.97, resetsAt: NOW + 3600 },
      weekly: { pct: 0.1, resetsAt: NOW + 86400 },
      fetchedAt: NOW,
    }
    const result = resolveTapLineSource(true, usage, NOW)
    expect(result.kind).toBe('usage')
    if (result.kind !== 'usage') return
    expect(result.band).toBe('critical')
  })

  it('resetText는 weekly가 아니라 fiveHour.resetsAt 기준으로 계산된다', () => {
    const usage: TokenUsage = {
      state: 'ok',
      fiveHour: { pct: 0.5, resetsAt: NOW + 120 },
      weekly: { pct: 0.5, resetsAt: NOW + 999_999 },
      fetchedAt: NOW,
    }
    const result = resolveTapLineSource(true, usage, NOW)
    expect(result.kind).toBe('usage')
    if (result.kind !== 'usage') return
    expect(result.ctx.resetText).toBe(formatReset(usage.fiveHour!.resetsAt, NOW, 'relative'))
    expect(result.ctx.resetText).not.toBe(formatReset(usage.weekly!.resetsAt, NOW, 'relative'))
  })
})
