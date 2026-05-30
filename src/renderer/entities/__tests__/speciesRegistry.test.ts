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

  it('모든 종에 dialogue 배열이 존재하고 ≥10개이며 비어있지 않다', () => {
    for (const sp of SPECIES_REGISTRY) {
      expect(Array.isArray(sp.dialogue)).toBe(true)
      expect(sp.dialogue.length).toBeGreaterThanOrEqual(10)
      for (const line of sp.dialogue) {
        expect(typeof line).toBe('string')
        expect(line.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('같은 어종 내 대사에 과도한 중복이 없다', () => {
    for (const sp of SPECIES_REGISTRY) {
      const unique = new Set(sp.dialogue)
      expect(unique.size).toBe(sp.dialogue.length)
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

/* ── 특별 대형 개체 크기 불변식 (사용자 의도: 특별 개체가 압도적으로 큼) ── */

describe('대형 특별 개체 baseScale 불변식', () => {
  it('고래는 만타가오리보다 크다 (현실 비율: 고래 ≫ 만타)', () => {
    expect(getSpecies('whale').baseScale).toBeGreaterThan(getSpecies('manta').baseScale)
  })

  it('만타·고래는 모든 ambient 종보다 크다 (특별 개체의 압도감)', () => {
    const maxAmbientScale = Math.max(
      ...SPECIES_REGISTRY.filter((s) => s.category === 'ambient').map((s) => s.baseScale),
    )
    expect(getSpecies('manta').baseScale).toBeGreaterThan(maxAmbientScale)
    expect(getSpecies('whale').baseScale).toBeGreaterThan(maxAmbientScale)
  })

  it('고래가 전체 종 중 가장 크다', () => {
    const maxScale = Math.max(...SPECIES_REGISTRY.map((s) => s.baseScale))
    expect(getSpecies('whale').baseScale).toBe(maxScale)
  })
})

/* ── FISH_SPECIES 호환성 ── */

describe('FISH_SPECIES (backward compat)', () => {
  it('SPECIES_REGISTRY와 동일한 참조다', () => {
    expect(FISH_SPECIES).toBe(SPECIES_REGISTRY)
  })

  it('10종이 등록되어 있다', () => {
    expect(FISH_SPECIES).toHaveLength(10)
  })
})

/* ── category 필드 무결성 ── */

describe('category 필드', () => {
  it('모든 종에 category가 ambient 또는 feature이다', () => {
    for (const sp of SPECIES_REGISTRY) {
      expect(['ambient', 'feature']).toContain(sp.category)
    }
  })

  it('기존 5종은 모두 ambient이다', () => {
    const ambientIds: SpeciesId[] = ['tetra-a', 'tetra-b', 'clownfish', 'butterflyfish', 'lionfish']
    for (const id of ambientIds) {
      expect(getSpecies(id).category).toBe('ambient')
    }
  })

  it('ambient 6종 / feature 4종이다', () => {
    const ambient = SPECIES_REGISTRY.filter((s) => s.category === 'ambient')
    const feature = SPECIES_REGISTRY.filter((s) => s.category === 'feature')
    expect(ambient).toHaveLength(6)
    expect(feature).toHaveLength(4)
  })

  it('신규 4종(manta, whale, dolphin, shark)은 모두 feature이다', () => {
    const featureIds: SpeciesId[] = ['manta', 'whale', 'dolphin', 'shark']
    for (const id of featureIds) {
      const sp = getSpecies(id)
      expect(sp.category).toBe('feature')
      expect(sp.kind).toBe('individual')
    }
  })
})

/* ── 신규 4종 메타데이터 ── */

describe('신규 feature 4종', () => {
  const featureIds: SpeciesId[] = ['manta', 'whale', 'dolphin', 'shark']

  it('레지스트리에 존재하고 displayName이 비어있지 않다', () => {
    for (const id of featureIds) {
      const sp = getSpecies(id)
      expect(sp.displayName).toBeTruthy()
      expect(sp.displayName.length).toBeGreaterThan(0)
    }
  })

  it('각각 dialogue가 정확히 10개이다', () => {
    for (const id of featureIds) {
      const sp = getSpecies(id)
      expect(sp.dialogue).toHaveLength(10)
      for (const line of sp.dialogue) {
        expect(typeof line).toBe('string')
        expect(line.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('dialogue에 중복이 없다', () => {
    for (const id of featureIds) {
      const sp = getSpecies(id)
      expect(new Set(sp.dialogue).size).toBe(sp.dialogue.length)
    }
  })
})

/* ── 새우(shrimp) 메타데이터 ── */

describe('새우(shrimp)', () => {
  it('레지스트리에서 getSpecies("shrimp")로 조회된다', () => {
    const sp = getSpecies('shrimp')
    expect(sp.id).toBe('shrimp')
    expect(sp.displayName).toBe('새우')
  })

  it('ambient 카테고리·individual kind이다 (앰비언트 풀에 등장)', () => {
    const sp = getSpecies('shrimp')
    expect(sp.category).toBe('ambient')
    expect(sp.kind).toBe('individual')
  })

  it('dialogue가 10개 이상이고 중복이 없다', () => {
    const sp = getSpecies('shrimp')
    expect(sp.dialogue.length).toBeGreaterThanOrEqual(10)
    expect(new Set(sp.dialogue).size).toBe(sp.dialogue.length)
    for (const line of sp.dialogue) {
      expect(typeof line).toBe('string')
      expect(line.trim().length).toBeGreaterThan(0)
    }
  })

  it('baseScale > 0, swimSpeed > 0, file이 비어있지 않다', () => {
    const sp = getSpecies('shrimp')
    expect(sp.baseScale).toBeGreaterThan(0)
    expect(sp.swimSpeed).toBeGreaterThan(0)
    expect(sp.file.length).toBeGreaterThan(0)
  })

  it('ambient이므로 pickSpecies 후보에 포함될 수 있다 (individual)', () => {
    const ids = new Set<SpeciesId>()
    for (let seed = 0; seed < 500; seed++) {
      ids.add(pickSpecies(seed * 0.0173, 'individual'))
    }
    expect(ids.has('shrimp')).toBe(true)
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

  it('pickSpecies가 feature 종을 절대 반환하지 않는다 (seed 0~999 스윕)', () => {
    const featureIds = new Set(
      SPECIES_REGISTRY.filter((s) => s.category === 'feature').map((s) => s.id),
    )
    for (let seed = 0; seed < 1000; seed++) {
      const schoolId = pickSpecies(seed, 'schooling')
      expect(featureIds.has(schoolId)).toBe(false)
      const indivId = pickSpecies(seed, 'individual')
      expect(featureIds.has(indivId)).toBe(false)
    }
  })

  it('pickSpecies가 반환하는 종은 항상 category=ambient이다', () => {
    for (let seed = 0; seed < 100; seed++) {
      const schoolId = pickSpecies(seed * 0.1, 'schooling')
      expect(getSpecies(schoolId).category).toBe('ambient')
      const indivId = pickSpecies(seed * 0.1, 'individual')
      expect(getSpecies(indivId).category).toBe('ambient')
    }
  })
})
