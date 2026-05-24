import { describe, it, expect } from 'vitest'
import {
  FISH_SPECIES,
  SPECIES_REGISTRY,
  getSpecies,
  pickSpecies,
} from '../speciesRegistry'
import type { SpeciesId } from '../speciesRegistry'

/* ── 레지스트리 무결성 ── */

describe('SPECIES_REGISTRY', () => {
  it('모든 종의 id가 고유하다', () => {
    const ids = SPECIES_REGISTRY.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('모든 종에 displayName이 존재하고 비어있지 않다', () => {
    for (const sp of SPECIES_REGISTRY) {
      expect(sp.displayName).toBeTruthy()
      expect(sp.displayName.length).toBeGreaterThan(0)
    }
  })

  it('모든 종에 dialogue 배열이 존재한다', () => {
    for (const sp of SPECIES_REGISTRY) {
      expect(Array.isArray(sp.dialogue)).toBe(true)
    }
  })

  it('각 kind(schooling/individual)에 최소 1종이 있다', () => {
    const schooling = SPECIES_REGISTRY.filter((s) => s.kind === 'schooling')
    const individual = SPECIES_REGISTRY.filter((s) => s.kind === 'individual')
    expect(schooling.length).toBeGreaterThanOrEqual(1)
    expect(individual.length).toBeGreaterThanOrEqual(1)
  })

  it('모든 종의 baseScale > 0', () => {
    for (const sp of SPECIES_REGISTRY) {
      expect(sp.baseScale).toBeGreaterThan(0)
    }
  })

  it('모든 종의 swimSpeed > 0', () => {
    for (const sp of SPECIES_REGISTRY) {
      expect(sp.swimSpeed).toBeGreaterThan(0)
    }
  })
})

/* ── FISH_SPECIES 호환성 ── */

describe('FISH_SPECIES (backward compat)', () => {
  it('SPECIES_REGISTRY와 동일한 참조다', () => {
    expect(FISH_SPECIES).toBe(SPECIES_REGISTRY)
  })

  it('5종이 등록되어 있다', () => {
    expect(FISH_SPECIES).toHaveLength(5)
  })
})

/* ── getSpecies ── */

describe('getSpecies', () => {
  it('존재하는 id로 올바른 종을 반환한다', () => {
    const sp = getSpecies('clownfish')
    expect(sp.id).toBe('clownfish')
    expect(sp.displayName).toBeTruthy()
  })

  it('모든 등록 id에 대해 라운드트립한다', () => {
    for (const sp of SPECIES_REGISTRY) {
      const found = getSpecies(sp.id)
      expect(found).toBe(sp)
    }
  })

  it('존재하지 않는 id를 넣으면 throw한다', () => {
    expect(() => getSpecies('nonexistent' as SpeciesId)).toThrow()
  })
})

/* ── pickSpecies 회귀 ── */

describe('pickSpecies (regression)', () => {
  it('schooling kind일 때 schooling 종만 반환한다', () => {
    const schoolingIds = new Set(
      SPECIES_REGISTRY.filter((s) => s.kind === 'schooling').map((s) => s.id),
    )
    for (let seed = 0; seed < 20; seed++) {
      const id = pickSpecies(seed * 0.1, 'schooling')
      expect(schoolingIds.has(id)).toBe(true)
    }
  })

  it('individual kind일 때 individual 종만 반환한다', () => {
    const individualIds = new Set(
      SPECIES_REGISTRY.filter((s) => s.kind === 'individual').map((s) => s.id),
    )
    for (let seed = 0; seed < 20; seed++) {
      const id = pickSpecies(seed * 0.1, 'individual')
      expect(individualIds.has(id)).toBe(true)
    }
  })

  it('같은 seed와 kind이면 항상 같은 종을 반환한다 (결정적)', () => {
    const id1 = pickSpecies(0.42, 'schooling')
    const id2 = pickSpecies(0.42, 'schooling')
    expect(id1).toBe(id2)
  })

  it('다른 seed는 다른 종을 반환할 수 있다', () => {
    const results = new Set<SpeciesId>()
    for (let seed = 0; seed < 100; seed++) {
      results.add(pickSpecies(seed * 0.037, 'individual'))
    }
    expect(results.size).toBeGreaterThanOrEqual(2)
  })
})
