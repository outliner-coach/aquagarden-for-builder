import { describe, it, expect } from 'vitest'
import { applyDelta, clampPositionToDisplay, clampPositionToDisplays } from '../overlay'

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

describe('applyDelta', () => {
  const base: Bounds = { x: 100, y: 50, width: 1920, height: 220 }

  it('dx/dy를 현재 bounds에 더한다', () => {
    const result = applyDelta(base, 10, 20)
    expect(result).toEqual({ x: 110, y: 70, width: 1920, height: 220 })
  })

  it('음수 dx/dy로 왼쪽·위로 이동한다', () => {
    const result = applyDelta(base, -30, -10)
    expect(result).toEqual({ x: 70, y: 40, width: 1920, height: 220 })
  })

  it('dx=0, dy=0이면 bounds가 변하지 않는다', () => {
    const result = applyDelta(base, 0, 0)
    expect(result).toEqual(base)
  })

  it('width와 height는 변경되지 않는다', () => {
    const result = applyDelta(base, 50, 50)
    expect(result.width).toBe(base.width)
    expect(result.height).toBe(base.height)
  })

  it('원본 bounds를 변이시키지 않는다 (불변)', () => {
    const original = { ...base }
    applyDelta(base, 10, 10)
    expect(base).toEqual(original)
  })

  it('큰 값의 이동도 처리한다', () => {
    const result = applyDelta(base, 5000, -3000)
    expect(result.x).toBe(5100)
    expect(result.y).toBe(-2950)
  })
})

describe('clampPositionToDisplay — 창이 화면 밖으로 사라지는 것 방지', () => {
  const area = { x: 0, y: 25, width: 1728, height: 1055 } // 메뉴바 25px 가정

  it('영역 안이면 그대로 둔다', () => {
    const r = clampPositionToDisplay({ x: 100, y: 100, width: 400, height: 220 }, area)
    expect(r).toEqual({ x: 100, y: 100, width: 400, height: 220 })
  })

  it('위로 넘으면 work area 상단(메뉴바 아래)으로', () => {
    const r = clampPositionToDisplay({ x: 0, y: -300, width: 400, height: 220 }, area)
    expect(r.y).toBe(25)
  })

  it('아래로 넘으면 하단 안쪽으로(하단 가장자리 보존)', () => {
    const r = clampPositionToDisplay({ x: 0, y: 5000, width: 400, height: 220 }, area)
    expect(r.y).toBe(25 + 1055 - 220) // 860
  })

  it('오른쪽으로 넘으면 우측 안쪽으로', () => {
    const r = clampPositionToDisplay({ x: 9999, y: 100, width: 400, height: 220 }, area)
    expect(r.x).toBe(1728 - 400) // 1328
  })

  it('전폭 바(영역보다 넓음)는 x=area.x로 맞춘다', () => {
    const r = clampPositionToDisplay({ x: -50, y: 100, width: 1728, height: 220 }, area)
    expect(r.x).toBe(0)
  })

  it('크기는 보존한다', () => {
    const r = clampPositionToDisplay({ x: -999, y: 9999, width: 400, height: 220 }, area)
    expect(r.width).toBe(400)
    expect(r.height).toBe(220)
  })
})

describe('clampPositionToDisplays — 다중 모니터 자유 이동(걸쳐 있으면 허용, 완전 이탈만 방지)', () => {
  // 가로로 인접한 두 모니터: A(주, 메뉴바 25px) | B(보조, A의 오른쪽)
  const A = { x: 0, y: 25, width: 1728, height: 1055 }
  const B = { x: 1728, y: 0, width: 1920, height: 1080 }
  const displays = [A, B]
  const minVisible = 80

  it('디스플레이가 비어 있으면 그대로 둔다(방어)', () => {
    const b = { x: 100, y: 100, width: 400, height: 220 }
    expect(clampPositionToDisplays(b, [], minVisible)).toEqual(b)
  })

  it('한 디스플레이 안에 충분히 보이면 그대로 둔다', () => {
    const b = { x: 200, y: 200, width: 400, height: 220 }
    expect(clampPositionToDisplays(b, displays, minVisible)).toEqual(b)
  })

  it('두 모니터 경계에 걸쳐 있어도 이동을 허용한다(클램프하지 않음)', () => {
    // 주 모니터 오른쪽 끝에 걸친 창 — A와 충분히 겹침
    const b = { x: 1400, y: 100, width: 400, height: 220 }
    expect(clampPositionToDisplays(b, displays, minVisible)).toEqual(b)
  })

  it('전폭 바(주 모니터 폭)도 보조 모니터 쪽으로 이동할 수 있다', () => {
    // 전폭 바를 오른쪽으로 절반 가까이 끌어 일부가 보조로 넘어감 — A와 여전히 충분히 겹침
    const b = { x: 1000, y: 100, width: 1728, height: 220 }
    expect(clampPositionToDisplays(b, displays, minVisible)).toEqual(b)
  })

  it('보조 모니터로 완전히 넘어간 창은 그대로 둔다', () => {
    const b = { x: 1900, y: 200, width: 400, height: 220 }
    expect(clampPositionToDisplays(b, displays, minVisible)).toEqual(b)
  })

  it('모든 디스플레이 오른쪽 밖으로 나가면 가장 가까운(보조) 안으로 끌어당긴다', () => {
    const b = { x: 5000, y: 200, width: 400, height: 220 }
    const r = clampPositionToDisplays(b, displays, minVisible)
    expect(r.x).toBe(B.x + B.width - 400) // 1728+1920-400 = 3248
    expect(r.y).toBe(200)
    expect(r.width).toBe(400)
  })

  it('모든 디스플레이 위로 나가면 가장 가까운 디스플레이 안으로 끌어당긴다', () => {
    const b = { x: 100, y: -500, width: 400, height: 220 }
    const r = clampPositionToDisplays(b, displays, minVisible)
    expect(r.y).toBe(A.y) // 25 (주 모니터 work area 상단)
    expect(r.x).toBe(100)
  })

  it('크기는 보존한다', () => {
    const b = { x: 9999, y: 9999, width: 400, height: 220 }
    const r = clampPositionToDisplays(b, displays, minVisible)
    expect(r.width).toBe(400)
    expect(r.height).toBe(220)
  })
})
