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
    dialogue: [
      '무리 속에 있어도 나는 나예요.',
      '작은 빛 하나가 깊은 물을 밝힙니다.',
      '나란히 헤엄치는 건, 혼자가 아니라는 증거예요.',
      '같은 방향으로 흐르는 것도 용기입니다.',
      '반짝이는 건 크기가 아니라 존재 자체예요.',
      '물결 따라 흔들려도 괜찮아요, 우리 함께니까.',
      '가장 작은 물고기도 강을 거슬러 올라갑니다.',
      '빛나는 건 잠깐이어도 기억은 오래 남아요.',
      '옆에 있는 친구가 가장 큰 위로가 됩니다.',
      '조용히 함께 흐르는 시간이 가장 평화로워요.',
    ],
  },
  {
    id: 'tetra-b',
    file: tetraBUrl,
    kind: 'schooling',
    baseScale: 0.58,
    swimSpeed: 1.3,
    displayName: '네온테트라 B',
    dialogue: [
      '서로의 리듬에 맞춰 헤엄치는 법을 배웠어요.',
      '무리의 끝에서도 전체가 보입니다.',
      '같은 물속이라도 느끼는 온도는 각자 달라요.',
      '가끔은 뒤처져도 괜찮아요, 결국 만나니까.',
      '작은 꼬리짓 하나로도 방향이 바뀌곤 해요.',
      '함께라서 두렵지 않은 어둠이 있어요.',
      '물빛 사이로 스치는 순간이 가장 아름다워요.',
      '누군가의 곁에 있는 것만으로 충분할 때가 있어요.',
      '빠르게 헤엄칠수록 고요함이 그리워져요.',
      '모두가 같은 곳을 향해도 풍경은 각자 달라요.',
    ],
  },
  {
    id: 'clownfish',
    file: clownfishUrl,
    kind: 'individual',
    baseScale: 0.85,
    swimSpeed: 0.8,
    displayName: '흰동가리',
    dialogue: [
      '산호 사이에서도 나만의 자리를 찾았어요.',
      '함께 흔들리는 것도 쉼이 됩니다.',
      '말미잘은 집이고, 집은 안식이에요.',
      '작은 보금자리 하나면 세상이 충분해요.',
      '지키고 싶은 것이 있으면 용감해질 수 있어요.',
      '파도가 거세도 뿌리 내린 곳은 흔들리지 않아요.',
      '돌아갈 곳이 있는 건 큰 행복이에요.',
      '오늘도 말미잘 곁에서 하루가 조용히 지나갑니다.',
      '세상이 넓어도 내 자리가 가장 편안해요.',
      '누군가를 지킨다는 건 나도 지켜진다는 뜻이에요.',
    ],
  },
  {
    id: 'butterflyfish',
    file: butterflyfishUrl,
    kind: 'individual',
    baseScale: 0.9,
    swimSpeed: 0.7,
    displayName: '나비고기',
    dialogue: [
      '우아하게 헤엄치는 비결은, 서두르지 않는 거예요.',
      '물속에도 나비가 날 수 있어요.',
      '천천히 돌아가는 길이 더 많은 것을 보여줍니다.',
      '아름다운 무늬는 시간이 빚어낸 거예요.',
      '산호초 사이를 누비는 건 작은 모험이에요.',
      '느린 유영 속에 깊은 생각이 흐르고 있어요.',
      '가볍게 떠 있는 것도 하나의 기술입니다.',
      '물결이 나를 밀어도, 내 방향은 내가 정해요.',
      '조용한 바다 밑에도 수많은 이야기가 있어요.',
      '지나온 산호마다 다른 색이었어요.',
    ],
  },
  {
    id: 'lionfish',
    file: lionfishUrl,
    kind: 'individual',
    baseScale: 0.95,
    swimSpeed: 0.6,
    displayName: '쏠배감펭',
    dialogue: [
      '화려함 뒤에도 고요한 마음이 있습니다.',
      '천천히, 그러나 확실하게 나아갑니다.',
      '가시는 나를 지키는 것이지, 남을 해치려는 게 아니에요.',
      '혼자만의 시간이 가장 깊은 평화를 줍니다.',
      '강한 것은 힘이 아니라 흔들리지 않는 마음이에요.',
      '어둠 속에서도 나만의 빛을 품고 있어요.',
      '서두르지 않아도 도착할 곳에 도착합니다.',
      '넓은 바다 한가운데, 나는 고요히 떠 있어요.',
      '겉모습이 전부가 아니라는 걸 알아주세요.',
      '느리게 사는 것도 하나의 용기입니다.',
    ],
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
