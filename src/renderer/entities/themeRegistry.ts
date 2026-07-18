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
    /** 큰 바위 지오메트리 스타일. 미지정 시 'classic'(기존 정12면체 — 미니멀 무변화). */
    readonly rockStyle?: 'classic' | 'displaced'
    /** rockStyle='displaced'일 때의 변위 시드(결정적, displaceRockPositions). */
    readonly displaceSeed?: number
    /** rockStyle='displaced'일 때의 최대 변위량(오브젝트 로컬 반경 스칼라). */
    readonly displaceStrength?: number
    /** 큰 바위 메시의 추가 Y 스케일 배율(미지정 시 1=변화 없음). 낮고 넓은 암반(산호초 등)에 사용. */
    readonly flattenY?: number
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

/** 다시마 숲 테마의 kelp 배치·색 구성(kelpHelpers.generateKelpClusters 입력과 대응). */
export interface BackgroundThemeKelp {
  /** 홀드패스트(포기) 개수. 포기당 bladesPerCluster개 가닥이 솟는다. */
  readonly clusterCount: number
  /** 포기당 가닥 수 [min, max] (정수, 포함). */
  readonly bladesPerCluster: readonly [number, number]
  /** 가닥이 홀드패스트 중심에서 흩어지는 최대 반경(월드 유닛). */
  readonly clusterRadius: number
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

/** 산호초 리프 마운드 하나(피복 대상). coralHelpers.ReefMound와 동일 형태. */
export interface BackgroundThemeReefMound {
  readonly x: number
  readonly z: number
  readonly radius: number
  readonly colonyCount: number
}

/** 산호초 테마의 coral 리프 피복 배치 구성(coralHelpers.generateReefColonies 입력과 대응). */
export interface BackgroundThemeCoral {
  readonly seed: number
  /** 피복 대상 리프 마운드들(표면을 콜로니가 뒤덮음). */
  readonly mounds: readonly BackgroundThemeReefMound[]
  /** 마운드 밖 채널 가장자리 소수 콜로니. */
  readonly scatter: {
    readonly count: number
    readonly area: {
      readonly minX: number
      readonly maxX: number
      readonly minZ: number
      readonly maxZ: number
    }
    /** 중앙 물고기 스테이지 반폭(|x| < 이 값은 비워 시야 확보). */
    readonly stageHalfWidth: number
  }
}

/** 지형 feature 마운드 하나(리프 덩어리 등). terrainHelpers.TerrainMound와 동일 형태. */
export interface BackgroundThemeTerrainMound {
  readonly x: number
  readonly z: number
  readonly radius: number
  readonly height: number
}

/**
 * 테마별 모래바닥 지형(heightfield) 구성. terrainHelpers.SandTerrainConfig와 동일 형태 —
 * Aquascape가 이 값을 그대로 sandHeightAt에 넘겨 PlaneGeometry 버텍스를 변위한다. 다시마 숲·
 * 산호초만 갖는 선택 필드(미니멀은 undefined → 변위 경로 자체를 타지 않음, 하위호환).
 */
export interface BackgroundThemeTerrain {
  readonly rollAmplitude: number
  readonly rollScale: number
  readonly mounds: readonly BackgroundThemeTerrainMound[]
  readonly edgeTaperStart: number
  readonly edgeTaperEnd: number
  readonly frontFlatZ: number
  readonly frontTaperWidth: number
  readonly maxHeight: number
  /** 마운드/기복 정점 버텍스 컬러 변조 색(바위/암반 톤). */
  readonly crestColor: number
  /** 정점 컬러 변조 강도(0=무변조, 1=완전 crestColor). */
  readonly crestColorStrength: number
}

/**
 * 배경 테마 하나의 구성. 인터페이스이므로 확장 가능. kelp는 다시마 숲, coral은 산호초 테마만
 * 갖는 선택 필드(형태·색 파라미터는 config.KELP/CORAL, 여기 필드는 배치 seed/count/area).
 */
export interface BackgroundTheme {
  readonly id: string
  readonly displayName: string
  readonly sandColor: number
  readonly plants: readonly BackgroundThemePlant[]
  readonly hardscape: BackgroundThemeHardscape
  readonly kelp?: BackgroundThemeKelp
  readonly coral?: BackgroundThemeCoral
  /** 모래바닥 지형(heightfield). 미니멀은 없음(평평, 하위호환). */
  readonly terrain?: BackgroundThemeTerrain
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
