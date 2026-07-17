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

  // 중앙/가장자리 구간(영역과 교집합, 폭 0 이상으로 클램프)
  const leftMin = area.minX
  const leftMax = Math.min(area.maxX, -params.centerGap)
  const leftW = Math.max(0, leftMax - leftMin)
  const rightMin = Math.max(area.minX, params.centerGap)
  const rightW = Math.max(0, area.maxX - rightMin)
  const edgeW = leftW + rightW
  const centerMin = Math.max(area.minX, -params.centerGap)
  const centerMax = Math.min(area.maxX, params.centerGap)
  const centerW = Math.max(0, centerMax - centerMin)

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

    // x: 가장자리 가중(중앙 폴오프). 가장자리 구간이 없으면 중앙 폴백.
    const useCenter = edgeW <= 0 || (centerW > 0 && zonePick < params.centerProbability)
    let x: number
    if (useCenter) {
      x = centerMin + posU * centerW
    } else {
      const t = posU * edgeW
      x = t < leftW ? leftMin + t : rightMin + (t - leftW)
    }

    // z: 뒤쪽(minZ) 가중
    const z = area.minZ + (area.maxZ - area.minZ) * Math.pow(zU, params.backBias)

    instances.push({ x, z, yaw, height, scale, phase, baseColor, tipColor })
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
