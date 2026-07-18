/**
 * 다시마(kelp) 배치·형태 순수 헬퍼.
 * 렌더링(지오메트리/셰이더)은 Aquascape가 담당하고, 여기는 결정적 계산만 둔다(TDD 대상).
 *
 * 배치 원칙(spec §1): 좌우 가장자리·뒤쪽 z에 집중, 중앙 밀도 낮게 —
 * "시선은 물고기에 집중" 원칙을 지키기 위해 중앙(|x| < centerGap)의 배치 확률을 폴오프한다.
 */
import { mulberry32 } from './aquascapeHelpers'

export interface KelpParams {
  minHeight: number
  maxHeight: number
  minScale: number
  maxScale: number
  baseColor: [number, number, number]
  tipColor: [number, number, number]
  colorVariation: number
  /** |x| < centerGap 를 중앙(트임) 영역으로 본다 */
  centerGap: number
  /** 중앙 영역에 배치될 확률(0~1). 낮을수록 가장자리 집중 */
  centerProbability: number
  /** z 뒤쪽(minZ) 가중 지수. 1=균일, 클수록 뒤쪽 집중 */
  backBias: number
}

/**
 * 군락(포기) 배치 파라미터. 낱장 대신 "한 홀드패스트에서 여러 가닥이 솟는" 다발을 배치할 때
 * KelpParams(가닥 형태·색·폴오프)에 포기 구조를 더한다(spec §1).
 */
export interface KelpClusterParams extends KelpParams {
  /** 홀드패스트(포기)당 가닥 수 [min, max] (정수, 포함) */
  bladesPerCluster: [number, number]
  /** 가닥이 홀드패스트 중심에서 흩어지는 최대 반경(월드 유닛) */
  clusterRadius: number
}

export interface KelpInstance {
  x: number
  z: number
  yaw: number
  height: number
  scale: number
  phase: number
  baseColor: [number, number, number]
  tipColor: [number, number, number]
}

/** [lo, hi] 클램프. */
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/**
 * 가장자리 가중 x 좌표. centerProbability 확률로만 중앙(|x| < centerGap)에 두고, 나머지는
 * 좌/우 가장자리 구간에 폭 비례로 배치한다. rng 값(zonePick, posU)을 인자로 받아(직접 rng를
 * 소비하지 않아) 호출부의 rng 소비 순서를 결정적으로 유지한다.
 */
function edgeWeightedX(
  zonePick: number,
  posU: number,
  area: { minX: number; maxX: number },
  centerGap: number,
  centerProbability: number,
): number {
  const leftMin = area.minX
  const leftMax = Math.min(area.maxX, -centerGap)
  const leftW = Math.max(0, leftMax - leftMin)
  const rightMin = Math.max(area.minX, centerGap)
  const rightW = Math.max(0, area.maxX - rightMin)
  const edgeW = leftW + rightW
  const centerMin = Math.max(area.minX, -centerGap)
  const centerMax = Math.min(area.maxX, centerGap)
  const centerW = Math.max(0, centerMax - centerMin)

  const useCenter = edgeW <= 0 || (centerW > 0 && zonePick < centerProbability)
  if (useCenter) return centerMin + posU * centerW
  const t = posU * edgeW
  return t < leftW ? leftMin + t : rightMin + (t - leftW)
}

/** 뒤쪽(minZ) 가중 z: pow(u, backBias). backBias=1이면 균일, 클수록 뒤쪽 집중. */
function backBiasedZ(zU: number, area: { minZ: number; maxZ: number }, backBias: number): number {
  return area.minZ + (area.maxZ - area.minZ) * Math.pow(zU, backBias)
}

/**
 * 결정적 시드 기반 다시마 인스턴스 배치 생성.
 * 같은 시드·파라미터면 항상 같은 결과(인스턴스당 rng 소비 횟수도 고정).
 *
 * - x: 가장자리 가중 — centerProbability 확률로만 중앙(|x| < centerGap)에 배치하고,
 *   나머지는 좌/우 가장자리 구간에 폭 비례로 배치한다.
 * - z: 뒤쪽 가중 — pow(u, backBias)로 minZ(뒤) 쪽으로 치우친 분포.
 */
export function generateKelpInstances(
  seed: number,
  count: number,
  area: { minX: number; maxX: number; minZ: number; maxZ: number },
  params: KelpParams,
): KelpInstance[] {
  if (count <= 0) return []

  const rng = mulberry32(seed)
  const TWO_PI = Math.PI * 2
  const instances: KelpInstance[] = []

  for (let i = 0; i < count; i++) {
    // 분기와 무관하게 인스턴스당 rng 소비 횟수를 고정(결정성 안정화)
    const zonePick = rng()
    const posU = rng()
    const zU = rng()
    const yaw = rng() * TWO_PI * 0.9999 // keep < 2π (수초 생성기와 동일 규약)
    const height = params.minHeight + rng() * (params.maxHeight - params.minHeight)
    const scale = params.minScale + rng() * (params.maxScale - params.minScale)
    const phase = rng() * TWO_PI * 0.9999

    const cv = params.colorVariation
    const baseColor: [number, number, number] = [
      params.baseColor[0] + (rng() - 0.5) * cv,
      params.baseColor[1] + (rng() - 0.5) * cv,
      params.baseColor[2] + (rng() - 0.5) * cv,
    ]
    const tipColor: [number, number, number] = [
      params.tipColor[0] + (rng() - 0.5) * cv,
      params.tipColor[1] + (rng() - 0.5) * cv,
      params.tipColor[2] + (rng() - 0.5) * cv,
    ]

    const x = edgeWeightedX(zonePick, posU, area, params.centerGap, params.centerProbability)
    const z = backBiasedZ(zU, area, params.backBias)

    instances.push({ x, z, yaw, height, scale, phase, baseColor, tipColor })
  }

  return instances
}

/**
 * 결정적 시드 기반 다시마 **군락(포기)** 배치 생성(spec §1). 낱장 리본 대신 한 홀드패스트에서
 * bladesPerCluster개 가닥이 clusterRadius 내로 솟는 다발을 clusterCount개 배치한다 →
 * "가닥"이 아니라 "포기"가 배치 단위가 되어 밀도·부피감이 올라간다.
 *
 * - 홀드패스트 위치: generateKelpInstances와 동일한 가장자리 가중 x + 뒤쪽 가중 z(좌우 충전·중앙
 *   통로·원근 레이어 규약 공유). backBias로 앞/뒤 열이 섞여 원근 레이어가 생긴다.
 * - 가닥: 홀드패스트 주변 반경 clusterRadius 내 분산 + 높이/스케일/위상/색 개별 변주. area로 클램프.
 *
 * 반환은 KelpInstance[] 평탄 배열(가닥 단위)이라 Aquascape 인스턴싱 경로는 그대로 재사용된다.
 * 클러스터 단위로 순차 방출하므로 [k·i, k·i+k) 구간이 한 포기다.
 */
export function generateKelpClusters(
  seed: number,
  clusterCount: number,
  area: { minX: number; maxX: number; minZ: number; maxZ: number },
  params: KelpClusterParams,
): KelpInstance[] {
  if (clusterCount <= 0) return []

  const rng = mulberry32(seed)
  const TWO_PI = Math.PI * 2
  const instances: KelpInstance[] = []
  const [bpcMin, bpcMax] = params.bladesPerCluster
  const bpcSpan = Math.max(0, bpcMax - bpcMin)

  for (let ci = 0; ci < clusterCount; ci++) {
    // 홀드패스트(포기 뿌리) 위치 — 낱장 배치와 동일한 가장자리·뒤쪽 가중.
    const zonePick = rng()
    const posU = rng()
    const zU = rng()
    const hx = edgeWeightedX(zonePick, posU, area, params.centerGap, params.centerProbability)
    const hz = backBiasedZ(zU, area, params.backBias)

    // 포기당 가닥 수(정수, [bpcMin, bpcMax] 포함).
    const nBlades = bpcMin + Math.round(rng() * bpcSpan)

    for (let b = 0; b < nBlades; b++) {
      // 가닥별 rng 소비 횟수 고정(결정성). 홀드패스트 주변 분산 + 개별 형태 변주.
      const angle = rng() * TWO_PI
      const dist = rng() * params.clusterRadius
      const yaw = rng() * TWO_PI * 0.9999
      const height = params.minHeight + rng() * (params.maxHeight - params.minHeight)
      const scale = params.minScale + rng() * (params.maxScale - params.minScale)
      const phase = rng() * TWO_PI * 0.9999

      const cv = params.colorVariation
      const baseColor: [number, number, number] = [
        params.baseColor[0] + (rng() - 0.5) * cv,
        params.baseColor[1] + (rng() - 0.5) * cv,
        params.baseColor[2] + (rng() - 0.5) * cv,
      ]
      const tipColor: [number, number, number] = [
        params.tipColor[0] + (rng() - 0.5) * cv,
        params.tipColor[1] + (rng() - 0.5) * cv,
        params.tipColor[2] + (rng() - 0.5) * cv,
      ]

      // 홀드패스트 주변 분산 후 area로 클램프(경계 밖으로 새지 않게). 클램프는 포기 내 가닥 간
      // 거리를 줄일 뿐 늘리지 않아 "2×clusterRadius 응집" 불변식을 깨지 않는다.
      const x = clamp(hx + Math.cos(angle) * dist, area.minX, area.maxX)
      const z = clamp(hz + Math.sin(angle) * dist, area.minZ, area.maxZ)

      instances.push({ x, z, yaw, height, scale, phase, baseColor, tipColor })
    }
  }

  return instances
}

/**
 * 다시마 리본의 높이별 반폭: 뿌리(h01=0)=baseHalfWidth → 팁(h01=1)=baseHalfWidth×tipRatio
 * 로 단조 감소한다. h01은 [0,1]로 클램프.
 */
export function kelpTaperHalfWidth(h01: number, baseHalfWidth: number, tipRatio: number): number {
  const t = Math.max(0, Math.min(1, h01))
  return baseHalfWidth * (1 - (1 - tipRatio) * t)
}
