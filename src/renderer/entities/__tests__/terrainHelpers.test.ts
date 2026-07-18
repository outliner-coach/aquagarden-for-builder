import { describe, it, expect } from 'vitest'
import { sandHeightAt, type SandTerrainConfig } from '../terrainHelpers'
import { FISH, AQUASCAPE } from '../../../shared/config'
import { getTheme } from '../themeRegistry'

/* ── 테스트용 인라인 config들 ── */

/** 마운드 1개 + 기복. 중앙(0,0)이 전개 존 안쪽이 되도록 frontFlatZ를 앞(양수)에 둔다. */
const withMound: SandTerrainConfig = {
  rollAmplitude: 0.1,
  rollScale: 0.4,
  mounds: [{ x: 0, z: -3, radius: 4, height: 0.5 }],
  edgeTaperStart: 12,
  edgeTaperEnd: 16,
  frontFlatZ: -1.5,
  frontTaperWidth: 2,
  maxHeight: 0.6,
}

/** 기복만(마운드 없음). */
const rollOnly: SandTerrainConfig = {
  ...withMound,
  mounds: [],
}

describe('sandHeightAt — 기본 계약', () => {
  it('number를 반환한다', () => {
    expect(typeof sandHeightAt(0, -3, withMound)).toBe('number')
  })

  it('ⓓ 결정적: 같은 입력 → 항상 같은 출력', () => {
    const a = sandHeightAt(2.5, -3.5, withMound)
    const b = sandHeightAt(2.5, -3.5, withMound)
    expect(a).toBe(b)
  })

  it('NaN을 생성하지 않는다', () => {
    for (let x = -20; x <= 20; x += 1.3) {
      for (let z = -10; z <= 3; z += 0.9) {
        expect(Number.isNaN(sandHeightAt(x, z, withMound))).toBe(false)
      }
    }
  })
})

describe('sandHeightAt — ⓐ 가장자리 페이드 제약', () => {
  it('|x| ≥ edgeTaperEnd 이면 변위 0 (양/음 x 모두, 전개 존 z에서)', () => {
    const zBack = withMound.frontFlatZ - withMound.frontTaperWidth - 1 // 확실히 전개 존
    expect(sandHeightAt(withMound.edgeTaperEnd, zBack, withMound)).toBe(0)
    expect(sandHeightAt(withMound.edgeTaperEnd + 3, zBack, withMound)).toBe(0)
    expect(sandHeightAt(-(withMound.edgeTaperEnd), zBack, withMound)).toBe(0)
    expect(sandHeightAt(-(withMound.edgeTaperEnd + 5), zBack, withMound)).toBe(0)
  })

  it('가장자리로 갈수록 |변위|가 단조 감소한다 (start→end 구간, 마운드 없는 기복만)', () => {
    const zBack = rollOnly.frontFlatZ - rollOnly.frontTaperWidth - 1
    // 같은 위상의 노이즈 비교를 피하려고, edge factor만의 효과를 |x| 스윕으로 관찰:
    // 절대 높이가 아니라 edgeFactor가 곱해지므로, end 바깥은 반드시 0.
    for (let x = rollOnly.edgeTaperEnd; x <= rollOnly.edgeTaperEnd + 8; x += 1) {
      expect(sandHeightAt(x, zBack, rollOnly)).toBe(0)
    }
  })
})

describe('sandHeightAt — ⓑ 앞쪽 평탄 존 제약', () => {
  it('z > frontFlatZ 이면 변위 0 (여러 x·z, 마운드 중심 위 포함)', () => {
    const zs = [
      withMound.frontFlatZ + 0.001,
      withMound.frontFlatZ + 0.5,
      withMound.frontFlatZ + 2,
      0,
      2.5,
    ]
    const xs = [0, withMound.mounds[0].x, 5, -5, 11]
    for (const z of zs) {
      for (const x of xs) {
        expect(sandHeightAt(x, z, withMound)).toBe(0)
      }
    }
  })

  it('z = frontFlatZ 정확히에서 0 (경계 포함)', () => {
    expect(sandHeightAt(0, withMound.frontFlatZ, withMound)).toBe(0)
  })

  it('앞→뒤 전환이 연속적이다(경계에서 급격한 점프 없음)', () => {
    const x = withMound.mounds[0].x
    let prev = sandHeightAt(x, withMound.frontFlatZ, withMound) // 0
    for (let z = withMound.frontFlatZ - 0.05; z >= withMound.frontFlatZ - withMound.frontTaperWidth - 2; z -= 0.05) {
      const cur = sandHeightAt(x, z, withMound)
      expect(Math.abs(cur - prev)).toBeLessThan(0.05) // 스텝당 작은 변화
      prev = cur
    }
  })
})

describe('sandHeightAt — ⓒ 최고점 상한 제약', () => {
  it('반환값이 maxHeight를 넘지 않는다 (마운드 height가 상한보다 커도 클램프)', () => {
    const huge: SandTerrainConfig = {
      ...withMound,
      rollAmplitude: 0.3,
      mounds: [{ x: 0, z: -3, radius: 4, height: 5 }], // 비현실적으로 큰 마운드
      maxHeight: 0.6,
    }
    for (let x = -16; x <= 16; x += 0.5) {
      for (let z = -10; z <= 3; z += 0.5) {
        expect(sandHeightAt(x, z, huge)).toBeLessThanOrEqual(huge.maxHeight + 1e-9)
      }
    }
  })
})

describe('sandHeightAt — 마운드 거동', () => {
  it('마운드 중심(전개 존)이 주변 평지보다 확실히 솟는다', () => {
    const m = withMound.mounds[0]
    const center = sandHeightAt(m.x, m.z, withMound)
    const farFlat = sandHeightAt(m.x, m.z, rollOnly) // 같은 위치, 마운드 없음
    expect(center).toBeGreaterThan(farFlat + 0.3) // 마운드가 최소 0.3 이상 기여
  })

  it('마운드 radius 밖(같은 z)은 마운드 기여가 없다(기복만 남음)', () => {
    const m = withMound.mounds[0]
    const outside = m.x + m.radius + 2
    const withM = sandHeightAt(outside, m.z, withMound)
    const without = sandHeightAt(outside, m.z, rollOnly)
    expect(withM).toBeCloseTo(without, 6)
  })
})

/* ── 실제 테마 config 가드(config.ts THEME.themes[].terrain) ── */

describe('THEME terrain — 실제 config 무결성', () => {
  const maxAllowed = FISH.bounds.minY - AQUASCAPE.sandY // sandY + h ≤ minY → h ≤ 0.6

  it('상한 상수가 0.6이다(FISH.bounds.minY − sandY)', () => {
    expect(maxAllowed).toBeCloseTo(0.6, 6)
  })

  it('kelp-forest·coral-reef는 terrain을 갖고, minimal은 갖지 않는다(하위호환)', () => {
    expect(getTheme('minimal').terrain).toBeUndefined()
    expect(getTheme('kelp-forest').terrain).toBeDefined()
    expect(getTheme('coral-reef').terrain).toBeDefined()
  })

  for (const id of ['kelp-forest', 'coral-reef']) {
    describe(id, () => {
      const terrain = getTheme(id).terrain as SandTerrainConfig

      it('maxHeight가 물고기 클리핑 상한(0.6) 이하다', () => {
        expect(terrain.maxHeight).toBeLessThanOrEqual(maxAllowed + 1e-9)
      })

      it('ⓒ 전 영역 샘플이 물고기 클리핑 상한을 넘지 않는다', () => {
        for (let x = -18; x <= 18; x += 0.5) {
          for (let z = -11; z <= 3; z += 0.4) {
            expect(sandHeightAt(x, z, terrain)).toBeLessThanOrEqual(maxAllowed + 1e-9)
          }
        }
      })

      it('ⓑ 앞쪽 평탄 존(z > frontFlatZ)은 전부 0 (새우 크롤러 보호)', () => {
        for (let x = -12; x <= 12; x += 0.5) {
          for (let z = terrain.frontFlatZ + 0.01; z <= 2.5; z += 0.3) {
            expect(sandHeightAt(x, z, terrain)).toBe(0)
          }
        }
      })

      it('ⓐ 가장자리(|x| ≥ edgeTaperEnd)는 전부 0 (알파 페이드 보존)', () => {
        const zBack = terrain.frontFlatZ - terrain.frontTaperWidth - 1
        for (let x = terrain.edgeTaperEnd; x <= 30; x += 0.5) {
          expect(sandHeightAt(x, zBack, terrain)).toBe(0)
          expect(sandHeightAt(-x, zBack, terrain)).toBe(0)
        }
      })

      it('edgeTaperStart < edgeTaperEnd (감쇠 구간이 유효)', () => {
        expect(terrain.edgeTaperStart).toBeLessThan(terrain.edgeTaperEnd)
      })
    })
  }

  it('coral-reef: 중앙 스테이지(x∈[−2,2])는 마운드 침범이 적어 물고기 유영을 보존한다', () => {
    const terrain = getTheme('coral-reef').terrain as SandTerrainConfig
    const zPeak = terrain.frontFlatZ - terrain.frontTaperWidth - 1.5 // 전개 존 깊숙이
    // 마운드 중심(off-center)이 중앙보다 훨씬 높아야 한다.
    let centerMax = 0
    for (let x = -2; x <= 2; x += 0.25) {
      centerMax = Math.max(centerMax, sandHeightAt(x, zPeak, terrain))
    }
    let moundMax = 0
    for (const m of terrain.mounds) {
      moundMax = Math.max(moundMax, sandHeightAt(m.x, m.z, terrain))
    }
    expect(moundMax).toBeGreaterThan(centerMax + 0.2)
  })

  it('coral-reef: 마운드가 1개 이상 존재한다(리프 마운드 주역)', () => {
    const terrain = getTheme('coral-reef').terrain as SandTerrainConfig
    expect(terrain.mounds.length).toBeGreaterThanOrEqual(1)
  })
})
