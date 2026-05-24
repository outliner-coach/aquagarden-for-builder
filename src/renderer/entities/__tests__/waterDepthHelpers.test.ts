import { describe, it, expect } from 'vitest'
import { waterDepthAlphaFactor } from '../waterDepthHelpers'
import { WATER, AQUASCAPE } from '../../../shared/config'

describe('waterDepthAlphaFactor', () => {
  it('near 이하에서는 완전 불투명(1)', () => {
    expect(waterDepthAlphaFactor(0, 4, 15, 1)).toBe(1)
    expect(waterDepthAlphaFactor(4, 4, 15, 1)).toBe(1)
  })

  it('깊이가 멀수록 단조 감소', () => {
    const a = waterDepthAlphaFactor(6, 4, 15, 1)
    const b = waterDepthAlphaFactor(10, 4, 15, 1)
    const c = waterDepthAlphaFactor(14, 4, 15, 1)
    expect(a).toBeGreaterThan(b)
    expect(b).toBeGreaterThan(c)
  })

  it('alphaFar 이상에서 0으로 클램프 (maxFade=1)', () => {
    expect(waterDepthAlphaFactor(15, 4, 15, 1)).toBeCloseTo(0, 6)
    expect(waterDepthAlphaFactor(20, 4, 15, 1)).toBe(0)
  })

  it('factor는 [0,1] 범위를 벗어나지 않는다', () => {
    for (const d of [-5, 0, 5, 10, 16, 100]) {
      const f = waterDepthAlphaFactor(d, 4, 15, 1)
      expect(f).toBeGreaterThanOrEqual(0)
      expect(f).toBeLessThanOrEqual(1)
    }
  })

  // 회귀 가드: 실제 config로 모래 평면의 먼 가장자리가 알파 0으로 용해되어야 수평선이 안 보인다.
  // 카메라 z=5, 모래 mesh z=-4, PlaneGeometry 깊이 14 → world z 최소 -11 → 먼 가장자리 뷰 깊이 = 5-(-11)=16.
  it('모래 평면 먼 가장자리(뷰 깊이≈16)에서 알파가 0으로 용해된다', () => {
    const CAMERA_Z = 5
    const SAND_PLANE_DEPTH = 14
    const farEdgeWorldZ = -4 /* sand mesh z */ - SAND_PLANE_DEPTH / 2
    const farEdgeViewDepth = CAMERA_Z - farEdgeWorldZ // = 16
    expect(farEdgeViewDepth).toBe(16)
    const alpha = waterDepthAlphaFactor(
      farEdgeViewDepth,
      WATER.depthNear,
      WATER.alphaDepthFar,
      WATER.maxAlphaFade,
    )
    expect(alpha).toBeCloseTo(0, 3)
    // AQUASCAPE.sandY 참조로 모래 평면 가정이 바뀌면 알림 (먼 가장자리 계산은 z 기반이라 직접 영향 없음)
    expect(AQUASCAPE.sandY).toBeLessThan(0)
  })
})
