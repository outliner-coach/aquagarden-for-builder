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

/**
 * 산호 타입. 'mound'(뭉게 nub 마운드, step2 신설)가 리프 피복의 주역이고 branch/brain/fan은 조연.
 * 기존 generateCoralClusters는 branch/brain/fan 3종만 배정한다(하위호환) — 'mound'는
 * generateReefColonies(리프 피복)만 생성한다.
 */
export type CoralType = 'mound' | 'branch' | 'brain' | 'fan'

/** 산호 클러스터 하나의 배치·타입·색 인덱스. 렌더가 type에 따라 지오메트리를 생성한다. */
export interface ClusterSpec {
  x: number
  z: number
  type: CoralType
  /** 팔레트 인덱스(CORAL.palette / paletteWeights 순서). */
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

/* ══════════════════════════════════════════════════════════════════════════════
 * 리프 피복 배치(generateReefColonies) — step2 coral-density
 *
 * generateCoralClusters(맨모래 스트라타 배치)의 발전형. 레퍼런스(Palmyra)처럼 "솟은 리프 마운드
 * 표면을 수십 콜로니가 빈틈없이 뒤덮는" 피복감을 만든다. 배치 전략이 근본적으로 달라(스트라타 →
 * 마운드 disk 밀집) 기존 함수는 그대로 두고 새 생성기를 둔다. y(지형 높이)는 렌더가 sandHeightAt으로
 * 스냅하므로 여기선 x/z만 뿌린다.
 * ════════════════════════════════════════════════════════════════════════════ */

/** 리프 마운드 하나(피복 대상). 지형 마운드와 좌표를 맞추되 산호 배치용 반경·콜로니 수를 갖는다. */
export interface ReefMound {
  readonly x: number
  readonly z: number
  /** 콜로니를 뿌릴 disk 반경(월드 유닛). 지형 마운드보다 살짝 작게 두면 표면만 덮는다. */
  readonly radius: number
  /** 이 마운드에 얹을 콜로니 수(12~20 권장 = 피복 밀도). */
  readonly colonyCount: number
}

/** generateReefColonies 파라미터(배치는 THEME coral-reef.coral, 비율은 CORAL.reef에서 유래). */
export interface ReefColonyParams {
  readonly seed: number
  /** 피복 대상 마운드들. */
  readonly mounds: readonly ReefMound[]
  /** 마운드 밖 채널 가장자리에 흩는 소수 콜로니. */
  readonly scatter: {
    readonly count: number
    readonly area: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number }
    /** 중앙 물고기 스테이지 반폭(|x| < 이 값은 비워 시야 확보). */
    readonly stageHalfWidth: number
  }
  /** 타입 가중치 [mound, branch, brain, fan] — mound 주역(뭉게 마운드 다수). */
  readonly typeWeights: readonly [number, number, number, number]
  /** 크기 버킷 가중치 [large, medium, small] — 대20/중40/소40 등. */
  readonly sizeWeights: readonly [number, number, number]
  /** 크기 버킷별 scale 범위(cluster.scale). 버킷은 비겹침 authoring 권장(역판정 안정). */
  readonly sizeScales: {
    readonly large: readonly [number, number]
    readonly medium: readonly [number, number]
    readonly small: readonly [number, number]
  }
  /** 팔레트 인덱스별 가중치(길이 = CORAL.palette 색 수). 분홍/마젠타 인덱스를 크게. */
  readonly paletteWeights: readonly number[]
}

/** 타입 배분 순서(typeWeights 인덱스와 대응). */
const REEF_TYPE_ORDER: readonly CoralType[] = ['mound', 'branch', 'brain', 'fan']

/**
 * 가중치를 정수 개수로 결정적 배분한다(합 = total). 각 카테고리에 floor(비율) 배정 후, 남은 잔여를
 * 소수부 큰 순서(동점은 낮은 인덱스)로 1개씩 나눠준다 — 소표본에서도 목표 비율을 정확히 지켜(미학
 * 안정) 타입/크기/색이 매번 같은 균형으로 나온다. 가중치 합이 0이면 첫 카테고리에 몰아준다(결정적).
 */
export function allocateCounts(total: number, weights: readonly number[]): number[] {
  const n = weights.length
  const counts = new Array<number>(n).fill(0)
  if (total <= 0 || n === 0) return counts

  let sum = 0
  for (const w of weights) sum += Math.max(0, w)
  if (sum <= 0) {
    counts[0] = total
    return counts
  }

  const raw = weights.map((w) => (Math.max(0, w) / sum) * total)
  let assigned = 0
  for (let i = 0; i < n; i++) {
    counts[i] = Math.floor(raw[i])
    assigned += counts[i]
  }
  const rem = total - assigned // ∈ [0, n)
  const order = raw
    .map((r, i) => ({ frac: r - Math.floor(r), i }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (let k = 0; k < rem; k++) counts[order[k].i]++
  return counts
}

/** Fisher-Yates 결정적 셔플(제자리). rng 소비 = 최대 arr.length-1회. */
function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
}

/**
 * 리프 콜로니 배치를 결정적으로 생성한다(마운드 표면 피복 + 채널 스캐터).
 *
 * 불변식(테스트 가드):
 * - 총 콜로니 = Σ mounds.colonyCount + scatter.count.
 * - 같은 params → 완전 동일(결정적, Math.random 미사용 — mulberry32).
 * - 마운드 콜로니는 해당 마운드 반경 내(uniform disk, r ∝ √u).
 * - 타입/크기/팔레트가 가중치대로 정확히 배분(allocateCounts + 셔플).
 * - 스캐터 콜로니는 중앙 스테이지(|x| < stageHalfWidth) 밖 + area 내.
 *
 * rng 소비 순서(마운드마다 순차, 그다음 스캐터): 위치(콜로니당 2) → 타입/크기/팔레트 셔플 →
 * per-콜로니(scale·yaw·seed 각 1). 이 순서를 바꾸면 결정성 스냅샷이 달라진다.
 */
export function generateReefColonies(params: ReefColonyParams): ClusterSpec[] {
  const rng = mulberry32(params.seed)
  const TWO_PI = Math.PI * 2
  const out: ClusterSpec[] = []

  // 위치 배열을 받아 타입/크기/색을 배분·셔플하고 인스턴스 변주를 붙여 out에 push.
  const emitGroup = (positions: ReadonlyArray<{ x: number; z: number }>): void => {
    const n = positions.length
    if (n === 0) return

    const typeCounts = allocateCounts(n, params.typeWeights)
    const types: CoralType[] = []
    for (let t = 0; t < REEF_TYPE_ORDER.length; t++) {
      for (let k = 0; k < typeCounts[t]; k++) types.push(REEF_TYPE_ORDER[t])
    }
    shuffleInPlace(types, rng)

    const sizeCounts = allocateCounts(n, params.sizeWeights)
    const sizes: number[] = []
    for (let s = 0; s < 3; s++) {
      for (let k = 0; k < sizeCounts[s]; k++) sizes.push(s)
    }
    shuffleInPlace(sizes, rng)

    const palCounts = allocateCounts(n, params.paletteWeights)
    const palettes: number[] = []
    for (let pi = 0; pi < palCounts.length; pi++) {
      for (let k = 0; k < palCounts[pi]; k++) palettes.push(pi)
    }
    shuffleInPlace(palettes, rng)

    for (let i = 0; i < n; i++) {
      const bucket =
        sizes[i] === 0
          ? params.sizeScales.large
          : sizes[i] === 1
            ? params.sizeScales.medium
            : params.sizeScales.small
      const scale = bucket[0] + rng() * (bucket[1] - bucket[0])
      const yaw = rng() * TWO_PI * 0.9999
      const seed = Math.floor(rng() * 1_000_000_000)
      out.push({ x: positions[i].x, z: positions[i].z, type: types[i], paletteIndex: palettes[i], scale, yaw, seed })
    }
  }

  // 1) 마운드 표면 피복 — uniform disk(r ∝ √u)로 표면을 고르게 뒤덮는다.
  for (const m of params.mounds) {
    const positions: Array<{ x: number; z: number }> = []
    for (let i = 0; i < m.colonyCount; i++) {
      const r = m.radius * Math.sqrt(rng())
      const a = rng() * TWO_PI
      positions.push({ x: m.x + Math.cos(a) * r, z: m.z + Math.sin(a) * r })
    }
    emitGroup(positions)
  }

  // 2) 채널 가장자리 스캐터 — 중앙 스테이지를 비운 좌/우 유효 폭에 매핑(재추출 없이 결정적).
  const sc = params.scatter
  if (sc.count > 0) {
    const half = sc.stageHalfWidth
    const leftW = Math.max(0, -half - sc.area.minX) // [minX, -half]
    const rightW = Math.max(0, sc.area.maxX - half) // [half, maxX]
    const usableW = leftW + rightW
    const positions: Array<{ x: number; z: number }> = []
    for (let i = 0; i < sc.count; i++) {
      const xU = rng()
      let x: number
      if (usableW <= 0) {
        x = sc.area.minX + xU * (sc.area.maxX - sc.area.minX) // 방어적 폴백(스테이지가 area를 덮는 경우)
      } else {
        const u = xU * usableW
        x = u < leftW ? sc.area.minX + u : half + (u - leftW)
      }
      const z = sc.area.minZ + rng() * (sc.area.maxZ - sc.area.minZ)
      positions.push({ x, z })
    }
    emitGroup(positions)
  }

  return out
}
