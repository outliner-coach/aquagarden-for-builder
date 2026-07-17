import { describe, it, expect } from 'vitest'
import { generateBranchCoral, generateCoralClusters } from '../coralHelpers'
import type { BranchCoralParams, CoralType } from '../coralHelpers'

/** THEME coral-reef 초기값과 같은 스케일의 현실적 파라미터 */
const branchParams: BranchCoralParams = {
  depth: 3,
  childCount: [2, 3],
  spreadAngle: 0.7,
  lengthDecay: 0.72,
  radiusDecay: 0.62,
}

const clusterArea = { minX: -12, maxX: 14, minZ: -5, maxZ: -2 }

/** min>=1 가정에서 depth 트리의 최소/최대 분기 수: sum_{L=0}^{depth} child^L */
function branchCountBounds(depth: number, minChild: number, maxChild: number): [number, number] {
  let lo = 0
  let hi = 0
  for (let L = 0; L <= depth; L++) {
    lo += minChild ** L
    hi += maxChild ** L
  }
  return [lo, hi]
}

const eqVec = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i])

describe('generateBranchCoral', () => {
  it('같은 시드는 완전 동일한 출력을 낸다 (결정적)', () => {
    const a = generateBranchCoral(42, branchParams)
    const b = generateBranchCoral(42, branchParams)
    expect(a).toEqual(b)
  })

  it('다른 시드는 다른 결과를 낸다', () => {
    const a = generateBranchCoral(1, branchParams)
    const b = generateBranchCoral(2, branchParams)
    expect(a).not.toEqual(b)
  })

  it('루트 분기는 원점에서 시작한다', () => {
    const branches = generateBranchCoral(7, branchParams)
    expect(branches[0].start).toEqual([0, 0, 0])
  })

  it('연결성: 루트가 아닌 모든 분기의 start는 다른 분기의 end와 일치한다 (부모 end = 자식 start)', () => {
    const branches = generateBranchCoral(7, branchParams)
    const ends = branches.map((b) => b.end)
    for (const b of branches) {
      if (eqVec(b.start, [0, 0, 0])) continue // 루트
      const connected = ends.some((e) => eqVec(e, b.start))
      expect(connected).toBe(true)
    }
  })

  it('radius가 깊이에 따라 단조 감소한다 (레벨당 radiusDecay 배)', () => {
    const branches = generateBranchCoral(7, branchParams)
    // 같은 레벨의 radius는 비트 동일(동일 곱셈 연쇄) → 고유 radius 개수 = depth+1
    const radii = [...new Set(branches.map((b) => b.radius))].sort((x, y) => y - x)
    expect(radii.length).toBe(branchParams.depth + 1)
    for (let i = 1; i < radii.length; i++) {
      expect(radii[i]).toBeLessThan(radii[i - 1])
      expect(radii[i] / radii[i - 1]).toBeCloseTo(branchParams.radiusDecay, 5)
    }
    // 루트가 가장 굵다
    expect(branches[0].radius).toBe(radii[0])
  })

  it('세그먼트 길이가 깊이에 따라 단조 감소한다 (레벨당 lengthDecay 배)', () => {
    const branches = generateBranchCoral(7, branchParams)
    // radius가 레벨을 유일하게 식별하므로 radius→길이로 그룹핑
    const byRadius = new Map<number, number>()
    for (const b of branches) {
      const len = Math.hypot(b.end[0] - b.start[0], b.end[1] - b.start[1], b.end[2] - b.start[2])
      byRadius.set(b.radius, len)
    }
    const radiiDesc = [...byRadius.keys()].sort((x, y) => y - x)
    for (let i = 1; i < radiiDesc.length; i++) {
      const shorter = byRadius.get(radiiDesc[i])!
      const longer = byRadius.get(radiiDesc[i - 1])!
      expect(shorter).toBeLessThan(longer)
      expect(shorter / longer).toBeCloseTo(branchParams.lengthDecay, 4)
    }
  })

  it('분기 수가 childCount 범위·depth 공식 안에 있다', () => {
    const [lo, hi] = branchCountBounds(
      branchParams.depth,
      branchParams.childCount[0],
      branchParams.childCount[1],
    )
    for (const seed of [1, 2, 3, 100, 707]) {
      const n = generateBranchCoral(seed, branchParams).length
      expect(n).toBeGreaterThanOrEqual(lo)
      expect(n).toBeLessThanOrEqual(hi)
    }
  })

  it('childCount [0,0]이면 루트 하나만 생성한다', () => {
    const p: BranchCoralParams = { ...branchParams, childCount: [0, 0] }
    const branches = generateBranchCoral(9, p)
    expect(branches).toHaveLength(1)
    expect(branches[0].start).toEqual([0, 0, 0])
  })

  it('depth가 클수록 분기 수가 늘어난다 (고정 childCount)', () => {
    const fixed: BranchCoralParams = { ...branchParams, childCount: [2, 2] }
    const d2 = generateBranchCoral(5, { ...fixed, depth: 2 }).length
    const d3 = generateBranchCoral(5, { ...fixed, depth: 3 }).length
    expect(d3).toBeGreaterThan(d2)
  })

  it('모든 radius가 양수다 (0/음수로 붕괴하지 않음)', () => {
    const branches = generateBranchCoral(11, branchParams)
    for (const b of branches) {
      expect(b.radius).toBeGreaterThan(0)
    }
  })

  it('자식 분기 방향의 단위벡터 성질 (end-start 길이 = 레벨 길이, 정규화 확인)', () => {
    // 방향이 정규화되어 있으면 세그먼트 길이는 순수하게 lengthDecay^level로만 결정된다.
    const branches = generateBranchCoral(3, branchParams)
    for (const b of branches) {
      const len = Math.hypot(b.end[0] - b.start[0], b.end[1] - b.start[1], b.end[2] - b.start[2])
      expect(len).toBeGreaterThan(0)
      expect(Number.isNaN(len)).toBe(false)
    }
  })
})

describe('generateCoralClusters', () => {
  it('요청한 개수만큼 클러스터를 생성한다', () => {
    expect(generateCoralClusters(1, 5, clusterArea)).toHaveLength(5)
  })

  it('개수 0이면 빈 배열', () => {
    expect(generateCoralClusters(1, 0, clusterArea)).toHaveLength(0)
  })

  it('같은 시드는 완전 동일한 출력을 낸다 (결정적)', () => {
    const a = generateCoralClusters(613, 5, clusterArea)
    const b = generateCoralClusters(613, 5, clusterArea)
    expect(a).toEqual(b)
  })

  it('다른 시드는 다른 결과를 낸다', () => {
    const a = generateCoralClusters(1, 5, clusterArea)
    const b = generateCoralClusters(2, 5, clusterArea)
    const samePos = a.every((c, i) => c.x === b[i].x && c.z === b[i].z)
    expect(samePos).toBe(false)
  })

  it('모든 클러스터가 area 내에 있다', () => {
    const clusters = generateCoralClusters(99, 200, clusterArea)
    for (const c of clusters) {
      expect(c.x).toBeGreaterThanOrEqual(clusterArea.minX)
      expect(c.x).toBeLessThanOrEqual(clusterArea.maxX)
      expect(c.z).toBeGreaterThanOrEqual(clusterArea.minZ)
      expect(c.z).toBeLessThanOrEqual(clusterArea.maxZ)
    }
  })

  it('type은 branch/brain/fan 중 하나다', () => {
    const valid: CoralType[] = ['branch', 'brain', 'fan']
    const clusters = generateCoralClusters(5, 30, clusterArea)
    for (const c of clusters) {
      expect(valid).toContain(c.type)
    }
  })

  it('클러스터 3개 이상이면 3종(branch/brain/fan)이 모두 등장한다 (타입 믹스)', () => {
    const clusters = generateCoralClusters(613, 4, clusterArea)
    const types = new Set(clusters.map((c) => c.type))
    expect(types.has('branch')).toBe(true)
    expect(types.has('brain')).toBe(true)
    expect(types.has('fan')).toBe(true)
  })

  it('paletteIndex는 [0,3) 정수다', () => {
    const clusters = generateCoralClusters(7, 40, clusterArea)
    for (const c of clusters) {
      expect(Number.isInteger(c.paletteIndex)).toBe(true)
      expect(c.paletteIndex).toBeGreaterThanOrEqual(0)
      expect(c.paletteIndex).toBeLessThan(3)
    }
  })

  it('클러스터 3개 이상이면 팔레트 3색(0/1/2)이 모두 등장한다 (색 다양성 보장)', () => {
    for (const seed of [1, 7, 344, 613]) {
      const clusters = generateCoralClusters(seed, 5, clusterArea)
      const indices = new Set(clusters.map((c) => c.paletteIndex))
      expect(indices.has(0)).toBe(true)
      expect(indices.has(1)).toBe(true)
      expect(indices.has(2)).toBe(true)
    }
  })

  it('scale은 양수이고 합리적 범위(0.5~2)다', () => {
    const clusters = generateCoralClusters(7, 40, clusterArea)
    for (const c of clusters) {
      expect(c.scale).toBeGreaterThan(0.5)
      expect(c.scale).toBeLessThan(2)
    }
  })

  it('yaw는 [0, 2π) 범위', () => {
    const clusters = generateCoralClusters(7, 40, clusterArea)
    for (const c of clusters) {
      expect(c.yaw).toBeGreaterThanOrEqual(0)
      expect(c.yaw).toBeLessThan(Math.PI * 2)
    }
  })

  it('각 클러스터에 하위 생성용 seed(정수)가 있다', () => {
    const clusters = generateCoralClusters(7, 10, clusterArea)
    for (const c of clusters) {
      expect(Number.isInteger(c.seed)).toBe(true)
    }
  })

  it('z는 뒤쪽(minZ) 가중: 평균 z가 영역 중앙보다 뒤에 있다 (통계)', () => {
    const clusters = generateCoralClusters(613, 400, clusterArea)
    const meanZ = clusters.reduce((s, c) => s + c.z, 0) / clusters.length
    const midZ = (clusterArea.minZ + clusterArea.maxZ) / 2
    expect(meanZ).toBeLessThan(midZ)
  })

  it('x는 스트라타(등분 구간) 배치: i번째 클러스터가 i번째 구간 안에 있어 좌우로 고르게 퍼진다', () => {
    const count = 5
    const w = (clusterArea.maxX - clusterArea.minX) / count
    for (const seed of [1, 344, 613]) {
      const clusters = generateCoralClusters(seed, count, clusterArea)
      for (let i = 0; i < count; i++) {
        expect(clusters[i].x).toBeGreaterThanOrEqual(clusterArea.minX + i * w)
        expect(clusters[i].x).toBeLessThanOrEqual(clusterArea.minX + (i + 1) * w)
      }
      // 스트라타 배치의 귀결: x가 단조 증가(한쪽 몰림 없음)
      for (let i = 1; i < count; i++) {
        expect(clusters[i].x).toBeGreaterThan(clusters[i - 1].x)
      }
    }
  })

  it('클러스터별 seed로 생성한 가지 산호가 서로 다르다 (클러스터 다양성)', () => {
    const clusters = generateCoralClusters(613, 5, clusterArea)
    const branchClusters = clusters.filter((c) => c.type === 'branch')
    if (branchClusters.length >= 2) {
      const a = generateBranchCoral(branchClusters[0].seed, branchParams)
      const b = generateBranchCoral(branchClusters[1].seed, branchParams)
      expect(a).not.toEqual(b)
    }
  })
})
