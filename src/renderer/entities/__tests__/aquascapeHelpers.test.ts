import { describe, it, expect } from 'vitest'
import { swayOffset, advanceTime, swayHeightFactor, generatePlantInstances, generateHardscape } from '../aquascapeHelpers'
import type { PlantSpeciesParams } from '../aquascapeHelpers'

describe('advanceTime', () => {
  it('dt를 누적한다', () => {
    expect(advanceTime(1.0, 0.016)).toBeCloseTo(1.016, 5)
  })

  it('초기값 0에서 시작', () => {
    expect(advanceTime(0, 0.5)).toBeCloseTo(0.5, 5)
  })

  it('dt가 0이면 변화 없음', () => {
    expect(advanceTime(3.14, 0)).toBeCloseTo(3.14, 5)
  })

  it('큰 시간값도 정상 누적', () => {
    expect(advanceTime(9999.0, 0.016)).toBeCloseTo(9999.016, 5)
  })
})

describe('swayOffset', () => {
  it('time=0, phase=0이면 0 반환 (sin(0)=0)', () => {
    expect(swayOffset(0, 0, 1.0)).toBeCloseTo(0, 5)
  })

  it('amplitude가 0이면 항상 0', () => {
    expect(swayOffset(1.5, 0.3, 0)).toBeCloseTo(0, 5)
  })

  it('sin(π/2)=1 → amplitude 반환', () => {
    // time * frequency + phase = π/2 → sin = 1
    // 기본 frequency는 swayOffset 내부에서 결정되므로
    // time=π/2, phase=0 → sin(π/2) = 1 → result = amplitude
    expect(swayOffset(Math.PI / 2, 0, 2.0)).toBeCloseTo(2.0, 5)
  })

  it('phase가 오프셋을 준다', () => {
    // sin(time + phase) * amplitude
    // time=0, phase=π/2 → sin(π/2)=1
    expect(swayOffset(0, Math.PI / 2, 1.0)).toBeCloseTo(1.0, 5)
  })

  it('sin(π)=0 → 0에 근접', () => {
    expect(swayOffset(Math.PI, 0, 5.0)).toBeCloseTo(0, 5)
  })

  it('음수 amplitude도 동작', () => {
    expect(swayOffset(Math.PI / 2, 0, -3.0)).toBeCloseTo(-3.0, 5)
  })

  it('주기적으로 반복 (2π)', () => {
    const a = swayOffset(0.5, 0.3, 1.0)
    const b = swayOffset(0.5 + 2 * Math.PI, 0.3, 1.0)
    expect(a).toBeCloseTo(b, 5)
  })
})

describe('swayHeightFactor', () => {
  it('높이 0(루트)이면 0 반환 — 루트 고정', () => {
    expect(swayHeightFactor(0)).toBe(0)
  })

  it('높이 1(끝)이면 1 반환 — 최대 흔들림', () => {
    expect(swayHeightFactor(1)).toBe(1)
  })

  it('중간 높이는 0~1 사이', () => {
    const mid = swayHeightFactor(0.5)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
  })

  it('단조 증가: 높이가 올라가면 값도 커진다', () => {
    const vals = [0, 0.2, 0.4, 0.6, 0.8, 1.0].map(swayHeightFactor)
    for (let i = 1; i < vals.length; i++) {
      expect(vals[i]).toBeGreaterThanOrEqual(vals[i - 1])
    }
  })

  it('하단 근처(0.1)는 매우 작은 값', () => {
    expect(swayHeightFactor(0.1)).toBeLessThan(0.05)
  })

  it('음수 입력은 0으로 클램프', () => {
    expect(swayHeightFactor(-0.5)).toBe(0)
  })

  it('1 초과 입력은 1로 클램프', () => {
    expect(swayHeightFactor(1.5)).toBe(1)
  })
})

describe('generatePlantInstances', () => {
  const defaultParams: PlantSpeciesParams = {
    minHeight: 0.1,
    maxHeight: 0.4,
    minScale: 0.8,
    maxScale: 1.2,
    baseColor: [0.22, 0.48, 0.18],
    tipColor: [0.35, 0.68, 0.28],
    colorVariation: 0.1,
  }
  const area = { minX: -10, maxX: 10, minZ: -4, maxZ: -2 }

  it('요청한 개수만큼 인스턴스를 생성한다', () => {
    const instances = generatePlantInstances(42, 20, area, defaultParams)
    expect(instances).toHaveLength(20)
  })

  it('같은 시드는 같은 결과를 낸다 (결정적)', () => {
    const a = generatePlantInstances(123, 10, area, defaultParams)
    const b = generatePlantInstances(123, 10, area, defaultParams)
    expect(a).toEqual(b)
  })

  it('다른 시드는 다른 결과를 낸다', () => {
    const a = generatePlantInstances(1, 10, area, defaultParams)
    const b = generatePlantInstances(2, 10, area, defaultParams)
    const samePos = a.every((inst, i) => inst.x === b[i].x && inst.z === b[i].z)
    expect(samePos).toBe(false)
  })

  it('배치가 정의된 area 안에 있다', () => {
    const instances = generatePlantInstances(7, 50, area, defaultParams)
    for (const inst of instances) {
      expect(inst.x).toBeGreaterThanOrEqual(area.minX)
      expect(inst.x).toBeLessThanOrEqual(area.maxX)
      expect(inst.z).toBeGreaterThanOrEqual(area.minZ)
      expect(inst.z).toBeLessThanOrEqual(area.maxZ)
    }
  })

  it('높이가 speciesParams의 min/maxHeight 범위 안에 있다', () => {
    const instances = generatePlantInstances(99, 30, area, defaultParams)
    for (const inst of instances) {
      expect(inst.height).toBeGreaterThanOrEqual(defaultParams.minHeight)
      expect(inst.height).toBeLessThanOrEqual(defaultParams.maxHeight)
    }
  })

  it('스케일이 speciesParams의 min/maxScale 범위 안에 있다', () => {
    const instances = generatePlantInstances(99, 30, area, defaultParams)
    for (const inst of instances) {
      expect(inst.scale).toBeGreaterThanOrEqual(defaultParams.minScale)
      expect(inst.scale).toBeLessThanOrEqual(defaultParams.maxScale)
    }
  })

  it('yaw 회전은 0~2π 범위', () => {
    const instances = generatePlantInstances(55, 20, area, defaultParams)
    for (const inst of instances) {
      expect(inst.yaw).toBeGreaterThanOrEqual(0)
      expect(inst.yaw).toBeLessThan(Math.PI * 2)
    }
  })

  it('위상(phase) 오프셋은 0~2π 범위', () => {
    const instances = generatePlantInstances(55, 20, area, defaultParams)
    for (const inst of instances) {
      expect(inst.phase).toBeGreaterThanOrEqual(0)
      expect(inst.phase).toBeLessThan(Math.PI * 2)
    }
  })

  it('개수 0이면 빈 배열', () => {
    const instances = generatePlantInstances(1, 0, area, defaultParams)
    expect(instances).toHaveLength(0)
  })

  it('각 인스턴스에 baseColor와 tipColor가 존재한다', () => {
    const instances = generatePlantInstances(10, 5, area, defaultParams)
    for (const inst of instances) {
      expect(inst.baseColor).toHaveLength(3)
      expect(inst.tipColor).toHaveLength(3)
    }
  })
})

describe('generateHardscape', () => {
  const area = { minX: -12, maxX: 14, minZ: -5, maxZ: -2 }
  const sandY = -1.8

  it('같은 시드는 같은 결과를 낸다 (결정적)', () => {
    const a = generateHardscape(42, area, sandY)
    const b = generateHardscape(42, area, sandY)
    expect(a).toEqual(b)
  })

  it('다른 시드는 다른 결과를 낸다', () => {
    const a = generateHardscape(1, area, sandY)
    const b = generateHardscape(2, area, sandY)
    const sameRocks = a.rocks.every(
      (r, i) => r.x === b.rocks[i]?.x && r.z === b.rocks[i]?.z,
    )
    expect(sameRocks).toBe(false)
  })

  it('rocks 배치가 area 범위 안에 있다', () => {
    const result = generateHardscape(99, area, sandY)
    for (const r of result.rocks) {
      expect(r.x).toBeGreaterThanOrEqual(area.minX)
      expect(r.x).toBeLessThanOrEqual(area.maxX)
      expect(r.z).toBeGreaterThanOrEqual(area.minZ)
      expect(r.z).toBeLessThanOrEqual(area.maxZ)
    }
  })

  it('driftwood 배치가 area 범위 안에 있다', () => {
    const result = generateHardscape(99, area, sandY)
    for (const d of result.driftwood) {
      expect(d.x).toBeGreaterThanOrEqual(area.minX)
      expect(d.x).toBeLessThanOrEqual(area.maxX)
      expect(d.z).toBeGreaterThanOrEqual(area.minZ)
      expect(d.z).toBeLessThanOrEqual(area.maxZ)
    }
  })

  it('rocks y 위치가 하단에 한정된다 (sandY 기준 낮은 높이)', () => {
    const result = generateHardscape(55, area, sandY)
    for (const r of result.rocks) {
      // y는 sandY 위로 scale 반지름만큼만 올라간다 — 물고기 시야 보존
      expect(r.y).toBeGreaterThanOrEqual(sandY)
      expect(r.y).toBeLessThanOrEqual(sandY + 0.6)
    }
  })

  it('driftwood y 위치가 하단~중하단에 한정된다', () => {
    const result = generateHardscape(55, area, sandY)
    for (const d of result.driftwood) {
      expect(d.y).toBeGreaterThanOrEqual(sandY)
      expect(d.y).toBeLessThanOrEqual(sandY + 1.0)
    }
  })

  it('rocks 배열이 비어 있지 않다', () => {
    const result = generateHardscape(10, area, sandY)
    expect(result.rocks.length).toBeGreaterThan(0)
  })

  it('driftwood 배열이 비어 있지 않다', () => {
    const result = generateHardscape(10, area, sandY)
    expect(result.driftwood.length).toBeGreaterThan(0)
  })

  it('각 Placement에 position/scale/rotation 값이 있다', () => {
    const result = generateHardscape(77, area, sandY)
    for (const r of [...result.rocks, ...result.driftwood]) {
      expect(typeof r.x).toBe('number')
      expect(typeof r.y).toBe('number')
      expect(typeof r.z).toBe('number')
      expect(typeof r.scaleX).toBe('number')
      expect(typeof r.scaleY).toBe('number')
      expect(typeof r.scaleZ).toBe('number')
      expect(typeof r.rotX).toBe('number')
      expect(typeof r.rotY).toBe('number')
      expect(typeof r.rotZ).toBe('number')
    }
  })

  it('rocks 스케일이 양수이고 합리적 범위 내에 있다', () => {
    const result = generateHardscape(33, area, sandY)
    for (const r of result.rocks) {
      expect(r.scaleX).toBeGreaterThan(0)
      expect(r.scaleY).toBeGreaterThan(0)
      expect(r.scaleZ).toBeGreaterThan(0)
      expect(r.scaleX).toBeLessThanOrEqual(0.5)
    }
  })
})
