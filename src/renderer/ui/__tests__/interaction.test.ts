import { describe, it, expect } from 'vitest'
import { computeInteractive } from '../interaction'

describe('computeInteractive', () => {
  it('투과 OFF + 숨김 OFF → 인터랙션 가능', () => {
    expect(computeInteractive(false, false)).toBe(true)
  })

  it('투과 ON → 불가', () => {
    expect(computeInteractive(true, false)).toBe(false)
  })

  it('숨김 ON → 불가', () => {
    expect(computeInteractive(false, true)).toBe(false)
  })

  it('둘 다 ON → 불가', () => {
    expect(computeInteractive(true, true)).toBe(false)
  })
})
