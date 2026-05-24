import { describe, it, expect } from 'vitest'
import { PLANT_REGISTRY, getPlantSpecies } from '../plantRegistry'
import { PLANT } from '../../../shared/config'

/* ── 레지스트리 무결성 ── */

describe('PLANT_REGISTRY', () => {
  it('config.PLANT.species와 동일한 개수다', () => {
    expect(PLANT_REGISTRY).toHaveLength(PLANT.species.length)
  })

  it('모든 항목의 name이 고유하다', () => {
    const names = PLANT_REGISTRY.map((p) => p.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('모든 항목이 PlantSpecies 타입에 부합한다', () => {
    for (const p of PLANT_REGISTRY) {
      expect(typeof p.name).toBe('string')
      expect(p.name.length).toBeGreaterThan(0)
      expect(typeof p.count).toBe('number')
      expect(p.count).toBeGreaterThan(0)
      expect(typeof p.minHeight).toBe('number')
      expect(typeof p.maxHeight).toBe('number')
      expect(typeof p.minScale).toBe('number')
      expect(typeof p.maxScale).toBe('number')
      expect(p.baseColor).toHaveLength(3)
      expect(p.tipColor).toHaveLength(3)
      expect(typeof p.colorVariation).toBe('number')
      expect(p.area).toBeDefined()
      expect(typeof p.seed).toBe('number')
      expect(typeof p.quadCount).toBe('number')
      expect(typeof p.cardHalfWidth).toBe('number')
    }
  })

  it('config.PLANT.species의 값과 일치한다 (데이터 불변)', () => {
    for (let i = 0; i < PLANT.species.length; i++) {
      const cfg = PLANT.species[i]
      const reg = PLANT_REGISTRY[i]
      expect(reg.name).toBe(cfg.name)
      expect(reg.count).toBe(cfg.count)
      expect(reg.minHeight).toBe(cfg.minHeight)
      expect(reg.maxHeight).toBe(cfg.maxHeight)
      expect(reg.seed).toBe(cfg.seed)
    }
  })
})

/* ── getPlantSpecies ── */

describe('getPlantSpecies', () => {
  it('존재하는 name으로 올바른 종을 반환한다', () => {
    const sp = getPlantSpecies('carpet')
    expect(sp.name).toBe('carpet')
  })

  it('모든 등록 name에 대해 라운드트립한다', () => {
    for (const p of PLANT_REGISTRY) {
      const found = getPlantSpecies(p.name)
      expect(found).toBe(p)
    }
  })

  it('존재하지 않는 name을 넣으면 throw한다', () => {
    expect(() => getPlantSpecies('nonexistent')).toThrow()
  })
})
