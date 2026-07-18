import { describe, it, expect } from 'vitest'
import { orbitCameraPose, applyOrbitDrag, approachAngle } from '../cameraHelpers'
import { CAMERA } from '../../../shared/config'

/**
 * 궤도(orbit) 카메라 포즈 — 검사용 카메라 훅(__AQUA_SET_CAMERA__)의 순수 계산.
 * yaw=0·pitch=0·기본 거리에서 기존 고정 카메라(0,0,5)와 정확히 일치해야 한다(하위호환 앵커).
 */

const T = CAMERA.orbit.target
const D = CAMERA.orbit.defaultDist

describe('orbitCameraPose', () => {
  it('yaw 0·pitch 0·기본 거리 = 기존 고정 카메라(0,0,5) 정면 뷰', () => {
    const p = orbitCameraPose(0, 0, D)
    expect(p.position.x).toBeCloseTo(0, 9)
    expect(p.position.y).toBeCloseTo(0, 9)
    expect(p.position.z).toBeCloseTo(5, 9)
    expect(p.target).toEqual(T)
  })

  it('양의 yaw는 +x(오른쪽) 궤도, 음의 yaw는 -x — 거리 보존', () => {
    const r = orbitCameraPose(40, 0, D)
    const l = orbitCameraPose(-40, 0, D)
    expect(r.position.x).toBeGreaterThan(0)
    expect(l.position.x).toBeLessThan(0)
    for (const p of [r, l]) {
      const dx = p.position.x - T.x
      const dy = p.position.y - T.y
      const dz = p.position.z - T.z
      expect(Math.sqrt(dx * dx + dy * dy + dz * dz)).toBeCloseTo(D, 9)
    }
  })

  it('양의 pitch는 타깃 위(내려보기), 90°에 가까우면 거의 수직 상공', () => {
    const p = orbitCameraPose(0, 30, D)
    expect(p.position.y).toBeGreaterThan(T.y)
    const top = orbitCameraPose(0, 89, D)
    expect(top.position.y - T.y).toBeGreaterThan(D * 0.99)
  })

  it('거리 인자를 생략하면 기본 거리, 지정하면 그 거리', () => {
    const near = orbitCameraPose(0, 0, 4)
    expect(near.position.z).toBeCloseTo(T.z + 4, 9)
    const def = orbitCameraPose(0, 0)
    expect(def.position.z).toBeCloseTo(T.z + D, 9)
  })

  it('결정적: 같은 입력 → 같은 출력', () => {
    const a = orbitCameraPose(23, 11, 7)
    const b = orbitCameraPose(23, 11, 7)
    expect(a).toEqual(b)
  })
})

describe('applyOrbitDrag — 캔버스 드래그 → 각도(클램프)', () => {
  const drag = CAMERA.orbit.drag

  it('델타 0이면 각도 불변', () => {
    expect(applyOrbitDrag(5, 10, 0, 0)).toEqual({ yaw: 5, pitch: 10 })
  })

  it('오른쪽 드래그(+dx)는 yaw 감소(OrbitControls 관례), 왼쪽은 증가', () => {
    expect(applyOrbitDrag(0, 0, 50, 0).yaw).toBeLessThan(0)
    expect(applyOrbitDrag(0, 0, -50, 0).yaw).toBeGreaterThan(0)
  })

  it('아래로 드래그(+dy)는 pitch 증가(내려보기), 위로는 감소', () => {
    expect(applyOrbitDrag(0, 0, 0, 40).pitch).toBeGreaterThan(0)
    expect(applyOrbitDrag(0, 10, 0, -40).pitch).toBeLessThan(10)
  })

  it('감도가 config 값(도/px)을 따른다', () => {
    expect(applyOrbitDrag(0, 0, -10, 0).yaw).toBeCloseTo(10 * drag.yawPerPx, 9)
    expect(applyOrbitDrag(0, 0, 0, 10).pitch).toBeCloseTo(10 * drag.pitchPerPx, 9)
  })

  it('아무리 크게 끌어도 무대 세트 성립 범위로 클램프된다', () => {
    const r = applyOrbitDrag(0, 0, -100000, 100000)
    expect(r.yaw).toBe(drag.maxYaw)
    expect(r.pitch).toBe(drag.maxPitch)
    const l = applyOrbitDrag(0, 0, 100000, -100000)
    expect(l.yaw).toBe(drag.minYaw)
    expect(l.pitch).toBe(drag.minPitch)
  })
})

describe('approachAngle — 더블클릭 복귀 지수 수렴', () => {
  it('타깃 방향으로 이동하되 지나치지 않는다', () => {
    const next = approachAngle(20, 0, 1 / 30, 6)
    expect(next).toBeLessThan(20)
    expect(next).toBeGreaterThan(0)
  })

  it('타깃 근방(snapEps)에 들면 정확히 타깃으로 스냅한다', () => {
    expect(approachAngle(0.03, 0, 1 / 30, 6)).toBe(0)
  })

  it('dt·rate가 1 이상이면 그대로 타깃 도달', () => {
    expect(approachAngle(20, 0, 1, 6)).toBe(0)
  })

  it('이미 타깃이면 타깃 그대로', () => {
    expect(approachAngle(7, 7, 1 / 30, 6)).toBe(7)
  })

  it('반복 호출로 결국 수렴한다 (진동/발산 없음)', () => {
    let cur = 25
    for (let i = 0; i < 300; i++) cur = approachAngle(cur, 0, 1 / 30, 6)
    expect(cur).toBe(0)
  })
})
