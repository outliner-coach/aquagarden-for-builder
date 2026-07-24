import { describe, it, expect } from 'vitest'
import { resolveTapLineSource } from './FishDialogue'
import { formatReset } from '../../shared/tokenHelpers'
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
  const WEEK = 7 * 24 * 60 * 60

  it('주간 과속(창 초반 34%) → band warn, focus weekly: ctx.label "주간"·pct 주간값·reset 절대표기', () => {
    const usage: TokenUsage = {
      state: 'ok',
      fiveHour: { pct: 0.1, resetsAt: NOW + 3600 },
      weekly: { pct: 0.34, resetsAt: NOW + Math.round((6 / 7) * WEEK) }, // ~14% 경과 → projected ~2.4
      fetchedAt: NOW,
    }
    const result = resolveTapLineSource(true, usage, NOW)
    expect(result.kind).toBe('usage')
    if (result.kind !== 'usage') return
    expect(result.band).toBe('warn')
    expect(result.ctx.label).toBe('주간')
    expect(result.ctx.pct).toBe(0.34)
    // 주간 focus는 절대표기(요일+시)로 리셋을 표기한다(상대표기와 달라야 함).
    expect(result.ctx.resetText).toBe(formatReset(usage.weekly!.resetsAt, NOW, 'absolute'))
  })

  it('5시간 절대 사용률이 높으면 focus fiveHour: ctx.label "5시간"·pct 5시간값·reset 상대표기', () => {
    const usage: TokenUsage = {
      state: 'ok',
      fiveHour: { pct: 0.97, resetsAt: NOW + 1800 },
      weekly: { pct: 0.2, resetsAt: NOW + Math.round(0.4 * WEEK) }, // 60% 경과, 정상 페이스
      fetchedAt: NOW,
    }
    const result = resolveTapLineSource(true, usage, NOW)
    expect(result.kind).toBe('usage')
    if (result.kind !== 'usage') return
    expect(result.band).toBe('critical') // 0.97 ≥ criticalPct(절대치)
    expect(result.ctx.label).toBe('5시간')
    expect(result.ctx.pct).toBe(0.97)
    expect(result.ctx.resetText).toBe(formatReset(usage.fiveHour!.resetsAt, NOW, 'relative'))
  })

  it('두 창 모두 정상 페이스면 band ok', () => {
    const usage: TokenUsage = {
      state: 'ok',
      fiveHour: { pct: 0.3, resetsAt: NOW + 3600 },
      weekly: { pct: 0.34, resetsAt: NOW + Math.round(0.4 * WEEK) }, // 60% 경과 → projected ~0.57
      fetchedAt: NOW,
    }
    const result = resolveTapLineSource(true, usage, NOW)
    expect(result.kind).toBe('usage')
    if (result.kind !== 'usage') return
    expect(result.band).toBe('ok')
  })

  it('주간 절대 critical(97%)은 페이스와 무관하게 band critical, focus weekly', () => {
    const usage: TokenUsage = {
      state: 'ok',
      fiveHour: { pct: 0.1, resetsAt: NOW + 3600 },
      weekly: { pct: 0.97, resetsAt: NOW + Math.round(0.1 * WEEK) }, // 90% 경과(느린 페이스)여도 절대 critical
      fetchedAt: NOW,
    }
    const result = resolveTapLineSource(true, usage, NOW)
    expect(result.kind).toBe('usage')
    if (result.kind !== 'usage') return
    expect(result.band).toBe('critical')
    expect(result.ctx.label).toBe('주간')
  })
})
