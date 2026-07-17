/**
 * 배경 테마 메타데이터 레지스트리.
 * 데이터는 config.ts의 THEME.themes에 그대로 두고, 타입 안전한 접근 인터페이스를 제공한다.
 *
 * ## 새 테마 추가 방법
 * 1. `src/shared/config.ts`의 `THEME.themes` 배열에 항목 1개를 추가한다
 *    (id, displayName, sandColor, plants, hardscape).
 * 2. 끝! Aquascape 생성자/`setTheme`이 자동으로 새 테마를 렌더링한다.
 */

import { THEME } from '../../shared/config'

/* ── Types ── */

export interface BackgroundThemePlant {
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

export interface BackgroundThemeHardscape {
  readonly seed: number
  readonly rockCount: number
  readonly pebbleCount: number
  readonly driftwoodCount: number
  readonly clusterCount: number
  readonly clusterSpread: number
  readonly area: {
    readonly minX: number
    readonly maxX: number
    readonly minZ: number
    readonly maxZ: number
  }
  readonly rock: {
    readonly minScale: number
    readonly maxScale: number
    readonly maxHeightAboveSand: number
    readonly colors: readonly number[]
  }
  readonly pebble: {
    readonly minScale: number
    readonly maxScale: number
  }
  readonly driftwood: {
    readonly minLength: number
    readonly maxLength: number
    readonly minRadius: number
    readonly maxRadius: number
    readonly maxHeightAboveSand: number
    readonly color: number
    readonly colorAlt: number
  }
}

/** 다시마 숲 테마의 kelp 배치·색 구성(kelpHelpers.generateKelpInstances 입력과 대응). */
export interface BackgroundThemeKelp {
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
  readonly centerGap: number
  readonly centerProbability: number
  readonly backBias: number
}

/**
 * 배경 테마 하나의 구성. 인터페이스이므로 확장 가능 — 산호(coral) 시각 요소 config는
 * 이후 step(4)에서 선택적 필드로 추가된다. kelp는 다시마 숲 테마만 갖는 선택 필드.
 */
export interface BackgroundTheme {
  readonly id: string
  readonly displayName: string
  readonly sandColor: number
  readonly plants: readonly BackgroundThemePlant[]
  readonly hardscape: BackgroundThemeHardscape
  readonly kelp?: BackgroundThemeKelp
}

/* ── Registry ── */

/** config.THEME.themes를 BackgroundTheme 타입으로 노출한다. 데이터는 config.ts에 원본 유지. */
export const THEME_REGISTRY: readonly BackgroundTheme[] = THEME.themes

/** 저장된 themeId가 없거나 유효하지 않을 때 쓰는 기본 테마 id. */
export const DEFAULT_THEME_ID: string = THEME.defaultId

/* ── Helpers ── */

/** id로 배경 테마를 조회한다. 없으면 throw. */
export function getTheme(id: string): BackgroundTheme {
  const found = THEME_REGISTRY.find((t) => t.id === id)
  if (!found) {
    throw new Error(`[themeRegistry] Unknown theme id: ${id}`)
  }
  return found
}
