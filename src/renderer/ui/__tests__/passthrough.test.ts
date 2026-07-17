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

  // 패널이 펼쳐진 동안은 투과를 일시 해제한다. hover 감지(mouseenter→IPC)가 클릭보다 늦으면
  // 패널 위 첫 클릭이 뒤 화면으로 새던 문제(빠른 이동+클릭, 라이브 QA에서 재현) 방지.
  it('passthrough 활성 + 패널 펼침 → false (호버 감지 지연과 무관하게 패널 조작 보장)', () => {
    expect(computeMouseIgnore(true, false, true)).toBe(false)
    expect(computeMouseIgnore(true, true, true)).toBe(false)
  })

  it('passthrough 활성 + 패널 접힘 + 미호버 → true (투과는 패널 닫힘 상태에서만)', () => {
    expect(computeMouseIgnore(true, false, false)).toBe(true)
  })

  it('panelExpanded 생략 시 기존 동작과 동일(하위호환)', () => {
    expect(computeMouseIgnore(true, false)).toBe(true)
    expect(computeMouseIgnore(false, false)).toBe(false)
  })
})
