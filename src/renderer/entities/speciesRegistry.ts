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
import mantaUrl from '../assets/fish/manta.glb?url'
import whaleUrl from '../assets/fish/whale.glb?url'
import dolphinUrl from '../assets/fish/dolphin.glb?url'
import sharkUrl from '../assets/fish/shark.glb?url'

/* ── Types ── */

export type SpeciesId =
  | 'clownfish'
  | 'butterflyfish'
  | 'lionfish'
  | 'tetra-a'
  | 'tetra-b'
  | 'manta'
  | 'whale'
  | 'dolphin'
  | 'shark'

export interface FishSpecies {
  id: SpeciesId
  file: string
  kind: FishKind
  /** ambient: 앰비언트 풀(개체수 슬라이더), feature: 특별 개체(종별 토글) */
  category: 'ambient' | 'feature'
  baseScale: number
  swimSpeed: number
  /** 한국어 표시명 (UI·대사에서 사용) */
  displayName: string
  /** 어종별 대사 목록 (>=10개) */
  dialogue: readonly string[]
}

/* ── Registry ── */

export const SPECIES_REGISTRY: readonly FishSpecies[] = [
  {
    id: 'tetra-a',
    file: tetraAUrl,
    kind: 'schooling',
    category: 'ambient',
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
    category: 'ambient',
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
    category: 'ambient',
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
    category: 'ambient',
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
    category: 'ambient',
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

  /* ── feature 종 (특별 개체, 앰비언트 풀에 섞이지 않음) ── */

  {
    id: 'manta',
    file: mantaUrl,
    kind: 'individual',
    category: 'feature',
    baseScale: 1.4,
    swimSpeed: 0.45,
    displayName: '만타가오리',
    dialogue: [
      '넓은 날개를 펼치면, 바다 전체가 품에 안기는 것 같아요.',
      '천천히 날갯짓하는 것만으로도 멀리 갈 수 있습니다.',
      '깊은 바다의 고요함 속에서 나는 자유를 배웠어요.',
      '큰 몸을 가볍게 움직이는 비결은 힘을 빼는 거예요.',
      '물살에 몸을 맡기면, 바다가 길을 알려줍니다.',
      '하늘을 나는 것처럼 헤엄치는 이 순간이 좋아요.',
      '서두르지 않아도 물결은 항상 앞으로 흘러가요.',
      '넓은 바다를 품은 만큼, 마음도 넓어지는 것 같아요.',
      '고요히 떠 있는 것도 하나의 여행입니다.',
      '날개 끝에 닿는 물의 온도가 오늘의 인사예요.',
    ],
  },
  {
    id: 'whale',
    file: whaleUrl,
    kind: 'individual',
    category: 'feature',
    baseScale: 1.8,
    swimSpeed: 0.35,
    displayName: '고래',
    dialogue: [
      '깊이 잠수할수록, 세상은 더 고요해집니다.',
      '먼 바다를 건너온 기억이 오늘의 나를 만들었어요.',
      '큰 몸이지만, 가장 작은 물결도 느낄 수 있어요.',
      '천천히 숨을 쉬는 것, 그것이 살아있다는 증거입니다.',
      '혼자 헤엄쳐도 외롭지 않아요. 바다가 함께하니까.',
      '오랜 여정 끝에 만나는 고요함이 가장 큰 선물이에요.',
      '세상의 모든 바다는 결국 하나로 이어져 있습니다.',
      '깊은 곳에서 올려다보는 수면의 빛이 참 아름다워요.',
      '느리게 가도 괜찮아요. 도착하지 못할 곳은 없으니까.',
      '이 넓은 바다에서 당신을 만난 건 작은 기적이에요.',
    ],
  },
  {
    id: 'dolphin',
    file: dolphinUrl,
    kind: 'individual',
    category: 'feature',
    baseScale: 1.1,
    swimSpeed: 0.7,
    displayName: '돌고래',
    dialogue: [
      '같이 놀래요! 물 위로 뛰어오르는 건 정말 신나요.',
      '웃는 것처럼 보이나요? 정말로 웃고 있는 거예요.',
      '파도를 타는 건 혼자보다 함께가 더 재미있어요.',
      '오늘 기분이 어때요? 저는 항상 즐거워요.',
      '수면 위로 뛰어오르면, 잠깐이지만 하늘을 날 수 있어요.',
      '친구들과 나란히 헤엄치는 이 순간이 행복이에요.',
      '놀이가 곧 삶이고, 삶이 곧 놀이예요.',
      '당신이 웃으면 바다도 더 반짝이는 것 같아요.',
      '어려운 일이 있어도 한 번 뛰어오르면 괜찮아져요.',
      '매일이 새로운 모험의 시작이에요!',
    ],
  },
  {
    id: 'shark',
    file: sharkUrl,
    kind: 'individual',
    category: 'feature',
    baseScale: 1.3,
    swimSpeed: 0.6,
    displayName: '상어',
    dialogue: [
      '멈추지 않는 것, 그것이 내가 살아가는 방식입니다.',
      '강한 것은 이빨이 아니라 앞으로 나아가는 의지예요.',
      '혼자 헤엄치는 시간이 나를 단단하게 만들어요.',
      '깊은 바다의 어둠 속에서도 길을 잃지 않습니다.',
      '고요하게 흐르는 물살 위에 나만의 길이 있어요.',
      '겉모습과 달리, 저도 평화로운 바다를 좋아해요.',
      '오래 헤엄칠수록 바다의 깊은 뜻을 알게 됩니다.',
      '두려움 없이 나아가는 건, 용기가 아니라 습관이에요.',
      '넓은 바다를 홀로 누비는 것도 나쁘지 않아요.',
      '거친 파도 너머에 항상 잔잔한 바다가 기다리고 있어요.',
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

/** 시드 기반 결정적 종 선택. ambient 카테고리의 해당 kind 종 중에서. */
export function pickSpecies(seed: number, kind: FishKind): SpeciesId {
  const candidates = SPECIES_REGISTRY.filter((s) => s.kind === kind && s.category === 'ambient')
  const hash = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  const frac = hash - Math.floor(hash)
  const index = Math.floor(Math.abs(frac) * candidates.length) % candidates.length
  return candidates[index].id
}
