import { describe, it, expect } from 'vitest'
import { waterDepthAlphaFactor } from '../waterDepthHelpers'
import { WATER, AQUASCAPE } from '../../../shared/config'

const { alphaDepthNear: N, alphaDepthFar: F, maxAlphaFade: M, alphaFadePower: P } = WATER

describe('waterDepthAlphaFactor (ease-out 페이드)', () => {
  it('near 이하에서는 완전 불투명(1)', () => {
    expect(waterDepthAlphaFactor(0, N, F, M, P)).toBe(1)
    expect(waterDepthAlphaFactor(N, N, F, M, P)).toBe(1)
  })

  it('깊이가 멀수록 단조 감소', () => {
    const a = waterDepthAlphaFactor(6, N, F, M, P)
    const b = waterDepthAlphaFactor(10, N, F, M, P)
    const c = waterDepthAlphaFactor(14, N, F, M, P)
    expect(a).toBeGreaterThan(b)
    expect(b).toBeGreaterThan(c)
  })

  it('alphaFar 이상에서 0으로 클램프 (maxFade=1)', () => {
    expect(waterDepthAlphaFactor(F, N, F, M, P)).toBeCloseTo(0, 6)
    expect(waterDepthAlphaFactor(F + 5, N, F, M, P)).toBe(0)
  })

  it('factor는 [0,1] 범위를 벗어나지 않는다', () => {
    for (const d of [-5, 0, 5, 10, 16, 100]) {
      const f = waterDepthAlphaFactor(d, N, F, M, P)
      expect(f).toBeGreaterThanOrEqual(0)
      expect(f).toBeLessThanOrEqual(1)
    }
  })

  // ease-out(power>1) 핵심 가드: 같은 t에서 smoothstep보다 '더 많이' 페이드한다(= 페이드를 가까운
  // 깊이쪽으로 전진시켜 먼 모래를 일찍 옅게 함). 이것이 원근 압축된 먼 가장자리(화면 ~17px)에
  // 알파를 몰아 어두운 '가로선'을 만들던 smoothstep 회귀를 막는다.
  it('중간 깊이에서 smoothstep보다 더 옅다(페이드 전진)', () => {
    const mid = (N + F) / 2 // t=0.5
    const t = 0.5
    const smoothstepFactor = 1 - t * t * (3 - 2 * t) * M // 구 곡선
    const easeOutFactor = waterDepthAlphaFactor(mid, N, F, M, P)
    expect(easeOutFactor).toBeLessThan(smoothstepFactor)
  })

  // 회귀 가드: 실제 config로 모래 평면의 먼 가장자리가 알파 0으로 용해되어야 수평선이 안 보인다.
  // 카메라 z=5, 모래 mesh z=-4, PlaneGeometry 깊이 14 → world z 최소 -11 → 먼 가장자리 뷰 깊이 = 5-(-11)=16.
  // alphaDepthFar(=16)를 이 가장자리 깊이에 맞춰 가장자리에서 정확히 0이 되게 한다.
  it('모래 평면 먼 가장자리(뷰 깊이=16)에서 알파가 0으로 용해된다', () => {
    const CAMERA_Z = 5
    const SAND_PLANE_DEPTH = 14
    const farEdgeWorldZ = -4 /* sand mesh z */ - SAND_PLANE_DEPTH / 2
    const farEdgeViewDepth = CAMERA_Z - farEdgeWorldZ // = 16
    expect(farEdgeViewDepth).toBe(16)
    expect(WATER.alphaDepthFar).toBe(farEdgeViewDepth) // config가 가장자리 깊이와 일치
    const alpha = waterDepthAlphaFactor(farEdgeViewDepth, N, F, M, P)
    expect(alpha).toBeCloseTo(0, 3)
    // AQUASCAPE.sandY 참조로 모래 평면 가정이 바뀌면 알림 (먼 가장자리 계산은 z 기반이라 직접 영향 없음)
    expect(AQUASCAPE.sandY).toBeLessThan(0)
  })
})
