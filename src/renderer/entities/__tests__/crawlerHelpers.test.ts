import { describe, it, expect } from 'vitest'
import { floorBiasForce, scuttleSpeedFactor } from '../crawlerHelpers'

describe('floorBiasForce — 바닥 띠로 끌어당기는 수직 스프링 (바닥 기는 새우)', () => {
  // 목표 높이 = floorY + offset
  const floorY = -1.2
  const offset = 0.45
  const pull = 4
  const targetY = floorY + offset // -0.75

  it('목표 높이에 정확히 있으면 힘이 0이다', () => {
    expect(floorBiasForce(targetY, floorY, offset, pull)).toBeCloseTo(0, 6)
  })

  it('목표보다 위에 있으면 아래로 끌어내린다 (음수)', () => {
    expect(floorBiasForce(targetY + 0.5, floorY, offset, pull)).toBeLessThan(0)
  })

  it('목표보다 아래에 있으면 위로 밀어올린다 (양수)', () => {
    expect(floorBiasForce(targetY - 0.5, floorY, offset, pull)).toBeGreaterThan(0)
  })

  it('변위와 pull에 비례한다 (선형 스프링)', () => {
    // y가 목표보다 1만큼 위 → 힘 = -pull*1
    expect(floorBiasForce(targetY + 1, floorY, offset, pull)).toBeCloseTo(-pull, 6)
    // pull 2배면 힘도 2배
    expect(floorBiasForce(targetY + 1, floorY, offset, pull * 2)).toBeCloseTo(-pull * 2, 6)
  })
})

describe('scuttleSpeedFactor — 종종거림 속도 envelope (전진→멈칫→전진)', () => {
  const period = 1.7
  const minFactor = 0.12

  it('주기 경계(phase=0)에서 최저(멈칫)다', () => {
    expect(scuttleSpeedFactor(0, period, minFactor)).toBeCloseTo(minFactor, 6)
  })

  it('주기 중앙에서 최고(1, 전진)다', () => {
    expect(scuttleSpeedFactor(period / 2, period, minFactor)).toBeCloseTo(1, 6)
  })

  it('항상 [minFactor, 1] 범위 안에 있다', () => {
    for (let i = 0; i <= 40; i++) {
      const f = scuttleSpeedFactor((period * i) / 40, period, minFactor)
      expect(f).toBeGreaterThanOrEqual(minFactor - 1e-9)
      expect(f).toBeLessThanOrEqual(1 + 1e-9)
    }
  })

  it('주기적이다 (phase와 phase+period가 같다)', () => {
    expect(scuttleSpeedFactor(0.3, period, minFactor)).toBeCloseTo(
      scuttleSpeedFactor(0.3 + period, period, minFactor),
      6,
    )
  })
})
