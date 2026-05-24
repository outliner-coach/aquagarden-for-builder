import { describe, it, expect } from 'vitest'
import {
  separation,
  alignment,
  cohesion,
  computeBoidsSteer,
} from '../boids'
import type { BoidAgent } from '../boids'

/* ── helpers ── */

function agent(
  x: number, y: number, z: number,
  vx = 0, vy = 0, vz = 0,
): BoidAgent {
  return { position: { x, y, z }, velocity: { x: vx, y: vy, z: vz } }
}

/* ── separation ── */

describe('separation', () => {
  it('오른쪽에 이웃이 몰려 있으면 왼쪽(-x)으로 밀어낸다', () => {
    const self = agent(0, 0, 0)
    const neighbors = [agent(1, 0, 0), agent(0.8, 0, 0)]
    const result = separation(self, neighbors, 2)
    expect(result.x).toBeLessThan(0)
  })

  it('왼쪽에 이웃이 있으면 오른쪽(+x)으로 밀어낸다', () => {
    const self = agent(0, 0, 0)
    const neighbors = [agent(-1, 0, 0)]
    const result = separation(self, neighbors, 2)
    expect(result.x).toBeGreaterThan(0)
  })

  it('이웃이 위아래에 있으면 y축 분리', () => {
    const self = agent(0, 0, 0)
    const neighbors = [agent(0, 1, 0)]
    const result = separation(self, neighbors, 2)
    expect(result.y).toBeLessThan(0)
  })

  it('반경 밖의 이웃은 무시한다', () => {
    const self = agent(0, 0, 0)
    const neighbors = [agent(10, 0, 0)]
    const result = separation(self, neighbors, 2)
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
    expect(result.z).toBe(0)
  })

  it('이웃이 없으면 영벡터 반환', () => {
    const self = agent(0, 0, 0)
    const result = separation(self, [], 2)
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
    expect(result.z).toBe(0)
  })

  it('이웃이 가까울수록 더 강하게 밀어낸다', () => {
    const self = agent(0, 0, 0)
    const close = separation(self, [agent(0.5, 0, 0)], 2)
    const far = separation(self, [agent(1.5, 0, 0)], 2)
    expect(Math.abs(close.x)).toBeGreaterThan(Math.abs(far.x))
  })

  it('자기 자신과 같은 위치의 이웃은 안전하게 처리', () => {
    const self = agent(0, 0, 0)
    const neighbors = [agent(0, 0, 0)]
    const result = separation(self, neighbors, 2)
    // 겹치면 영벡터 또는 유한값이어야 함 (NaN/Infinity 금지)
    expect(Number.isFinite(result.x)).toBe(true)
    expect(Number.isFinite(result.y)).toBe(true)
    expect(Number.isFinite(result.z)).toBe(true)
  })
})

/* ── alignment ── */

describe('alignment', () => {
  it('이웃이 +x 방향으로 이동 중이면 alignment도 +x', () => {
    const self = agent(0, 0, 0, 0, 0, 0)
    const neighbors = [agent(1, 0, 0, 2, 0, 0), agent(1, 1, 0, 3, 0, 0)]
    const result = alignment(self, neighbors)
    expect(result.x).toBeGreaterThan(0)
  })

  it('이웃 속도가 -y이면 alignment도 -y', () => {
    const self = agent(0, 0, 0, 0, 0, 0)
    const neighbors = [agent(1, 0, 0, 0, -2, 0)]
    const result = alignment(self, neighbors)
    expect(result.y).toBeLessThan(0)
  })

  it('이웃이 없으면 영벡터', () => {
    const self = agent(0, 0, 0, 1, 0, 0)
    const result = alignment(self, [])
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
    expect(result.z).toBe(0)
  })

  it('self 속도와 이웃 평균 속도가 같으면 영벡터에 가까움', () => {
    const self = agent(0, 0, 0, 2, 0, 0)
    const neighbors = [agent(1, 0, 0, 2, 0, 0)]
    const result = alignment(self, neighbors)
    expect(Math.abs(result.x)).toBeLessThan(0.001)
  })
})

/* ── cohesion ── */

describe('cohesion', () => {
  it('이웃이 오른쪽에 있으면 오른쪽(+x)으로 끌린다', () => {
    const self = agent(0, 0, 0)
    const neighbors = [agent(3, 0, 0), agent(5, 0, 0)]
    const result = cohesion(self, neighbors)
    expect(result.x).toBeGreaterThan(0)
  })

  it('이웃이 왼쪽에 있으면 왼쪽(-x)으로 끌린다', () => {
    const self = agent(0, 0, 0)
    const neighbors = [agent(-3, 0, 0)]
    const result = cohesion(self, neighbors)
    expect(result.x).toBeLessThan(0)
  })

  it('이웃이 없으면 영벡터', () => {
    const self = agent(0, 0, 0)
    const result = cohesion(self, [])
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
    expect(result.z).toBe(0)
  })

  it('자기와 같은 위치의 이웃이면 영벡터에 가까움', () => {
    const self = agent(0, 0, 0)
    const neighbors = [agent(0, 0, 0)]
    const result = cohesion(self, neighbors)
    expect(Math.abs(result.x)).toBeLessThan(0.001)
    expect(Math.abs(result.y)).toBeLessThan(0.001)
    expect(Math.abs(result.z)).toBeLessThan(0.001)
  })
})

/* ── computeBoidsSteer ── */

describe('computeBoidsSteer', () => {
  const defaultWeights = {
    separationWeight: 2.0,
    alignmentWeight: 1.0,
    cohesionWeight: 1.0,
  }
  const defaultRadii = {
    separationRadius: 1.5,
    alignmentRadius: 3.0,
    cohesionRadius: 3.0,
  }

  it('이웃이 없으면 영벡터', () => {
    const self = agent(0, 0, 0, 1, 0, 0)
    const result = computeBoidsSteer(self, [], defaultWeights, defaultRadii)
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
    expect(result.z).toBe(0)
  })

  it('가까운 이웃 하나에 대해 분리 방향 조향', () => {
    const self = agent(0, 0, 0, 1, 0, 0)
    const neighbors = [agent(0.5, 0, 0, 1, 0, 0)]
    const result = computeBoidsSteer(self, neighbors, defaultWeights, defaultRadii)
    // separation이 지배적 → -x 방향
    expect(result.x).toBeLessThan(0)
  })

  it('먼 이웃에 대해 cohesion이 지배적', () => {
    const self = agent(0, 0, 0, 1, 0, 0)
    // separationRadius(1.5) 밖, cohesionRadius(3.0) 안
    const neighbors = [agent(2.5, 0, 0, 1, 0, 0)]
    const result = computeBoidsSteer(self, neighbors, defaultWeights, defaultRadii)
    // cohesion → +x 방향
    expect(result.x).toBeGreaterThan(0)
  })

  it('반환값은 항상 유한', () => {
    const self = agent(0, 0, 0, 0, 0, 0)
    const neighbors = [agent(0, 0, 0, 0, 0, 0)]
    const result = computeBoidsSteer(self, neighbors, defaultWeights, defaultRadii)
    expect(Number.isFinite(result.x)).toBe(true)
    expect(Number.isFinite(result.y)).toBe(true)
    expect(Number.isFinite(result.z)).toBe(true)
  })

  it('가중치 0이면 해당 힘 비활성', () => {
    const self = agent(0, 0, 0, 1, 0, 0)
    const neighbors = [agent(0.5, 0, 0, 1, 0, 0)]
    const zeroWeights = {
      separationWeight: 0,
      alignmentWeight: 0,
      cohesionWeight: 0,
    }
    const result = computeBoidsSteer(self, neighbors, zeroWeights, defaultRadii)
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
    expect(result.z).toBe(0)
  })

  it('3D 공간에서 z축도 올바르게 반영', () => {
    const self = agent(0, 0, 0, 0, 0, 0)
    const neighbors = [agent(0, 0, 2.5, 0, 0, 1)]
    const result = computeBoidsSteer(self, neighbors, defaultWeights, defaultRadii)
    // cohesion → +z 방향
    expect(result.z).toBeGreaterThan(0)
  })
})
