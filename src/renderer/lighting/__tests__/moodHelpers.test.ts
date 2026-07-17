import { describe, it, expect } from 'vitest'
import { moodForHour, moodLerp, moodEquals, IDENTITY_MOOD, type MoodKeyframe } from '../moodHelpers'
import { MOOD } from '../../../shared/config'

const KF = MOOD.keyframes as readonly MoodKeyframe[]

// 깔끔한 보간 검증용 합성 키프레임(자정 넘김 포함).
const SIMPLE: MoodKeyframe[] = [
  { hour: 0, scale: 0, tint: [0, 0, 0] },
  { hour: 12, scale: 1, tint: [1, 1, 1] },
]

describe('moodForHour — 경계값', () => {
  it('키프레임이 비면 항등 무드', () => {
    expect(moodForHour(13, [])).toEqual({ brightnessScale: 1, tint: [1, 1, 1] })
  })

  it('단일 키프레임이면 시각과 무관하게 그 값', () => {
    const one: MoodKeyframe[] = [{ hour: 5, scale: 0.4, tint: [0.5, 0.6, 0.7] }]
    expect(moodForHour(0, one)).toEqual({ brightnessScale: 0.4, tint: [0.5, 0.6, 0.7] })
    expect(moodForHour(23, one)).toEqual({ brightnessScale: 0.4, tint: [0.5, 0.6, 0.7] })
  })

  it('항등 무드 상수는 밝기 배율 1·흰색', () => {
    expect(IDENTITY_MOOD).toEqual({ brightnessScale: 1, tint: [1, 1, 1] })
  })
})

describe('moodForHour — 앵커/보간(실제 config 키프레임)', () => {
  it('앵커 시각은 키프레임 값을 그대로 반환', () => {
    const noon = moodForHour(13, KF)
    expect(noon.brightnessScale).toBeCloseTo(1.0)
    expect(noon.tint).toEqual([1.0, 1.0, 1.0])

    // 2026-07 강화판: 심야는 확실히 어둡고 차갑게(체감 미미 피드백 반영)
    const lateNight = moodForHour(2, KF)
    expect(lateNight.brightnessScale).toBeCloseTo(0.42)
    expect(lateNight.tint[0]).toBeCloseTo(0.55)
    expect(lateNight.tint[2]).toBeCloseTo(1.0)
  })

  it('인접 앵커 사이는 선형 보간(13시 1.0 ↔ 18시 0.8, 15.5시=중간)', () => {
    const mid = moodForHour(15.5, KF)
    expect(mid.brightnessScale).toBeCloseTo(0.9) // lerp(1.0, 0.8, 0.5)
  })

  it('무드는 심야로 갈수록 확실히 체감되게 어두워진다(한낮 대비 절반 이하)', () => {
    const noon = moodForHour(13, KF)
    const lateNight = moodForHour(2, KF)
    expect(lateNight.brightnessScale).toBeLessThanOrEqual(noon.brightnessScale * 0.5)
  })
})

describe('moodForHour — 합성 키프레임 정확 보간', () => {
  it('전반부 중간(6시) = 0.5', () => {
    const m = moodForHour(6, SIMPLE)
    expect(m.brightnessScale).toBeCloseTo(0.5)
    expect(m.tint).toEqual([0.5, 0.5, 0.5])
  })

  it('자정 넘김 구간(12시→0시 wrap, 18시=중간) = 0.5', () => {
    const m = moodForHour(18, SIMPLE)
    expect(m.brightnessScale).toBeCloseTo(0.5) // lerp(1, 0, 0.5)
  })
})

describe('moodForHour — 시각 정규화(24h wrap)', () => {
  it('25시 == 1시, -3시 == 21시', () => {
    expect(moodForHour(25, KF)).toEqual(moodForHour(1, KF))
    expect(moodForHour(-3, KF)).toEqual(moodForHour(21, KF))
  })
})

describe('moodForHour — 출력 범위', () => {
  it('모든 시각에서 scale·tint 성분이 [0,1] 안', () => {
    for (let h = 0; h < 24; h += 0.5) {
      const m = moodForHour(h, KF)
      expect(m.brightnessScale).toBeGreaterThanOrEqual(0)
      expect(m.brightnessScale).toBeLessThanOrEqual(1)
      for (const c of m.tint) {
        expect(c).toBeGreaterThanOrEqual(0)
        expect(c).toBeLessThanOrEqual(1)
      }
    }
  })
})

// 무드 전환 보간 — Lighting이 매 프레임 현재→목표 무드를 부드럽게 수렴시키는 데 쓴다.
// (토글 순간 조명이 뚝 바뀌는 대신 1~2초에 걸쳐 전환 — "켰는데 뭐가 달라졌는지 모름" 방지 겸 자연스러움)
describe('moodLerp', () => {
  const A = { brightnessScale: 1, tint: [1, 1, 1] as [number, number, number] }
  const B = { brightnessScale: 0.5, tint: [0.5, 0.7, 0.9] as [number, number, number] }

  it('t=0이면 a, t=1이면 b', () => {
    expect(moodLerp(A, B, 0)).toEqual(A)
    expect(moodLerp(A, B, 1)).toEqual(B)
  })

  it('t=0.5는 중간값', () => {
    const m = moodLerp(A, B, 0.5)
    expect(m.brightnessScale).toBeCloseTo(0.75)
    expect(m.tint[0]).toBeCloseTo(0.75)
    expect(m.tint[1]).toBeCloseTo(0.85)
    expect(m.tint[2]).toBeCloseTo(0.95)
  })

  it('t는 0~1로 클램프', () => {
    expect(moodLerp(A, B, -1)).toEqual(A)
    expect(moodLerp(A, B, 2)).toEqual(B)
  })
})

describe('moodEquals', () => {
  it('허용 오차 내 동일 판정 (전환 수렴 스냅용)', () => {
    const a = { brightnessScale: 0.5, tint: [0.5, 0.7, 0.9] as [number, number, number] }
    const near = { brightnessScale: 0.5005, tint: [0.5, 0.7005, 0.9] as [number, number, number] }
    const far = { brightnessScale: 0.6, tint: [0.5, 0.7, 0.9] as [number, number, number] }
    expect(moodEquals(a, near, 0.002)).toBe(true)
    expect(moodEquals(a, far, 0.002)).toBe(false)
  })
})
