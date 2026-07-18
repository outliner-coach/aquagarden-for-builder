import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { Fish } from '../Fish'
import type { FishPrototype } from '../fishAssets'
import type { SpeciesId } from '../speciesRegistry'
import { FISH, SHRIMP, AQUASCAPE, TERRAIN_AVOID } from '../../../shared/config'
import { sandHeightAt, type SandTerrainConfig } from '../terrainHelpers'

/**
 * 물고기 지형 회피 통합 테스트.
 * 순수 헬퍼(localFloorY/terrainClimbForce/terrainDeflectXZ)는 terrainHelpers.test에서
 * 가드하고, 여기서는 Fish.update 배선(소프트 조향 + 하드 클램프, swim/crawler 분기)을
 * 실제 인스턴스로 오래 굴려 "지형 표면 관통 0" 불변식을 결정적으로 검증한다.
 * (정적 비전 eval은 모션 관통을 못 본다 — headingYaw 가드와 같은 원칙.)
 */

/**
 * 수조 유영역(z ≤ 0.5) 전체를 전개 존으로 삼고 정중앙을 크게 침범하는 스트레스 지형.
 * 유효 최고도(maxHeight 1.6)는 실제 테마 최고치(coral-reef 1.6, 정점 h≈1.5)를 덮는다 —
 * 테마 지형을 더 올릴 땐 이 스트레스 값도 함께 올려 커버리지를 유지할 것.
 */
const testTerrain: SandTerrainConfig = {
  rollAmplitude: 0.15,
  rollScale: 0.5,
  mounds: [{ x: 0, z: -1, radius: 6, height: 1.8 }],
  edgeTaperStart: 12,
  edgeTaperEnd: 16,
  frontFlatZ: 2,
  frontTaperWidth: 1,
  maxHeight: 1.6,
}

function makeProto(behavior: 'swim' | 'crawler'): FishPrototype {
  return {
    scene: new THREE.Group(),
    clip: null,
    baseScale: 0.375,
    swimSpeed: behavior === 'crawler' ? 0.5 : 1.2,
    behavior,
    normScale: 1,
    center: new THREE.Vector3(),
  }
}

function makeFish(
  behavior: 'swim' | 'crawler',
  seed: number,
  terrain: SandTerrainConfig | null,
): Fish {
  const id: SpeciesId = behavior === 'crawler' ? 'shrimp' : 'tetra-a'
  const protos = new Map<SpeciesId, FishPrototype>([[id, makeProto(behavior)]])
  const fish = new Fish(protos)
  fish.setTerrain(terrain)
  fish.reset(seed, 'individual', id)
  return fish
}

const dt = 1 / 30

describe('지형 회피 (Fish.update 통합)', () => {
  it('유영 물고기가 3000틱 동안 지형 표면을 한 번도 관통하지 않는다 (여유고 포함)', () => {
    for (const seed of [0.42, 7, 13.7]) {
      const fish = makeFish('swim', seed, testTerrain)
      for (let i = 0; i < 3000; i++) {
        fish.update(dt)
        const p = fish.position
        const surface = AQUASCAPE.sandY + sandHeightAt(p.x, p.z, testTerrain)
        expect(p.y).toBeGreaterThanOrEqual(surface + TERRAIN_AVOID.clearance - 1e-6)
      }
    }
  })

  it('회피 중에도 계속 유영한다 (마운드에 막혀 수평 이동이 정지하지 않음)', () => {
    const fish = makeFish('swim', 0.42, testTerrain)
    let travel = 0
    let prevX = fish.position.x
    for (let i = 0; i < 1500; i++) {
      fish.update(dt)
      travel += Math.abs(fish.position.x - prevX)
      prevX = fish.position.x
    }
    expect(travel).toBeGreaterThan(3)
  })

  it('새우(crawler)는 지형 표면을 타고 다닌다 (관통 없음 + 마운드 위에서 과부양 없음)', () => {
    const fish = makeFish('crawler', 0.42, testTerrain)
    fish.position.set(0, FISH.bounds.maxY, -1) // 마운드 상공에서 시작 → 표면으로 하강
    for (let i = 0; i < 600; i++) fish.update(dt)

    let ticksOverMound = 0
    for (let i = 0; i < 600; i++) {
      fish.update(dt)
      const p = fish.position
      const surface = AQUASCAPE.sandY + sandHeightAt(p.x, p.z, testTerrain)
      expect(p.y).toBeGreaterThanOrEqual(surface - 1e-6) // 표면 관통 금지
      if (surface > FISH.bounds.minY) {
        // 융기 지대 위에서는 표면 근처 띠(스프링 목표 ±진동)를 유지해야 한다
        ticksOverMound++
        expect(p.y - surface).toBeLessThan(SHRIMP.floorOffset + 0.6)
      }
    }
    // 마운드(반경 6, 수조 중앙)를 실제로 밟은 틱이 있어야 위 조건부 검증이 의미를 가진다
    expect(ticksOverMound).toBeGreaterThan(30)
  })

  it('terrain이 null이면 기존 평면 바닥 거동 그대로 (미니멀 하위호환)', () => {
    const fish = makeFish('swim', 3, null)
    let minYSeen = Infinity
    for (let i = 0; i < 2000; i++) {
      fish.update(dt)
      minYSeen = Math.min(minYSeen, fish.position.y)
      expect(fish.position.y).toBeGreaterThanOrEqual(FISH.bounds.minY - 1e-6)
    }
    // 지형 회피가 평면 바닥까지 침식하지 않는다 — 하단 유영 대역은 그대로 쓸 수 있어야 한다
    expect(minYSeen).toBeLessThan(FISH.bounds.minY + 0.9)
  })
})
