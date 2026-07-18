import { describe, it, expect } from 'vitest'
import { generateKelpInstances, generateKelpClusters, kelpTaperHalfWidth } from '../kelpHelpers'
import type { KelpParams, KelpClusterParams } from '../kelpHelpers'

/** THEME kelp-forest 초기값과 같은 스케일의 현실적 파라미터 */
const defaultParams: KelpParams = {
  minHeight: 2.2,
  maxHeight: 3.0,
  minScale: 0.9,
  maxScale: 1.3,
  baseColor: [0.1, 0.22, 0.1],
  tipColor: [0.35, 0.42, 0.16],
  colorVariation: 0.06,
  centerGap: 5,
  centerProbability: 0.12,
  backBias: 1.8,
}
const area = { minX: -16, maxX: 16, minZ: -5.4, maxZ: -2.6 }

describe('generateKelpInstances', () => {
  it('요청한 개수만큼 인스턴스를 생성한다', () => {
    const instances = generateKelpInstances(42, 18, area, defaultParams)
    expect(instances).toHaveLength(18)
  })

  it('같은 시드는 완전 동일한 출력을 낸다 (결정적)', () => {
    const a = generateKelpInstances(707, 24, area, defaultParams)
    const b = generateKelpInstances(707, 24, area, defaultParams)
    expect(a).toEqual(b)
  })

  it('다른 시드는 다른 결과를 낸다', () => {
    const a = generateKelpInstances(1, 12, area, defaultParams)
    const b = generateKelpInstances(2, 12, area, defaultParams)
    const samePos = a.every((inst, i) => inst.x === b[i].x && inst.z === b[i].z)
    expect(samePos).toBe(false)
  })

  it('개수 0이면 빈 배열', () => {
    expect(generateKelpInstances(1, 0, area, defaultParams)).toHaveLength(0)
  })

  it('모든 인스턴스가 area 내에 있다', () => {
    const instances = generateKelpInstances(99, 200, area, defaultParams)
    for (const inst of instances) {
      expect(inst.x).toBeGreaterThanOrEqual(area.minX)
      expect(inst.x).toBeLessThanOrEqual(area.maxX)
      expect(inst.z).toBeGreaterThanOrEqual(area.minZ)
      expect(inst.z).toBeLessThanOrEqual(area.maxZ)
    }
  })

  it('height가 [minHeight, maxHeight] 내에 있다', () => {
    const instances = generateKelpInstances(55, 100, area, defaultParams)
    for (const inst of instances) {
      expect(inst.height).toBeGreaterThanOrEqual(defaultParams.minHeight)
      expect(inst.height).toBeLessThanOrEqual(defaultParams.maxHeight)
    }
  })

  it('scale이 [minScale, maxScale] 내에 있다', () => {
    const instances = generateKelpInstances(55, 100, area, defaultParams)
    for (const inst of instances) {
      expect(inst.scale).toBeGreaterThanOrEqual(defaultParams.minScale)
      expect(inst.scale).toBeLessThanOrEqual(defaultParams.maxScale)
    }
  })

  it('yaw와 phase는 [0, 2π) 범위', () => {
    const instances = generateKelpInstances(31, 60, area, defaultParams)
    for (const inst of instances) {
      expect(inst.yaw).toBeGreaterThanOrEqual(0)
      expect(inst.yaw).toBeLessThan(Math.PI * 2)
      expect(inst.phase).toBeGreaterThanOrEqual(0)
      expect(inst.phase).toBeLessThan(Math.PI * 2)
    }
  })

  it('각 인스턴스에 baseColor/tipColor(3요소)가 존재한다', () => {
    const instances = generateKelpInstances(10, 8, area, defaultParams)
    for (const inst of instances) {
      expect(inst.baseColor).toHaveLength(3)
      expect(inst.tipColor).toHaveLength(3)
    }
  })

  it('중앙 영역(|x| < centerGap)의 밀도가 가장자리 밀도보다 낮다 (통계)', () => {
    const instances = generateKelpInstances(707, 600, area, defaultParams)
    const gap = defaultParams.centerGap
    const centerWidth = gap * 2
    const edgeWidth = area.maxX - area.minX - centerWidth
    const centerCount = instances.filter((i) => Math.abs(i.x) < gap).length
    const edgeCount = instances.length - centerCount
    const centerDensity = centerCount / centerWidth
    const edgeDensity = edgeCount / edgeWidth
    // 중앙 트임: 폭당 밀도가 가장자리의 절반 미만이어야 한다
    expect(centerDensity).toBeLessThan(edgeDensity * 0.5)
  })

  it('centerProbability=0이면 중앙 영역에 인스턴스가 없다', () => {
    const p: KelpParams = { ...defaultParams, centerProbability: 0 }
    const instances = generateKelpInstances(707, 300, area, p)
    for (const inst of instances) {
      expect(Math.abs(inst.x)).toBeGreaterThanOrEqual(p.centerGap)
    }
  })

  it('z는 뒤쪽(minZ) 가중: 평균 z가 영역 중앙보다 뒤에 있다 (통계)', () => {
    const instances = generateKelpInstances(707, 600, area, defaultParams)
    const meanZ = instances.reduce((s, i) => s + i.z, 0) / instances.length
    const midZ = (area.minZ + area.maxZ) / 2
    expect(meanZ).toBeLessThan(midZ)
  })

  it('backBias=1이면 z 분포가 뒤쪽으로 치우치지 않는다 (평균이 중앙 근방)', () => {
    const p: KelpParams = { ...defaultParams, backBias: 1 }
    const instances = generateKelpInstances(707, 600, area, p)
    const meanZ = instances.reduce((s, i) => s + i.z, 0) / instances.length
    const midZ = (area.minZ + area.maxZ) / 2
    const range = area.maxZ - area.minZ
    expect(Math.abs(meanZ - midZ)).toBeLessThan(range * 0.1)
  })
})

const clusterParams: KelpClusterParams = {
  ...defaultParams,
  bladesPerCluster: [3, 6],
  clusterRadius: 0.25,
}

describe('generateKelpClusters', () => {
  it('총 가닥 수가 clusterCount×[min,max] 범위 안이다', () => {
    const blades = generateKelpClusters(42, 15, area, clusterParams)
    expect(blades.length).toBeGreaterThanOrEqual(15 * 3)
    expect(blades.length).toBeLessThanOrEqual(15 * 6)
  })

  it('bladesPerCluster가 고정([k,k])이면 총 가닥 = clusterCount×k (정확)', () => {
    const p: KelpClusterParams = { ...clusterParams, bladesPerCluster: [4, 4] }
    const blades = generateKelpClusters(7, 10, area, p)
    expect(blades).toHaveLength(10 * 4)
  })

  it('같은 시드는 완전 동일한 출력을 낸다 (결정적)', () => {
    const a = generateKelpClusters(707, 16, area, clusterParams)
    const b = generateKelpClusters(707, 16, area, clusterParams)
    expect(a).toEqual(b)
  })

  it('다른 시드는 다른 결과를 낸다', () => {
    const a = generateKelpClusters(1, 12, area, clusterParams)
    const b = generateKelpClusters(2, 12, area, clusterParams)
    const samePos = a.length === b.length && a.every((inst, i) => inst.x === b[i].x && inst.z === b[i].z)
    expect(samePos).toBe(false)
  })

  it('clusterCount 0이면 빈 배열', () => {
    expect(generateKelpClusters(1, 0, area, clusterParams)).toHaveLength(0)
  })

  it('모든 가닥이 area 내에 있다 (홀드패스트 분산 후 클램프)', () => {
    const blades = generateKelpClusters(99, 40, area, clusterParams)
    for (const inst of blades) {
      expect(inst.x).toBeGreaterThanOrEqual(area.minX)
      expect(inst.x).toBeLessThanOrEqual(area.maxX)
      expect(inst.z).toBeGreaterThanOrEqual(area.minZ)
      expect(inst.z).toBeLessThanOrEqual(area.maxZ)
    }
  })

  it('한 포기(연속 k가닥)는 서로 clusterRadius×2 안에 모여 있다 (다발 응집)', () => {
    const k = 4
    const radius = 0.25
    const p: KelpClusterParams = { ...clusterParams, bladesPerCluster: [k, k], clusterRadius: radius }
    const blades = generateKelpClusters(313, 8, area, p)
    // 클러스터 단위로 방출되므로 [ki, ki+k)가 한 포기. 각 가닥은 홀드패스트에서 radius 이내이므로
    // 임의 두 가닥은 2×radius 이내(클램프는 거리만 줄이므로 상한 불변).
    for (let g = 0; g < blades.length; g += k) {
      for (let i = g; i < g + k; i++) {
        for (let j = i + 1; j < g + k; j++) {
          const dx = blades[i].x - blades[j].x
          const dz = blades[i].z - blades[j].z
          const d = Math.sqrt(dx * dx + dz * dz)
          expect(d).toBeLessThanOrEqual(2 * radius + 1e-6)
        }
      }
    }
  })

  it('height/scale이 범위 내, yaw/phase가 [0,2π)', () => {
    const blades = generateKelpClusters(55, 30, area, clusterParams)
    for (const inst of blades) {
      expect(inst.height).toBeGreaterThanOrEqual(clusterParams.minHeight)
      expect(inst.height).toBeLessThanOrEqual(clusterParams.maxHeight)
      expect(inst.scale).toBeGreaterThanOrEqual(clusterParams.minScale)
      expect(inst.scale).toBeLessThanOrEqual(clusterParams.maxScale)
      expect(inst.yaw).toBeGreaterThanOrEqual(0)
      expect(inst.yaw).toBeLessThan(Math.PI * 2)
      expect(inst.phase).toBeGreaterThanOrEqual(0)
      expect(inst.phase).toBeLessThan(Math.PI * 2)
    }
  })

  it('각 가닥에 baseColor/tipColor(3요소)가 존재한다', () => {
    const blades = generateKelpClusters(10, 6, area, clusterParams)
    for (const inst of blades) {
      expect(inst.baseColor).toHaveLength(3)
      expect(inst.tipColor).toHaveLength(3)
    }
  })

  it('중앙 영역(|x| < centerGap) 밀도가 가장자리보다 낮다 (통계)', () => {
    const blades = generateKelpClusters(707, 200, area, clusterParams)
    const gap = clusterParams.centerGap
    const centerWidth = gap * 2
    const edgeWidth = area.maxX - area.minX - centerWidth
    const centerCount = blades.filter((i) => Math.abs(i.x) < gap).length
    const edgeCount = blades.length - centerCount
    const centerDensity = centerCount / centerWidth
    const edgeDensity = edgeCount / edgeWidth
    expect(centerDensity).toBeLessThan(edgeDensity * 0.5)
  })

  it('z는 뒤쪽(minZ) 가중: 평균 z가 영역 중앙보다 뒤에 있다 (통계)', () => {
    const blades = generateKelpClusters(707, 200, area, clusterParams)
    const meanZ = blades.reduce((s, i) => s + i.z, 0) / blades.length
    const midZ = (area.minZ + area.maxZ) / 2
    expect(meanZ).toBeLessThan(midZ)
  })
})

describe('kelpTaperHalfWidth', () => {
  it('뿌리(h01=0)에서 baseHalfWidth를 반환한다', () => {
    expect(kelpTaperHalfWidth(0, 0.16, 0.32)).toBeCloseTo(0.16, 6)
  })

  it('팁(h01=1)에서 baseHalfWidth × tipRatio를 반환한다', () => {
    expect(kelpTaperHalfWidth(1, 0.16, 0.32)).toBeCloseTo(0.16 * 0.32, 6)
  })

  it('뿌리→팁 단조 감소한다', () => {
    const samples = [0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1.0]
    const widths = samples.map((h) => kelpTaperHalfWidth(h, 0.16, 0.32))
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]).toBeLessThanOrEqual(widths[i - 1])
    }
  })

  it('h01 범위 밖 입력은 [0,1]로 클램프한다', () => {
    expect(kelpTaperHalfWidth(-0.5, 0.16, 0.32)).toBeCloseTo(0.16, 6)
    expect(kelpTaperHalfWidth(1.5, 0.16, 0.32)).toBeCloseTo(0.16 * 0.32, 6)
  })

  it('tipRatio가 양수면 팁 폭도 양수다 (0으로 붕괴하지 않음)', () => {
    expect(kelpTaperHalfWidth(1, 0.2, 0.3)).toBeGreaterThan(0)
  })
})
