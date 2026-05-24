/**
 * 대사 선택 순수 헬퍼.
 * pickDialogue: 0..count-1 범위의 인덱스를 결정적으로 선택한다.
 */

/** random01(0~1)로 0..count-1 인덱스를 결정적으로 선택한다. count=0이면 -1. */
export function pickDialogue(count: number, random01: number): number {
  if (count <= 0) return -1
  const clamped = Math.max(0, Math.min(random01, 0.9999))
  return Math.floor(clamped * count)
}
