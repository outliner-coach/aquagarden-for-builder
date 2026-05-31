import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { Fish } from '../Fish'
import type { FishPrototype } from '../fishAssets'
import type { SpeciesId } from '../speciesRegistry'
import { FISH, SHRIMP } from '../../../shared/config'

/**
 * 새우(crawler) 거동 통합 테스트.
 * 순수 헬퍼(floorBiasForce/scuttleSpeedFactor)는 crawlerHelpers.test에서 가드하고,
 * 여기서는 그 헬퍼가 Fish.update에 올바르게 배선됐는지(축·부호·종별 분기)를
 * 실제 Fish 인스턴스를 굴려 결정적으로 검증한다.
 */

function makeProto(behavior: 'swim' | 'crawler'): FishPrototype {
  return {
    scene: new THREE.Group(),
    clip: null,
    baseScale: 0.375,
    swimSpeed: 0.5,
    behavior,
    normScale: 1,
    center: new THREE.Vector3(),
  }
}

function makeFish(behavior: 'swim' | 'crawler'): Fish {
  const protos = new Map<SpeciesId, FishPrototype>([['shrimp', makeProto(behavior)]])
  const fish = new Fish(protos)
  fish.reset(0.42, 'individual', 'shrimp')
  return fish
}

const targetY = FISH.bounds.minY + SHRIMP.floorOffset
const midY = (FISH.bounds.minY + FISH.bounds.maxY) / 2
const dt = 1 / 30

describe('새우 crawler 거동 (Fish.update 통합)', () => {
  it('수조 맨 위에서 시작해도 바닥 띠로 내려와 머문다', () => {
    const fish = makeFish('crawler')
    fish.position.set(0, FISH.bounds.maxY, 0) // 맨 위에서 출발
    for (let i = 0; i < 600; i++) fish.update(dt)
    // 목표 높이(minY+offset) 근방으로 수렴
    expect(Math.abs(fish.position.y - targetY)).toBeLessThan(0.4)
    expect(fish.position.y).toBeLessThan(midY) // 확실히 하단부
  })

  it('정착 후에도 계속 하단부에 머문다 (위로 떠오르지 않음)', () => {
    const fish = makeFish('crawler')
    fish.position.set(0, FISH.bounds.maxY, 0)
    for (let i = 0; i < 400; i++) fish.update(dt)
    let maxYSeen = -Infinity
    for (let i = 0; i < 200; i++) {
      fish.update(dt)
      maxYSeen = Math.max(maxYSeen, fish.position.y)
    }
    expect(maxYSeen).toBeLessThan(midY)
  })

  it('수평으로는 이동한다 (제자리 고정이 아님)', () => {
    const fish = makeFish('crawler')
    fish.position.set(0, targetY, 0)
    const x0 = fish.position.x
    const z0 = fish.position.z
    for (let i = 0; i < 300; i++) fish.update(dt)
    const moved = Math.hypot(fish.position.x - x0, fish.position.z - z0)
    expect(moved).toBeGreaterThan(0.1)
  })

  it('항상 수조 경계 안에 머문다', () => {
    const fish = makeFish('crawler')
    fish.position.set(0, FISH.bounds.maxY, 0)
    const b = FISH.bounds
    for (let i = 0; i < 800; i++) {
      fish.update(dt)
      expect(fish.position.y).toBeGreaterThanOrEqual(b.minY - 1e-6)
      expect(fish.position.y).toBeLessThanOrEqual(b.maxY + 1e-6)
    }
  })

  it('일반 유영(swim) 어종은 바닥에 고정되지 않는다 (거동 차별화 확인)', () => {
    const fish = makeFish('swim')
    fish.position.set(0, midY, 0)
    let maxYSeen = -Infinity
    for (let i = 0; i < 600; i++) {
      fish.update(dt)
      maxYSeen = Math.max(maxYSeen, fish.position.y)
    }
    // swim은 수직 방랑이 있어 목표 띠보다 위로 충분히 올라간다
    expect(maxYSeen).toBeGreaterThan(targetY + 0.5)
  })
})
