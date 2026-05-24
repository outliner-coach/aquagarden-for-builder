/**
 * 먹이주기/놀래키기 순수 헬퍼 함수.
 * Three.js 의존 없이 {x,y,z} 평범한 벡터 타입만 사용.
 */

import type { Vec3 } from './boids'

/**
 * target 방향으로 끌리는 조향 벡터 (먹이주기용).
 * radius 밖이면 영벡터. 가까이 오면 일정(부드러운 모임 — weight만 크기 결정).
 */
export function attractSteer(pos: Vec3, target: Vec3, weight: number, radius: number): Vec3 {
  const dx = target.x - pos.x
  const dy = target.y - pos.y
  const dz = target.z - pos.z
  const distSq = dx * dx + dy * dy + dz * dz
  const r2 = radius * radius

  if (distSq === 0 || distSq > r2) return { x: 0, y: 0, z: 0 }

  const dist = Math.sqrt(distSq)
  // 정규화한 방향 * weight
  const inv = weight / dist
  return { x: dx * inv, y: dy * inv, z: dz * inv }
}

/**
 * target 반대 방향으로 도망하는 조향 벡터 (놀래키기용).
 * radius 밖이면 영벡터. 가까울수록 강하다(1/dist 비례).
 */
export function fleeSteer(pos: Vec3, target: Vec3, weight: number, radius: number): Vec3 {
  const dx = pos.x - target.x
  const dy = pos.y - target.y
  const dz = pos.z - target.z
  const distSq = dx * dx + dy * dy + dz * dz
  const r2 = radius * radius

  if (distSq === 0 || distSq > r2) return { x: 0, y: 0, z: 0 }

  const dist = Math.sqrt(distSq)
  // 가까울수록 강하게: weight * (radius / dist) / dist = weight * radius / dist^2
  const factor = (weight * radius) / (dist * dist)
  // 정규화 방향 * factor
  const inv = factor / dist
  return { x: dx * inv, y: dy * inv, z: dz * inv }
}

/**
 * 먹이 낙하 Y 변위 (음수 = 아래로).
 */
export function foodFallDelta(dt: number, fallSpeed: number): number {
  if (dt === 0) return 0
  return -dt * fallSpeed
}

/**
 * 물고기가 먹이를 먹었는지 판정 (거리 기반).
 * eatRadius 이내(경계 포함)이면 true.
 */
export function isEaten(fishPos: Vec3, foodPos: Vec3, eatRadius: number): boolean {
  const dx = fishPos.x - foodPos.x
  const dy = fishPos.y - foodPos.y
  const dz = fishPos.z - foodPos.z
  return dx * dx + dy * dy + dz * dz <= eatRadius * eatRadius
}
