import type { SpeciesId } from './speciesRegistry'

/**
 * 목표(target)와 현재 활성(active) 특별 개체를 비교해
 * acquire(추가)·release(제거) 대상을 반환한다 (멱등).
 */
export function reconcileFeatures(
  target: ReadonlySet<SpeciesId>,
  active: ReadonlySet<SpeciesId>,
): { acquire: SpeciesId[]; release: SpeciesId[] } {
  const acquire = [...target].filter((id) => !active.has(id))
  const release = [...active].filter((id) => !target.has(id))
  return { acquire, release }
}

/**
 * 시드 기반 결정적 스폰 좌표. area 경계 내에서 x/y/z를 생성한다.
 */
export function featureSpawnPosition(
  seed: number,
  area: {
    minX: number
    maxX: number
    minY: number
    maxY: number
    minZ: number
    maxZ: number
  },
): { x: number; y: number; z: number } {
  const r = (i: number) => {
    const x = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453
    return x - Math.floor(x)
  }
  return {
    x: area.minX + r(1) * (area.maxX - area.minX),
    y: area.minY + r(2) * (area.maxY - area.minY),
    z: area.minZ + r(3) * (area.maxZ - area.minZ),
  }
}
