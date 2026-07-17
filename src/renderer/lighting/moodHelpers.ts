/**
 * 시간대(무드) 반응 조명의 순수 매핑. 시스템 시각(0~24)을 밝기 배율 + 광원 색 틴트로 바꾼다.
 * 부수효과 없음 — Lighting/main이 이 결과를 조명에 적용한다. 결정적 유닛테스트로 가드.
 */

export interface Mood {
  /** 사용자 밝기(0~1)에 곱해지는 배율(0~1). 1이면 무변화. */
  brightnessScale: number
  /** 광원 색 틴트 RGB(각 0~1). [1,1,1]이면 무변화(흰색). */
  tint: [number, number, number]
}

export interface MoodKeyframe {
  /** 0~24 시각. 키프레임은 hour 오름차순 가정. */
  hour: number
  scale: number
  tint: readonly [number, number, number]
}

/** 무드 미적용(항등) — 시간대 반응 OFF일 때. 현행 조명과 정확히 동일. */
export const IDENTITY_MOOD: Mood = { brightnessScale: 1, tint: [1, 1, 1] }

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** 두 무드 사이 선형 보간(t는 0~1 클램프). Lighting의 부드러운 전환(수렴)에 쓴다. */
export function moodLerp(a: Mood, b: Mood, t: number): Mood {
  const k = Math.max(0, Math.min(1, t))
  return {
    brightnessScale: lerp(a.brightnessScale, b.brightnessScale, k),
    tint: [
      lerp(a.tint[0], b.tint[0], k),
      lerp(a.tint[1], b.tint[1], k),
      lerp(a.tint[2], b.tint[2], k),
    ],
  }
}

/** 허용 오차 내 동일 무드 판정 — 전환 수렴 시 목표로 스냅하고 재계산을 멈추는 데 쓴다. */
export function moodEquals(a: Mood, b: Mood, eps: number): boolean {
  return (
    Math.abs(a.brightnessScale - b.brightnessScale) <= eps &&
    Math.abs(a.tint[0] - b.tint[0]) <= eps &&
    Math.abs(a.tint[1] - b.tint[1]) <= eps &&
    Math.abs(a.tint[2] - b.tint[2]) <= eps
  )
}

/**
 * 시각(0~24, 실수 허용, 24시간 wrap)을 무드로 매핑한다.
 * 인접 키프레임 사이를 원형(자정 넘김 포함) 선형 보간한다. 키프레임이 비면 항등 무드.
 */
export function moodForHour(hour: number, keyframes: readonly MoodKeyframe[]): Mood {
  const n = keyframes.length
  if (n === 0) return { brightnessScale: 1, tint: [1, 1, 1] }
  if (n === 1) {
    const k = keyframes[0]
    return { brightnessScale: k.scale, tint: [k.tint[0], k.tint[1], k.tint[2]] }
  }
  const h = ((hour % 24) + 24) % 24
  for (let i = 0; i < n; i++) {
    const a = keyframes[i]
    const b = keyframes[(i + 1) % n]
    let span = b.hour - a.hour
    if (span <= 0) span += 24 // 마지막→처음(자정 넘김) 구간
    let d = h - a.hour
    if (d < 0) d += 24
    if (d <= span) {
      const t = span === 0 ? 0 : d / span
      return {
        brightnessScale: lerp(a.scale, b.scale, t),
        tint: [
          lerp(a.tint[0], b.tint[0], t),
          lerp(a.tint[1], b.tint[1], t),
          lerp(a.tint[2], b.tint[2], t),
        ],
      }
    }
  }
  // 세그먼트가 원을 완전 분할하므로 도달 불가. 방어적 항등.
  return { brightnessScale: 1, tint: [1, 1, 1] }
}
