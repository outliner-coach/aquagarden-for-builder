import { describe, it, expect } from 'vitest'
import { computeMouseIgnore } from '../passthrough'

describe('computeMouseIgnore', () => {
  it('passthrough 비활성이면 호버 여부와 무관하게 항상 false (정상 모드: 창이 클릭을 받음)', () => {
    expect(computeMouseIgnore(false, false)).toBe(false)
    expect(computeMouseIgnore(false, true)).toBe(false)
  })

  it('passthrough 활성 + 컨트롤 미호버 → true (수조 영역 클릭이 뒤로 통과)', () => {
    expect(computeMouseIgnore(true, false)).toBe(true)
  })

  it('passthrough 활성 + 컨트롤 호버 → false (버튼/패널은 계속 조작 가능 — 잠김 방지)', () => {
    expect(computeMouseIgnore(true, true)).toBe(false)
  })
})
