/**
 * 산호(coral) 형태·배치 순수 헬퍼.
 * 렌더링(지오메트리/셰이더/머티리얼)은 Aquascape가 담당하고, 여기는 결정적 계산만 둔다(TDD 대상).
 *
 * 두 생성기:
 * - generateBranchCoral: 재귀 분기 트리(가지 산호)의 세그먼트 스펙(start/end/radius)을 만든다.
 * - generateCoralClusters: 클러스터 배치 + 타입 믹스(branch/brain/fan) + 팔레트 인덱스를 만든다.
 *
 * 배치 원칙(spec §3.3/§0): 산호는 암반 주변(뒤쪽 z)에 클러스터로 모이고, 중앙 전면(물고기 유영
 * 볼륨)은 트여 있어야 한다 — z 뒤쪽 가중으로 깊이 분리해 "시선은 물고기에 집중" 원칙을 지킨다.
 */
import { mulberry32 } from './aquascapeHelpers'

export type Vec3 = [number, number, number]

/** 가지 산호 한 세그먼트: 시작/끝 좌표(단위공간)와 반경. 평탄 리스트로 반환된다. */
export interface BranchSpec {
  start: Vec3
  end: Vec3
  radius: number
}

/** generateBranchCoral 파라미터(테마 CORAL.branch에서 유래). */
export interface BranchCoralParams {
  /** 재귀 깊이(2~3 권장). 0이면 트렁크만. */
  depth: number
  /** 노드당 자식 수 범위 [min, max]. */
  childCount: [number, number]
  /** 부모 방향에서 벌어지는 최대 극각(라디안). */
  spreadAngle: number
  /** 레벨당 길이 감쇠 배율(0~1). */
  lengthDecay: number
  /** 레벨당 반경 감쇠 배율(0~1). */
  radiusDecay: number
}

export type CoralType = 'branch' | 'brain' | 'fan'

/** 산호 클러스터 하나의 배치·타입·색 인덱스. 렌더가 type에 따라 지오메트리를 생성한다. */
export interface ClusterSpec {
  x: number
  z: number
  type: CoralType
  /** 팔레트(주황/분홍/보라) 인덱스. */
  paletteIndex: number
  scale: number
  yaw: number
  /** 하위 생성(가지 트리·뇌 변위·부채 잎)용 결정적 서브시드. */
  seed: number
}

/* ── 가지 산호 단위공간 트렁크 상수 ──
 * 트렁크(depth 0)의 길이 1.0을 기준 단위로 삼고(렌더가 cluster.scale로 최종 크기 결정),
 * 반경은 길이 대비 비율로 둔다. 자식 세그먼트는 params.lengthDecay/radiusDecay로 감소한다.
 * (테마 튜닝 대상은 depth/childCount/spreadAngle/decay·팔레트·개수·area 쪽이라 config에 있고,
 *  이 두 값은 폼 정규화 상수라 여기 named const로 둔다 — caustics.ts 내부 상수와 동일한 성격.) */
const ROOT_LENGTH = 1.0
const ROOT_RADIUS = 0.16

/**
 * 단위벡터 dir를 그 주변으로 최대 spreadAngle 만큼 결정적으로 기울인 새 단위벡터를 만든다.
 * dir 주변 정규직교 기저(basisA/basisB)를 만들고, 극각 theta∈[0,spreadAngle]·방위각 phi∈[0,2π)를
 * rng로 뽑아 원뿔 안의 방향으로 회전한다(자식당 rng 정확히 2회 소비 — 결정성 안정화).
 */
function tiltDirection(dir: Vec3, spreadAngle: number, rng: () => number): Vec3 {
  const [dx, dy, dz] = dir
  // dir와 (거의) 평행하지 않은 보조축 up 선택
  const up: Vec3 = Math.abs(dy) < 0.99 ? [0, 1, 0] : [1, 0, 0]
  // basisA = normalize(up × dir)
  let ax = up[1] * dz - up[2] * dy
  let ay = up[2] * dx - up[0] * dz
  let az = up[0] * dy - up[1] * dx
  const aLen = Math.hypot(ax, ay, az) || 1
  ax /= aLen
  ay /= aLen
  az /= aLen
  // basisB = dir × basisA (이미 단위·직교)
  const bx = dy * az - dz * ay
  const by = dz * ax - dx * az
  const bz = dx * ay - dy * ax

  const theta = rng() * spreadAngle
  const phi = rng() * Math.PI * 2
  const st = Math.sin(theta)
  const ct = Math.cos(theta)
  const cp = Math.cos(phi)
  const sp = Math.sin(phi)

  const nx = dx * ct + (ax * cp + bx * sp) * st
  const ny = dy * ct + (ay * cp + by * sp) * st
  const nz = dz * ct + (az * cp + bz * sp) * st
  const nLen = Math.hypot(nx, ny, nz) || 1
  return [nx / nLen, ny / nLen, nz / nLen]
}

/**
 * 재귀 분기로 가지 산호 세그먼트(BranchSpec) 평탄 리스트를 생성한다.
 *
 * 불변식(테스트 가드):
 * - 같은 시드·파라미터 → 완전 동일한 출력(결정적, `Math.random` 미사용).
 * - 자식의 start === 부모의 end(연결성; 같은 배열 참조를 공유).
 * - radius·세그먼트 길이가 깊이에 따라 단조 감소(레벨당 radiusDecay/lengthDecay 배).
 * - 총 분기 수가 childCount 범위·depth 공식(Σ child^L) 안.
 */
export function generateBranchCoral(seed: number, params: BranchCoralParams): BranchSpec[] {
  const rng = mulberry32(seed)
  const [minChild, maxChild] = params.childCount
  const span = Math.max(0, maxChild - minChild)
  const branches: BranchSpec[] = []

  const grow = (start: Vec3, dir: Vec3, length: number, radius: number, level: number): void => {
    const end: Vec3 = [
      start[0] + dir[0] * length,
      start[1] + dir[1] * length,
      start[2] + dir[2] * length,
    ]
    // 자식의 start로 end 배열을 그대로 넘겨 참조·값 모두 일치시킨다(연결성 불변식).
    branches.push({ start, end, radius })
    if (level >= params.depth) return

    const childCount = span <= 0 ? minChild : minChild + Math.floor(rng() * (span + 1))
    for (let c = 0; c < childCount; c++) {
      const childDir = tiltDirection(dir, params.spreadAngle, rng)
      grow(end, childDir, length * params.lengthDecay, radius * params.radiusDecay, level + 1)
    }
  }

  grow([0, 0, 0], [0, 1, 0], ROOT_LENGTH, ROOT_RADIUS, 0)
  return branches
}

/* ── 클러스터 배치 상수 ── */
const CORAL_TYPES: readonly CoralType[] = ['branch', 'brain', 'fan']
/** 팔레트(주황/분홍/보라) 색 수 — config CORAL.palette 길이와 일치시켜 둔다. */
const PALETTE_COUNT = 3
/** z 뒤쪽(minZ) 가중 지수(>1이면 뒤쪽 집중). 중앙 전면 물고기 시야를 깊이로 비운다. */
const CLUSTER_BACK_BIAS = 1.5
/** 클러스터 스케일 변주 범위(렌더가 이 값을 곱해 최종 크기 결정). */
const CLUSTER_MIN_SCALE = 0.82
const CLUSTER_MAX_SCALE = 1.28

/**
 * 산호 클러스터 배치를 결정적으로 생성한다.
 *
 * - type: CORAL_TYPES를 라운드로빈으로 배정 → count≥3이면 3종(가지·뇌·부채)이 반드시 등장.
 * - x: 스트라타(area 폭 count 등분) 내 지터 — 클러스터가 한쪽에 몰리지 않고 항상 좌우로
 *   고르게 퍼진다(균일 랜덤은 시드에 따라 한쪽 몰림이 났었다 — 캡처 루프에서 확인).
 * - z: 뒤쪽(minZ) 가중 — 암반이 있는 뒤쪽에 모여 중앙 전면(물고기 유영)을 비운다.
 * - paletteIndex: 처음 3개는 시드 회전 순열(3색 모두 등장 보장 — 균일 랜덤은 보라 편중이
 *   났었다), 이후는 랜덤. scale/yaw/seed: 인스턴스별 변주(인스턴스당 rng 소비 횟수 고정).
 */
export function generateCoralClusters(
  seed: number,
  count: number,
  area: { minX: number; maxX: number; minZ: number; maxZ: number },
): ClusterSpec[] {
  if (count <= 0) return []

  const rng = mulberry32(seed)
  const TWO_PI = Math.PI * 2
  const out: ClusterSpec[] = []
  const stratumW = (area.maxX - area.minX) / count
  const paletteRotation = Math.floor(rng() * PALETTE_COUNT)

  for (let i = 0; i < count; i++) {
    const xU = rng()
    const zU = rng()
    const scaleU = rng()
    const yaw = rng() * TWO_PI * 0.9999 // keep < 2π (수초/다시마 생성기와 동일 규약)
    const paletteU = rng()
    const paletteIndex =
      i < PALETTE_COUNT
        ? (i + paletteRotation) % PALETTE_COUNT
        : Math.floor(paletteU * PALETTE_COUNT)
    const subSeed = Math.floor(rng() * 1_000_000_000)

    const x = area.minX + (i + xU) * stratumW
    const z = area.minZ + (area.maxZ - area.minZ) * Math.pow(zU, CLUSTER_BACK_BIAS)
    const scale = CLUSTER_MIN_SCALE + scaleU * (CLUSTER_MAX_SCALE - CLUSTER_MIN_SCALE)
    const type = CORAL_TYPES[i % CORAL_TYPES.length]

    out.push({ x, z, type, paletteIndex, scale, yaw, seed: subSeed })
  }

  return out
}
