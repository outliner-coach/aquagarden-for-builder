/**
 * 수초 메타데이터 레지스트리.
 * 데이터는 config.ts의 PLANT.species에 그대로 두고, 타입 안전한 접근 인터페이스를 제공한다.
 *
 * ## 새 수초 추가 방법
 * 1. `src/shared/config.ts`의 `PLANT.species` 배열에 항목 1개를 추가한다
 *    (name, count, minHeight, maxHeight, minScale, maxScale, baseColor, tipColor,
 *     colorVariation, area, seed, quadCount, cardHalfWidth).
 * 2. 끝! Aquascape가 자동으로 새 수초를 렌더링한다.
 */

import { PLANT } from '../../shared/config'

/* ── Types ── */

export interface PlantSpecies {
  readonly name: string
  readonly count: number
  readonly minHeight: number
  readonly maxHeight: number
  readonly minScale: number
  readonly maxScale: number
  readonly baseColor: readonly [number, number, number]
  readonly tipColor: readonly [number, number, number]
  readonly colorVariation: number
  readonly area: {
    readonly minX: number
    readonly maxX: number
    readonly minZ: number
    readonly maxZ: number
  }
  readonly seed: number
  readonly quadCount: number
  readonly cardHalfWidth: number
}

/* ── Registry ── */

/** config.PLANT.species를 PlantSpecies 타입으로 노출한다. 데이터는 config.ts에 원본 유지. */
export const PLANT_REGISTRY: readonly PlantSpecies[] = PLANT.species

/* ── Helpers ── */

/** name으로 수초 종을 조회한다. 없으면 throw. */
export function getPlantSpecies(name: string): PlantSpecies {
  const found = PLANT_REGISTRY.find((p) => p.name === name)
  if (!found) {
    throw new Error(`[plantRegistry] Unknown plant species name: ${name}`)
  }
  return found
}
