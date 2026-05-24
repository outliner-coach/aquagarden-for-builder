/**
 * 어종 메타데이터 단일 레지스트리.
 *
 * ## 새 어종 추가 방법
 * 1. CC0 GLB 파일을 `src/renderer/assets/fish/`에 추가한다.
 * 2. 이 파일 상단의 GLB URL import 섹션에 `import newFishUrl from '../assets/fish/new-fish.glb?url'`를 추가한다.
 * 3. `SpeciesId` 유니온에 새 id를 추가한다.
 * 4. `SPECIES_REGISTRY` 배열에 항목 1개를 추가한다 (id, file, kind, baseScale, swimSpeed, displayName, dialogue).
 * 끝! fishAssets.ts의 loadFishPrototypes가 자동으로 새 종을 로드한다.
 */

import type { FishKind } from './Fish'

/* ── GLB URL imports (Vite ?url) ── */

import clownfishUrl from '../assets/fish/clownfish.glb?url'
import butterflyfishUrl from '../assets/fish/butterflyfish.glb?url'
import lionfishUrl from '../assets/fish/lionfish.glb?url'
import tetraAUrl from '../assets/fish/tetra-a.glb?url'
import tetraBUrl from '../assets/fish/tetra-b.glb?url'

/* ── Types ── */

export type SpeciesId =
  | 'clownfish'
  | 'butterflyfish'
  | 'lionfish'
  | 'tetra-a'
  | 'tetra-b'

export interface FishSpecies {
  id: SpeciesId
  file: string
  kind: FishKind
  baseScale: number
  swimSpeed: number
  /** 한국어 표시명 (UI·대사에서 사용) */
  displayName: string
  /** 어종별 대사 목록 (step 1에서 >=10개로 채운다) */
  dialogue: readonly string[]
}

/* ── Registry ── */

export const SPECIES_REGISTRY: readonly FishSpecies[] = [
  {
    id: 'tetra-a',
    file: tetraAUrl,
    kind: 'schooling',
    baseScale: 0.58,
    swimSpeed: 1.2,
    displayName: '네온테트라 A',
    dialogue: [],
  },
  {
    id: 'tetra-b',
    file: tetraBUrl,
    kind: 'schooling',
    baseScale: 0.58,
    swimSpeed: 1.3,
    displayName: '네온테트라 B',
    dialogue: [],
  },
  {
    id: 'clownfish',
    file: clownfishUrl,
    kind: 'individual',
    baseScale: 0.85,
    swimSpeed: 0.8,
    displayName: '흰동가리',
    dialogue: [],
  },
  {
    id: 'butterflyfish',
    file: butterflyfishUrl,
    kind: 'individual',
    baseScale: 0.9,
    swimSpeed: 0.7,
    displayName: '나비고기',
    dialogue: [],
  },
  {
    id: 'lionfish',
    file: lionfishUrl,
    kind: 'individual',
    baseScale: 0.95,
    swimSpeed: 0.6,
    displayName: '쏠배감펭',
    dialogue: [],
  },
]

/** 기존 호환 alias */
export const FISH_SPECIES = SPECIES_REGISTRY

/* ── Pure helpers (TDD) ── */

/** id로 종 메타데이터를 조회한다. 없으면 throw. */
export function getSpecies(id: SpeciesId): FishSpecies {
  const found = SPECIES_REGISTRY.find((s) => s.id === id)
  if (!found) {
    throw new Error(`[speciesRegistry] Unknown species id: ${id}`)
  }
  return found
}

/** 시드 기반 결정적 종 선택. 해당 kind의 종 중에서. */
export function pickSpecies(seed: number, kind: FishKind): SpeciesId {
  const candidates = SPECIES_REGISTRY.filter((s) => s.kind === kind)
  const hash = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  const frac = hash - Math.floor(hash)
  const index = Math.floor(Math.abs(frac) * candidates.length) % candidates.length
  return candidates[index].id
}
