import { describe, it, expect } from 'vitest'
import {
  sandHeightAt,
  localFloorY,
  lookAheadPoint,
  terrainClimbForce,
  terrainDeflectXZ,
  type SandTerrainConfig,
} from '../terrainHelpers'
import { FISH, AQUASCAPE, TERRAIN_AVOID } from '../../../shared/config'
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

/* ── 물고기 지형 회피 헬퍼 ── */

describe('localFloorY — 로컬 바닥(지형 표면+여유고)', () => {
  const sandY = AQUASCAPE.sandY // -1.8
  const minY = FISH.bounds.minY // -1.2

  it('terrain이 null이면 기본 바닥(boundsMinY) 그대로 (미니멀 하위호환)', () => {
    expect(localFloorY(0, -3, null, sandY, minY, 0.25)).toBe(minY)
  })

  it('평탄 지대(h=0)에서는 기본 바닥이 더 높아 boundsMinY를 반환한다', () => {
    // 앞쪽 평탄 존: h=0 → sandY+0+0.25=-1.55 < minY(-1.2)
    expect(localFloorY(0, 0, withMound, sandY, minY, 0.25)).toBe(minY)
  })

  it('높은 마운드 위에서는 지형 표면+여유고가 기본 바닥보다 높다', () => {
    const tall: SandTerrainConfig = {
      ...withMound,
      mounds: [{ x: 0, z: -3, radius: 4, height: 1.2 }],
      maxHeight: 1.2,
    }
    const h = sandHeightAt(0, -3, tall)
    expect(sandY + h).toBeGreaterThan(minY) // 전제: 표면 자체가 minY 위
    expect(localFloorY(0, -3, tall, sandY, minY, 0.25)).toBeCloseTo(sandY + h + 0.25, 9)
  })

  it('여유고(clearance)만큼 바닥이 올라간다', () => {
    const tall: SandTerrainConfig = {
      ...withMound,
      mounds: [{ x: 0, z: -3, radius: 4, height: 1.2 }],
      maxHeight: 1.2,
    }
    const a = localFloorY(0, -3, tall, sandY, minY, 0)
    const b = localFloorY(0, -3, tall, sandY, minY, 0.3)
    expect(b - a).toBeCloseTo(0.3, 9)
  })
})

describe('lookAheadPoint — 전방 예측 지점', () => {
  it('정지 상태면 제자리를 반환한다', () => {
    expect(lookAheadPoint(1, -2, 0, 0, 0.6, 1.8)).toEqual({ x: 1, z: -2 })
  })

  it('속도 방향으로 lookAheadSec만큼 전진한 지점을 반환한다', () => {
    const p = lookAheadPoint(0, 0, 1, 0, 0.5, 10)
    expect(p.x).toBeCloseTo(0.5, 9)
    expect(p.z).toBeCloseTo(0, 9)
  })

  it('예측 거리가 maxDist를 넘으면 방향 유지한 채 거리만 상한된다', () => {
    const p = lookAheadPoint(0, 0, 10, 0, 1, 1.5)
    expect(p.x).toBeCloseTo(1.5, 9)
    expect(p.z).toBeCloseTo(0, 9)
    const q = lookAheadPoint(0, 0, 3, 4, 1, 1) // |v|=5 → 단위 (0.6, 0.8)
    expect(Math.hypot(q.x, q.z)).toBeCloseTo(1, 9)
    expect(q.x / q.z).toBeCloseTo(3 / 4, 9)
  })
})

describe('terrainClimbForce — 상승 조향력', () => {
  it('바닥 위 margin보다 높으면 0', () => {
    expect(terrainClimbForce(0, -1.2, -1.2, 0.5, 2.5, 2)).toBe(0)
  })

  it('margin 안으로 들어오면 양수, 바닥에 가까울수록 강하다', () => {
    const far = terrainClimbForce(-0.8, -1.2, -1.2, 0.5, 2.5, 2)
    const near = terrainClimbForce(-1.1, -1.2, -1.2, 0.5, 2.5, 2)
    expect(far).toBeGreaterThan(0)
    expect(near).toBeGreaterThan(far)
  })

  it('현재·전방 바닥 중 높은 쪽을 기준으로 삼는다 (전방 경사 선제 상승)', () => {
    // 현재 바닥은 멀지만(-1.2) 전방 바닥이 높음(-0.6) → 힘이 걸린다
    const f = terrainClimbForce(-0.7, -1.2, -0.6, 0.5, 2.5, 2)
    expect(f).toBeGreaterThan(0)
    // 전방을 무시했다면 0이었을 상황
    expect(terrainClimbForce(-0.7, -1.2, -1.2, 0.5, 2.5, 2)).toBe(0)
  })

  it('바닥보다 아래로 파고든 경우에도 힘이 상한(cap)을 넘지 않는다', () => {
    const f = terrainClimbForce(-5, -1.2, -1.2, 0.5, 2.5, 2)
    expect(f).toBeLessThanOrEqual(2.5 * 2 + 1e-9)
    expect(f).toBeGreaterThan(0)
  })
})

describe('terrainDeflectXZ — 경사 수평 우회 조향', () => {
  const tall: SandTerrainConfig = {
    rollAmplitude: 0,
    rollScale: 0.4,
    mounds: [{ x: 0, z: -5, radius: 5, height: 1.2 }],
    edgeTaperStart: 20,
    edgeTaperEnd: 24,
    frontFlatZ: 5,
    frontTaperWidth: 1,
    maxHeight: 1.2,
  }
  const sandY = AQUASCAPE.sandY

  it('바닥에서 충분히 높으면 0 벡터', () => {
    const d = terrainDeflectXZ(2, -5, tall, 5, sandY, 0.25, 0.5, 0.4, 1.4)
    expect(d).toEqual({ x: 0, z: 0 })
  })

  it('마운드 비탈에서 내리막(중심 반대) 방향으로 민다', () => {
    // 마운드 중심 x=0의 오른쪽 비탈(x=2.5): 내리막은 +x
    const y = sandY + sandHeightAt(2.5, -5, tall) + 0.1 // 표면 바로 위
    const d = terrainDeflectXZ(2.5, -5, tall, y, sandY, 0.25, 0.5, 0.4, 1.4)
    expect(d.x).toBeGreaterThan(0)
    // 왼쪽 비탈(x=-2.5)은 -x로
    const y2 = sandY + sandHeightAt(-2.5, -5, tall) + 0.1
    const d2 = terrainDeflectXZ(-2.5, -5, tall, y2, sandY, 0.25, 0.5, 0.4, 1.4)
    expect(d2.x).toBeLessThan(0)
  })

  it('평탄 지대(기울기 0)에서는 낮게 있어도 0 벡터', () => {
    // 마운드에서 멀리(x=15는 edge taper 안, 기복 0) — 기울기 없음
    const d = terrainDeflectXZ(15, -5, tall, sandY, sandY, 0.25, 0.5, 0.4, 1.4)
    expect(Math.abs(d.x)).toBeLessThan(1e-6)
    expect(Math.abs(d.z)).toBeLessThan(1e-6)
  })
})

/* ── 실제 테마 config 가드(config.ts THEME.themes[].terrain) ── */

describe('THEME terrain — 실제 config 무결성', () => {
  // 지형은 이제 FISH.bounds.minY 위로 솟을 수 있다(마운드 융기 — 물고기는 Fish.update가
  // 로컬 바닥(지형 표면+clearance) 기준 소프트 조향+하드 클램프로 동적으로 회피한다).
  // 대신 수면 여유 가드: 지형 꼭대기+여유고가 수면(maxY) 아래 minHeadroom만큼의
  // 유영 공간을 반드시 남겨야 한다(물고기가 끼이는 협곡 방지).
  const maxAllowed =
    FISH.bounds.maxY - TERRAIN_AVOID.minHeadroom - TERRAIN_AVOID.clearance - AQUASCAPE.sandY

  it('kelp-forest·coral-reef는 terrain을 갖고, minimal은 갖지 않는다(하위호환)', () => {
    expect(getTheme('minimal').terrain).toBeUndefined()
    expect(getTheme('kelp-forest').terrain).toBeDefined()
    expect(getTheme('coral-reef').terrain).toBeDefined()
  })

  for (const id of ['kelp-forest', 'coral-reef']) {
    describe(id, () => {
      const terrain = getTheme(id).terrain as SandTerrainConfig

      it('maxHeight가 수면 여유 상한(maxY−minHeadroom−clearance−sandY) 이하다', () => {
        expect(terrain.maxHeight).toBeLessThanOrEqual(maxAllowed + 1e-9)
      })

      it('ⓒ 전 영역 샘플이 수면 여유 상한을 넘지 않는다', () => {
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

  it('coral-reef: 마운드 정점 표면이 물고기 옛 바닥(minY)보다 확실히 솟는다(융기 반영 회귀 가드)', () => {
    // phase9 미결 "마운드 융기감이 높이 상한 탓에 약함"의 재발 방지 — 지형이 물고기
    // 유영 공간으로 실제 융기해야 회피 거동도 의미가 있다.
    const terrain = getTheme('coral-reef').terrain as SandTerrainConfig
    let peak = 0
    for (const m of terrain.mounds) {
      peak = Math.max(peak, sandHeightAt(m.x, m.z, terrain))
    }
    expect(AQUASCAPE.sandY + peak).toBeGreaterThan(FISH.bounds.minY + 0.2)
  })
})
