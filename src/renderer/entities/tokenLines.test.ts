import { describe, it, expect } from 'vitest'
import { usageLineForSpecies } from './tokenLines'
import type { UsageLineContext } from './tokenLines'
import { SPECIES_REGISTRY } from './speciesRegistry'
import type { UsageLevel } from '../../shared/tokenHelpers'

const BANDS: readonly UsageLevel[] = ['ok', 'warn', 'critical']

const CTX: UsageLineContext = {
  fiveHourPct: 0.42,
  weeklyPct: 0.77,
  resetText: '3시간 27분 후',
}

/* ── 커버리지 불변식: 탭 가능한 모든 어종 × 3밴드가 비어있지 않은 대사를 낸다 ── */

describe('usageLineForSpecies — species × band 커버리지 (coverage invariant)', () => {
  it('speciesRegistry의 모든 종 id × 모든 밴드가 비어있지 않은 문자열을 반환한다', () => {
    for (const species of SPECIES_REGISTRY) {
      for (const band of BANDS) {
        const line = usageLineForSpecies(species.id, band, CTX, 0)
        expect(typeof line).toBe('string')
        expect(line.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('여러 idx 값에 대해서도 모든 종 × 밴드가 비어있지 않다 (idx=0..5 스윕)', () => {
    for (const species of SPECIES_REGISTRY) {
      for (const band of BANDS) {
        for (let idx = 0; idx < 6; idx++) {
          const line = usageLineForSpecies(species.id, band, CTX, idx)
          expect(line.trim().length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('레지스트리의 모든 종 id가 실제로 순회되었다 (빈 배열 통과 방지 가드)', () => {
    expect(SPECIES_REGISTRY.length).toBeGreaterThanOrEqual(10)
  })
})

/* ── fallback 경로: 미등록 id도 절대 빈 문자열을 내지 않는다 ── */

describe('usageLineForSpecies — fallback (미등록/합성 id)', () => {
  const unknownIds = ['__unknown_species__', 'not-a-real-fish', '', 'manta ']

  it('레지스트리에 없는 합성 id도 3밴드 모두 비어있지 않은 문자열을 반환한다', () => {
    for (const id of unknownIds) {
      for (const band of BANDS) {
        const line = usageLineForSpecies(id, band, CTX, 0)
        expect(typeof line).toBe('string')
        expect(line.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('fallback의 warn/critical 대사는 resetText를 포함한다 (idx 0..3 스윕)', () => {
    for (let idx = 0; idx < 4; idx++) {
      const warnLine = usageLineForSpecies('__unknown_species__', 'warn', CTX, idx)
      const criticalLine = usageLineForSpecies('__unknown_species__', 'critical', CTX, idx)
      expect(warnLine).toContain(CTX.resetText)
      expect(criticalLine).toContain(CTX.resetText)
    }
  })
})

/* ── idx 결정성: 같은 idx → 같은 결과, idx는 랩어라운드한다 (Math.random 미사용) ── */

describe('usageLineForSpecies — idx 결정성', () => {
  it('같은 speciesId·band·ctx·idx면 항상 같은 문자열을 반환한다', () => {
    const a = usageLineForSpecies('clownfish', 'warn', CTX, 3)
    const b = usageLineForSpecies('clownfish', 'warn', CTX, 3)
    expect(a).toBe(b)
  })

  it('idx가 템플릿 개수를 넘어가면 랩어라운드한다 (idx=0과 idx=템플릿수는 동일 결과)', () => {
    // 현재 구현은 각 (species,band)에 2개씩의 템플릿을 갖는다 — idx=0과 idx=2는 같은 인덱스로 랩.
    const idx0 = usageLineForSpecies('shark', 'ok', CTX, 0)
    const idx2 = usageLineForSpecies('shark', 'ok', CTX, 2)
    expect(idx0).toBe(idx2)
  })

  it('음수 idx도 안전하게 랩어라운드한다 (idx=-1은 마지막 템플릿과 동일)', () => {
    const idxNeg1 = usageLineForSpecies('shark', 'ok', CTX, -1)
    const idx1 = usageLineForSpecies('shark', 'ok', CTX, 1)
    expect(idxNeg1).toBe(idx1)
  })

  it('idx=0과 idx=1은 (템플릿이 2개 이상인 경우) 서로 다른 대사를 낼 수 있다', () => {
    const idx0 = usageLineForSpecies('whale', 'critical', CTX, 0)
    const idx1 = usageLineForSpecies('whale', 'critical', CTX, 1)
    expect(idx0).not.toBe(idx1)
  })

  it('동일 입력을 반복 호출해도 값이 흔들리지 않는다 (Math.random 미사용 검증)', () => {
    const results = new Set<string>()
    for (let i = 0; i < 20; i++) {
      results.add(usageLineForSpecies('dolphin', 'critical', CTX, 5))
    }
    expect(results.size).toBe(1)
  })
})

/* ── 수치 삽입: 퍼센트를 정수로 반올림해 포함한다 ── */

describe('usageLineForSpecies — 수치 삽입 포맷', () => {
  it('fiveHourPct를 반올림한 정수 퍼센트를 대사에 포함한다', () => {
    const ctx: UsageLineContext = { fiveHourPct: 0.426, weeklyPct: 0.1, resetText: '곧' }
    const line = usageLineForSpecies('tetra-a', 'ok', ctx, 0)
    expect(line).toContain('43%') // Math.round(42.6) = 43
  })

  it('weeklyPct를 반올림한 정수 퍼센트를 대사에 포함한다', () => {
    const ctx: UsageLineContext = { fiveHourPct: 0.1, weeklyPct: 0.774, resetText: '곧' }
    const line = usageLineForSpecies('tetra-a', 'ok', ctx, 1)
    expect(line).toContain('77%') // Math.round(77.4) = 77
  })

  it('0%와 100% 경계값도 깨지지 않는다', () => {
    const zero: UsageLineContext = { fiveHourPct: 0, weeklyPct: 0, resetText: '곧' }
    const full: UsageLineContext = { fiveHourPct: 1, weeklyPct: 1, resetText: '월 9시' }
    for (const species of SPECIES_REGISTRY) {
      for (const band of BANDS) {
        expect(usageLineForSpecies(species.id, band, zero, 0).length).toBeGreaterThan(0)
        expect(usageLineForSpecies(species.id, band, full, 0).length).toBeGreaterThan(0)
      }
    }
  })

  it('critical 밴드는 resetText를 문자 그대로 포함한다 (임의 종 샘플)', () => {
    const ctx: UsageLineContext = { fiveHourPct: 0.99, weeklyPct: 0.99, resetText: '화 15시' }
    const line = usageLineForSpecies('lionfish', 'critical', ctx, 0)
    expect(line).toContain('화 15시')
  })
})

/* ── 각 종의 목소리가 실제로 다르다 (완전 동일한 대사 세트가 아님을 확인) ── */

describe('usageLineForSpecies — 종별 목소리 다양성', () => {
  it('서로 다른 종은 같은 band/idx/ctx에서도 서로 다른 대사를 낸다 (전부 동일 문구가 아님)', () => {
    const lines = new Set<string>()
    for (const species of SPECIES_REGISTRY) {
      lines.add(usageLineForSpecies(species.id, 'ok', CTX, 0))
    }
    expect(lines.size).toBeGreaterThan(1)
  })
})
