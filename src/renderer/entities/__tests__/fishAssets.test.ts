import { describe, it, expect } from 'vitest'
import {
  FISH_SPECIES,
  pickSpecies,
  computeNormalizeTransform,
} from '../fishAssets'
import type { SpeciesId } from '../fishAssets'

/* ── 매니페스트 무결성 ── */

describe('FISH_SPECIES manifest', () => {
  it('10종이 등록되어 있다', () => {
    expect(FISH_SPECIES).toHaveLength(10)
  })

  it('군집(schooling) 종이 2개다', () => {
    const schooling = FISH_SPECIES.filter((s) => s.kind === 'schooling')
    expect(schooling).toHaveLength(2)
  })

  it('개체(individual) 종이 8개다', () => {
    const individual = FISH_SPECIES.filter((s) => s.kind === 'individual')
    expect(individual).toHaveLength(8)
  })

  it('모든 종의 baseScale > 0', () => {
    for (const sp of FISH_SPECIES) {
      expect(sp.baseScale).toBeGreaterThan(0)
    }
  })

  it('모든 종의 swimSpeed > 0', () => {
    for (const sp of FISH_SPECIES) {
      expect(sp.swimSpeed).toBeGreaterThan(0)
    }
  })

  it('모든 종의 id가 고유하다', () => {
    const ids = FISH_SPECIES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('모든 종의 file이 비어있지 않다', () => {
    for (const sp of FISH_SPECIES) {
      expect(sp.file.length).toBeGreaterThan(0)
    }
  })
})

/* ── pickSpecies ── */

describe('pickSpecies', () => {
  it('schooling kind일 때 schooling 종만 반환한다', () => {
    const schoolingIds = new Set(
      FISH_SPECIES.filter((s) => s.kind === 'schooling').map((s) => s.id),
    )
    for (let seed = 0; seed < 20; seed++) {
      const id = pickSpecies(seed * 0.1, 'schooling')
      expect(schoolingIds.has(id)).toBe(true)
    }
  })

  it('individual kind일 때 individual 종만 반환한다', () => {
    const individualIds = new Set(
      FISH_SPECIES.filter((s) => s.kind === 'individual').map((s) => s.id),
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
    // 3종 중 최소 2종은 나와야 함
    expect(results.size).toBeGreaterThanOrEqual(2)
  })
})

/* ── computeNormalizeTransform ── */

describe('computeNormalizeTransform', () => {
  it('단위 크기 bbox (0~1) → scale=1, offset은 중심 이동', () => {
    const bbox = {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 1, y: 0.5, z: 0.3 },
    }
    const result = computeNormalizeTransform(bbox)
    // 가장 긴 축(x)의 길이가 1이 되어야 하므로 scale = 1/1 = 1
    expect(result.scale).toBeCloseTo(1, 5)
    // offset은 bbox 중심의 음수: -(0.5, 0.25, 0.15)
    expect(result.offset.x).toBeCloseTo(-0.5, 5)
    expect(result.offset.y).toBeCloseTo(-0.25, 5)
    expect(result.offset.z).toBeCloseTo(-0.15, 5)
  })

  it('큰 bbox → scale이 축소된다', () => {
    const bbox = {
      min: { x: -5, y: -2, z: -1 },
      max: { x: 5, y: 2, z: 1 },
    }
    const result = computeNormalizeTransform(bbox)
    // 가장 긴 축(x) 길이=10, scale=1/10=0.1
    expect(result.scale).toBeCloseTo(0.1, 5)
    expect(result.offset.x).toBeCloseTo(0, 5)
    expect(result.offset.y).toBeCloseTo(0, 5)
    expect(result.offset.z).toBeCloseTo(0, 5)
  })

  it('작은 bbox → scale이 확대된다', () => {
    const bbox = {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0.2, y: 0.1, z: 0.05 },
    }
    const result = computeNormalizeTransform(bbox)
    // 가장 긴 축(x) 길이=0.2, scale=1/0.2=5
    expect(result.scale).toBeCloseTo(5, 5)
  })

  it('정육면체 bbox에서도 올바르게 동작한다', () => {
    const bbox = {
      min: { x: -1, y: -1, z: -1 },
      max: { x: 1, y: 1, z: 1 },
    }
    const result = computeNormalizeTransform(bbox)
    // 모든 축 길이=2, scale=1/2=0.5
    expect(result.scale).toBeCloseTo(0.5, 5)
    expect(result.offset.x).toBeCloseTo(0, 5)
    expect(result.offset.y).toBeCloseTo(0, 5)
    expect(result.offset.z).toBeCloseTo(0, 5)
  })

  it('비대칭 오프셋 bbox를 중심으로 이동시킨다', () => {
    const bbox = {
      min: { x: 10, y: 20, z: 30 },
      max: { x: 14, y: 22, z: 31 },
    }
    const result = computeNormalizeTransform(bbox)
    // 가장 긴 축(x) 길이=4, scale=1/4=0.25
    expect(result.scale).toBeCloseTo(0.25, 5)
    // 중심: (12, 21, 30.5) → offset: (-12, -21, -30.5)
    expect(result.offset.x).toBeCloseTo(-12, 5)
    expect(result.offset.y).toBeCloseTo(-21, 5)
    expect(result.offset.z).toBeCloseTo(-30.5, 5)
  })
})
