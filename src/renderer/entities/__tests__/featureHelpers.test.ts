import { describe, it, expect } from 'vitest'
import { reconcileFeatures, featureSpawnPosition } from '../featureHelpers'

describe('reconcileFeatures', () => {
  it('target이 active보다 크면 acquire만 반환한다', () => {
    const target = new Set(['manta', 'whale'] as const)
    const active = new Set(['manta'] as const)
    const result = reconcileFeatures(target, active)
    expect(result.acquire).toEqual(['whale'])
    expect(result.release).toEqual([])
  })

  it('active가 target보다 크면 release만 반환한다', () => {
    const target = new Set(['manta'] as const)
    const active = new Set(['manta', 'whale'] as const)
    const result = reconcileFeatures(target, active)
    expect(result.acquire).toEqual([])
    expect(result.release).toEqual(['whale'])
  })

  it('동일하면 둘 다 빈 배열 (멱등)', () => {
    const target = new Set(['dolphin', 'shark'] as const)
    const active = new Set(['dolphin', 'shark'] as const)
    const result = reconcileFeatures(target, active)
    expect(result.acquire).toEqual([])
    expect(result.release).toEqual([])
  })

  it('부분 교차 시 acquire와 release 모두 반환한다', () => {
    const target = new Set(['manta', 'shark'] as const)
    const active = new Set(['manta', 'whale'] as const)
    const result = reconcileFeatures(target, active)
    expect(result.acquire).toEqual(['shark'])
    expect(result.release).toEqual(['whale'])
  })

  it('둘 다 비어 있으면 빈 배열', () => {
    const result = reconcileFeatures(new Set(), new Set())
    expect(result.acquire).toEqual([])
    expect(result.release).toEqual([])
  })

  it('active가 비어 있으면 target 전체가 acquire', () => {
    const target = new Set(['manta', 'whale', 'dolphin'] as const)
    const result = reconcileFeatures(target, new Set())
    expect(result.acquire).toEqual(['manta', 'whale', 'dolphin'])
    expect(result.release).toEqual([])
  })
})

describe('featureSpawnPosition', () => {
  const area = { minX: -5, maxX: 5, minY: -0.4, maxY: 1.2, minZ: -1.2, maxZ: 0.2 }

  it('결과가 항상 area 경계 내에 있다', () => {
    for (let seed = 0; seed < 100; seed++) {
      const pos = featureSpawnPosition(seed, area)
      expect(pos.x).toBeGreaterThanOrEqual(area.minX)
      expect(pos.x).toBeLessThanOrEqual(area.maxX)
      expect(pos.y).toBeGreaterThanOrEqual(area.minY)
      expect(pos.y).toBeLessThanOrEqual(area.maxY)
      expect(pos.z).toBeGreaterThanOrEqual(area.minZ)
      expect(pos.z).toBeLessThanOrEqual(area.maxZ)
    }
  })

  it('같은 seed는 같은 좌표를 반환한다 (결정적)', () => {
    const a = featureSpawnPosition(42, area)
    const b = featureSpawnPosition(42, area)
    expect(a).toEqual(b)
  })

  it('다른 seed는 일반적으로 다른 좌표를 반환한다', () => {
    const a = featureSpawnPosition(1, area)
    const b = featureSpawnPosition(2, area)
    const same = a.x === b.x && a.y === b.y && a.z === b.z
    expect(same).toBe(false)
  })
})
