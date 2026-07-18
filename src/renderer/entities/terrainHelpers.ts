/**
 * 지형(모래바닥 heightfield) 순수 헬퍼.
 *
 * 테마별로 평평한 모래를 "울퉁불퉁한 암반 기복"(다시마 숲)이나 "솟아오른 리프 마운드"
 * (산호초)로 차별화하기 위한 결정적 높이장 계산만 둔다. 렌더링(PlaneGeometry 버텍스 변위·
 * 노멀 재계산·버텍스 컬러)은 Aquascape가 담당하고, 여기는 순수 계산만 둔다(TDD 대상).
 *
 * 좌표계: 입력 (x, z)는 **월드 좌표**다(모래 메시 오프셋을 제거한 값). 산호 클러스터·하드스케이프
 * 배치가 모두 월드 좌표라, 마운드 위치·frontFlatZ·새우 크롤러 존이 한 좌표계로 일관되게 맞물린다.
 *
 * 경계 제약(CLAUDE.md 렌더링 함정 + 새우 크롤러 보호):
 *   ⓐ 가장자리 페이드: |x| > edgeTaperStart에서 0으로 smoothstep 감쇠(모래 평면 먼 가장자리의
 *      알파 페이드/실루엣을 보존 — 하드컷 수평선 아티팩트 재발 방지).
 *   ⓑ 앞쪽 평탄 존: z > frontFlatZ(월드, 기본 −1.5)는 변위 0(새우 크롤러가 sandY 평면 기준으로
 *      기어다니므로 전면 근접 대역은 완전히 평평 — 클리핑 방지).
 *   ⓒ 최고점 상한: 반환값 ≤ maxHeight. 지형은 FISH.bounds.minY 위로 솟을 수 있고(마운드 융기)
 *      물고기가 로컬 바닥(아래 localFloorY: 표면+여유고) 기준으로 동적으로 회피한다(Fish.update의
 *      소프트 조향+하드 클램프). 상한의 역할은 "수면 여유" 가드로 바뀌었다 — sandY + maxHeight +
 *      TERRAIN_AVOID.clearance가 수면(maxY) 아래 minHeadroom을 남기도록 authoring
 *      (terrainHelpers.test config 무결성 가드).
 *   ⓓ 결정적: 같은 입력 → 같은 출력. Math.random 미사용(위치 기반 연속 사인 노이즈).
 */

/** feature 마운드(smoothstep 감쇠 언덕) 하나. (x, z)는 월드 중심, radius 안에서 height까지 솟음. */
export interface TerrainMound {
  readonly x: number
  readonly z: number
  readonly radius: number
  readonly height: number
}

/** sandHeightAt에 전달할 지형 구성(테마별). config.ts THEME.themes[].terrain에서 유래한다. */
export interface SandTerrainConfig {
  /** 저주파 기복 진폭(월드 유닛, ±amp). */
  readonly rollAmplitude: number
  /** 저주파 기복 주파수 스케일(클수록 잔 기복). */
  readonly rollScale: number
  /** feature 마운드 목록(리프 덩어리 등). 비어 있으면 기복만. */
  readonly mounds: readonly TerrainMound[]
  /** 가장자리 페이드 시작 |x|(이 안쪽은 감쇠 없음). */
  readonly edgeTaperStart: number
  /** 가장자리 페이드 종료 |x|(이 바깥은 변위 0). edgeTaperStart보다 커야 한다. */
  readonly edgeTaperEnd: number
  /** 앞쪽 평탄 존 경계 z(이보다 크면=앞쪽이면 변위 0). */
  readonly frontFlatZ: number
  /** 평탄 존→전개 존 전환 폭(z, frontFlatZ에서 뒤로 이만큼에 걸쳐 0→1 램프). */
  readonly frontTaperWidth: number
  /** 반환 높이 상한(월드 유닛). 물고기 클리핑 방지 가드. */
  readonly maxHeight: number
}

/** Hermite smoothstep. edge0>edge1도 허용(역방향 램프). edge0==edge1이면 계단. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1
  let t = (x - edge0) / (edge1 - edge0)
  if (t < 0) t = 0
  else if (t > 1) t = 1
  return t * t * (3 - 2 * t)
}

/**
 * 위치 기반 연속 사인 노이즈(2옥타브). 반환 범위 [-1, 1], 결정적(Math.random 미사용).
 * 기존 _buildSand의 버텍스 컬러 노이즈와 같은 성격의 저주파 기복 — 위치의 매끈한 함수라
 * 인접 버텍스 간 급변이 없어(각지지 않음) computeVertexNormals와 잘 맞는다.
 */
function terrainRollNoise(x: number, z: number, scale: number): number {
  const a = Math.sin(x * scale + z * scale * 0.7) * 0.6
  const b = Math.sin(x * scale * 2.3 - z * scale * 1.7) * 0.4
  return a + b
}

/**
 * 월드 (x, z)에서의 모래바닥 높이(sandY 기준 상대 변위, 월드 유닛)를 계산한다.
 * 저주파 기복 + 마운드 언덕을 합성한 뒤 가장자리/앞쪽 경계 제약과 최고점 상한을 적용한다.
 * @returns sandY에 더할 상대 높이. 0=평면 그대로, 양수=솟음, 음수=꺼짐. 항상 ≤ cfg.maxHeight.
 */
export function sandHeightAt(x: number, z: number, cfg: SandTerrainConfig): number {
  // 저주파 기복(±rollAmplitude)
  let raw = terrainRollNoise(x, z, cfg.rollScale) * cfg.rollAmplitude

  // feature 마운드(각 중심에서 radius까지 smoothstep 감쇠 언덕) 합성
  for (const m of cfg.mounds) {
    const dx = x - m.x
    const dz = z - m.z
    const d = Math.sqrt(dx * dx + dz * dz)
    if (d >= m.radius) continue
    const t = 1 - d / m.radius // 1=중심, 0=가장자리
    const falloff = t * t * (3 - 2 * t)
    raw += m.height * falloff
  }

  // ⓐ 가장자리 페이드: |x|가 커지면 0으로 감쇠(먼 가장자리 알파 페이드 보존)
  const edgeFactor = 1 - smoothstep(cfg.edgeTaperStart, cfg.edgeTaperEnd, Math.abs(x))
  if (edgeFactor <= 0) return 0 // 경계 밖 — 정확히 +0 반환(음수×0=−0 방지)
  // ⓑ 앞쪽 평탄 존: z > frontFlatZ면 0. frontFlatZ에서 뒤로 frontTaperWidth에 걸쳐 0→1.
  const frontFactor = smoothstep(cfg.frontFlatZ, cfg.frontFlatZ - cfg.frontTaperWidth, z)
  if (frontFactor <= 0) return 0 // 앞쪽 평탄 존 — 정확히 +0 반환

  let h = raw * edgeFactor * frontFactor

  // ⓒ 최고점 상한(수면 여유 가드). 아래쪽(꺼짐)은 제한하지 않는다(계곡은 무해).
  if (h > cfg.maxHeight) h = cfg.maxHeight

  return h
}

/* ── 물고기 지형 회피 헬퍼 (Fish.update가 소비, TDD 대상) ──
 * 지형이 물고기 유영 공간으로 융기할 수 있게 되면서, "평평한 bounds.minY 바닥" 가정을
 * "위치별 로컬 바닥"으로 일반화한다. 회피는 2층: ①소프트 — 전방 예측 상승 조향
 * (terrainClimbForce) + 경사 수평 우회(terrainDeflectXZ)로 자연스럽게 피해 다니고,
 * ②하드 — 통합 후 localFloorY로 y를 클램프해 관통을 원천 차단한다. */

/**
 * 월드 (x, z)에서의 로컬 바닥 y(하드 클램프·조향 기준).
 * 지형 표면(sandY + h) + 여유고(clearance)와 기본 바닥(boundsMinY) 중 높은 쪽.
 * terrain이 null(미니멀 테마)이면 기본 바닥 그대로 — 기존 거동 하위호환.
 * crawler(새우)는 clearance 0으로 호출해 표면에 얹혀 다닌다.
 */
export function localFloorY(
  x: number,
  z: number,
  terrain: SandTerrainConfig | null,
  sandY: number,
  boundsMinY: number,
  clearance: number,
): number {
  if (!terrain) return boundsMinY
  const surface = sandY + sandHeightAt(x, z, terrain) + clearance
  return surface > boundsMinY ? surface : boundsMinY
}

/**
 * 진행 방향(수평 속도)으로 lookAheadSec만큼 전진한 예측 지점.
 * 예측 거리는 maxDist로 상한한다(놀래키기 가속 시 과예측으로 인한 요동 방지).
 */
export function lookAheadPoint(
  px: number,
  pz: number,
  vx: number,
  vz: number,
  lookAheadSec: number,
  maxDist: number,
): { x: number; z: number } {
  let dx = vx * lookAheadSec
  let dz = vz * lookAheadSec
  const d = Math.sqrt(dx * dx + dz * dz)
  if (d > maxDist && d > 0) {
    const s = maxDist / d
    dx *= s
    dz *= s
  }
  return { x: px + dx, z: pz + dz }
}

/**
 * 지형 상승 조향력(+y). 현재·전방 로컬 바닥 중 높은 쪽을 기준으로, 그 위 margin 여유
 * 안으로 들어오면 부족분에 비례해 위로 민다(경계회피 BOUNDARY_TURN_FORCE와 같은 램프 꼴).
 * 전방 바닥을 함께 보므로 경사를 만나기 전에 선제적으로 완만하게 상승한다.
 * 바닥 아래로 파고든 예외 상황에서도 strength × capFactor를 넘지 않는다(폭주 방지).
 */
export function terrainClimbForce(
  y: number,
  floorNow: number,
  floorAhead: number,
  margin: number,
  strength: number,
  capFactor: number,
): number {
  if (margin <= 0) return 0
  const floor = floorNow > floorAhead ? floorNow : floorAhead
  const t = 1 - (y - floor) / margin // floor+margin에서 0, floor에서 1, 그 아래 >1
  if (t <= 0) return 0
  const f = strength * t
  const cap = strength * capFactor
  return f > cap ? cap : f
}

/**
 * 경사 수평 우회 조향(x, z). 지형 기울기(중심차분)의 반대 = 내리막 방향으로 밀어,
 * 물고기가 마운드를 항상 타넘는 대신 옆으로 돌아가는 경로도 갖게 한다.
 * 로컬 바닥 위 margin 여유 밖(충분히 높음)이면 0. 평지(기울기 0)에서도 0.
 */
export function terrainDeflectXZ(
  x: number,
  z: number,
  terrain: SandTerrainConfig,
  y: number,
  sandY: number,
  clearance: number,
  margin: number,
  eps: number,
  strength: number,
): { x: number; z: number } {
  if (margin <= 0 || eps <= 0) return { x: 0, z: 0 }
  const floor = sandY + sandHeightAt(x, z, terrain) + clearance
  let t = 1 - (y - floor) / margin
  if (t <= 0) return { x: 0, z: 0 }
  if (t > 1) t = 1
  const gx = (sandHeightAt(x + eps, z, terrain) - sandHeightAt(x - eps, z, terrain)) / (2 * eps)
  const gz = (sandHeightAt(x, z + eps, terrain) - sandHeightAt(x, z - eps, terrain)) / (2 * eps)
  return { x: -gx * strength * t, z: -gz * strength * t }
}
