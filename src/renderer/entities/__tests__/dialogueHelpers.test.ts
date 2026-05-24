import { describe, it, expect } from 'vitest'
import { pickDialogue } from '../dialogueHelpers'

describe('pickDialogue', () => {
  it('count=0이면 -1을 반환한다', () => {
    expect(pickDialogue(0, 0.5)).toBe(-1)
  })

  it('count=1이면 항상 0을 반환한다', () => {
    expect(pickDialogue(1, 0)).toBe(0)
    expect(pickDialogue(1, 0.5)).toBe(0)
    expect(pickDialogue(1, 0.999)).toBe(0)
  })

  it('random01=0일 때 인덱스 0을 반환한다', () => {
    expect(pickDialogue(10, 0)).toBe(0)
  })

  it('random01이 1에 근접할 때 마지막 인덱스(count-1)를 반환한다', () => {
    expect(pickDialogue(10, 0.9999)).toBe(9)
  })

  it('random01=1일 때도 범위 밖으로 나가지 않는다 (클램프)', () => {
    const idx = pickDialogue(10, 1)
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(idx).toBeLessThan(10)
  })

  it('random01이 음수여도 범위 밖으로 나가지 않는다 (클램프)', () => {
    const idx = pickDialogue(10, -0.5)
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(idx).toBeLessThan(10)
  })

  it('다양한 random01 값에 대해 항상 0..count-1 범위 내에 있다', () => {
    const count = 12
    for (let i = 0; i <= 100; i++) {
      const r = i / 100
      const idx = pickDialogue(count, r)
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(count)
    }
  })

  it('random01 중간값들이 고르게 분포한다', () => {
    const count = 5
    // random01=0.1 → 인덱스 0, random01=0.5 → 인덱스 2
    expect(pickDialogue(count, 0.1)).toBe(0)
    expect(pickDialogue(count, 0.5)).toBe(2)
    expect(pickDialogue(count, 0.8)).toBe(4)
  })
})
