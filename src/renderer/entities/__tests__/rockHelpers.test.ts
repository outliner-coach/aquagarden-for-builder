import { describe, it, expect } from 'vitest'
import { displaceRockPositions } from '../rockHelpers'

describe('displaceRockPositions', () => {
  // 실제로는 IcosahedronGeometry의 position 버퍼가 들어오지만, 순수 함수 테스트는
  // 유닛 구 위의 임의 좌표 몇 개로도 충분하다.
  const basePositions = new Float32Array([
    1, 0, 0,
    0, 1, 0,
    0, 0, 1,
    -1, 0, 0,
    0, -1, 0,
    0, 0, -1,
  ])

  it('입력과 같은 길이의 Float32Array를 반환한다', () => {
    const result = displaceRockPositions(basePositions, 1, 0.2)
    expect(result).toBeInstanceOf(Float32Array)
    expect(result.length).toBe(basePositions.length)
  })

  it('같은 시드·strength면 항상 같은 결과를 낸다 (결정적)', () => {
    const a = displaceRockPositions(basePositions, 42, 0.25)
    const b = displaceRockPositions(basePositions, 42, 0.25)
    expect(Array.from(a)).toEqual(Array.from(b))
  })

  it('다른 시드는 다른 결과를 낸다', () => {
    const a = displaceRockPositions(basePositions, 1, 0.25)
    const b = displaceRockPositions(basePositions, 2, 0.25)
    expect(Array.from(a)).not.toEqual(Array.from(b))
  })

  it('strength=0이면 변위가 없다 (원본과 동일)', () => {
    const result = displaceRockPositions(basePositions, 7, 0)
    for (let i = 0; i < basePositions.length; i++) {
      expect(result[i]).toBeCloseTo(basePositions[i], 6)
    }
  })

  it('각 버텍스 변위 벡터의 길이(반경 방향 스칼라 절대값)가 strength를 넘지 않는다', () => {
    const strength = 0.3
    const result = displaceRockPositions(basePositions, 99, strength)
    for (let i = 0; i < basePositions.length; i += 3) {
      const dx = result[i] - basePositions[i]
      const dy = result[i + 1] - basePositions[i + 1]
      const dz = result[i + 2] - basePositions[i + 2]
      const dispLen = Math.sqrt(dx * dx + dy * dy + dz * dz)
      expect(dispLen).toBeLessThanOrEqual(strength + 1e-6)
    }
  })

  it('NaN을 생성하지 않는다', () => {
    const result = displaceRockPositions(basePositions, 5, 0.5)
    for (const v of result) {
      expect(Number.isNaN(v)).toBe(false)
    }
  })

  it('원점(0,0,0) 버텍스가 있어도 NaN 없이 처리한다 (0으로 나누기 가드)', () => {
    const withOrigin = new Float32Array([0, 0, 0, 1, 0, 0])
    const result = displaceRockPositions(withOrigin, 3, 0.4)
    for (const v of result) {
      expect(Number.isNaN(v)).toBe(false)
    }
  })

  it('ArrayLike(일반 number[]) 입력도 처리한다', () => {
    const arr = [1, 0, 0, 0, 1, 0]
    const result = displaceRockPositions(arr, 8, 0.2)
    expect(result.length).toBe(6)
  })

  it('CRITICAL: 같은 위치의 버텍스는(인덱스가 달라도) 완전히 동일한 변위를 받는다 — flat-shading 중복 버텍스 가드', () => {
    // flat-shading 지오메트리(IcosahedronGeometry 등)는 같은 자리(공유 코너/엣지 중점)의
    // 버텍스가 여러 삼각형에 중복 등장한다. 인덱스가 달라도 같은 좌표면 같은 변위를 받아야
    // 면이 찢어지지 않는다. 아래는 인덱스 0(코너)과 인덱스 3(다른 삼각형이 공유하는 같은 코너)이
    // 정확히 같은 좌표를 갖는 경우를 흉내낸다.
    const duplicated = new Float32Array([
      0.6, 0.6, 0.6, // vertex 0 — 삼각형A의 코너
      1, 0, 0, // vertex 1
      0, 1, 0, // vertex 2
      0.6, 0.6, 0.6, // vertex 3 — 삼각형B가 공유하는 같은 코너(다른 인덱스, 같은 좌표)
      0, 0, 1, // vertex 4
      -1, 0, 0, // vertex 5
    ])
    const result = displaceRockPositions(duplicated, 123, 0.35)
    expect(result[0]).toBe(result[9])
    expect(result[1]).toBe(result[10])
    expect(result[2]).toBe(result[11])
  })

  it('CRITICAL: 부동소수 오차(ULP) 수준의 중복 좌표도 실질적으로 동일한 변위를 받는다 (양자화 가드)', () => {
    // three.js의 폴리헤드론 서브디비전은 공유 엣지의 중점을 양쪽 삼각형에서 서로 다른 순서로
    // lerp 계산할 수 있어 극미한 부동소수 오차가 날 수 있다. 해시가 이 오차에 강건해야
    // (위치를 양자화) 같은 변위량을 받고, 출력도 입력 차이(ULP)만큼만 갈라져 면 찢어짐이 없다.
    const nearDuplicate = new Float32Array([
      0.5, 0.5, 0.70710678,
      0.5 + 1e-9, 0.5 - 1e-9, 0.70710678 + 1e-9,
    ])
    const result = displaceRockPositions(nearDuplicate, 55, 0.3)
    expect(result[0]).toBeCloseTo(result[3], 6)
    expect(result[1]).toBeCloseTo(result[4], 6)
    expect(result[2]).toBeCloseTo(result[5], 6)
  })
})
