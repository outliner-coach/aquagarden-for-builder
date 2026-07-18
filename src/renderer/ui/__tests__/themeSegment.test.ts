import { describe, it, expect } from 'vitest'
import { computeThemeSegmentState } from '../themeSegment'

const OPTIONS = [
  { id: 'minimal', displayName: '미니멀' },
  { id: 'kelp-forest', displayName: '다시마 숲' },
  { id: 'coral-reef', displayName: '산호초' },
]

describe('computeThemeSegmentState', () => {
  it('선택된 id의 버튼만 active:true', () => {
    const result = computeThemeSegmentState(OPTIONS, 'kelp-forest')
    expect(result).toEqual([
      { id: 'minimal', displayName: '미니멀', active: false },
      { id: 'kelp-forest', displayName: '다시마 숲', active: true },
      { id: 'coral-reef', displayName: '산호초', active: false },
    ])
  })

  it('목록 순서를 보존한다(레지스트리 순서 = 렌더 순서)', () => {
    const result = computeThemeSegmentState(OPTIONS, 'minimal')
    expect(result.map((r) => r.id)).toEqual(['minimal', 'kelp-forest', 'coral-reef'])
  })

  it('일치하는 id가 없으면 전부 비활성(방어적 분기 — resolveThemeId가 실제로는 항상 유효 id를 보장)', () => {
    const result = computeThemeSegmentState(OPTIONS, 'atlantis')
    expect(result.every((r) => r.active === false)).toBe(true)
  })

  it('빈 옵션 목록이면 빈 배열', () => {
    expect(computeThemeSegmentState([], 'minimal')).toEqual([])
  })

  it('단일 선택 보장 — 두 옵션이 동시에 active일 수 없다', () => {
    const result = computeThemeSegmentState(OPTIONS, 'coral-reef')
    expect(result.filter((r) => r.active)).toHaveLength(1)
  })

  it('입력이 id/displayName 외 필드를 더 가져도(THEME_REGISTRY 실사용 형태) 결과엔 3개 필드만 남는다', () => {
    const wide = [
      { id: 'minimal', displayName: '미니멀', sandColor: 0x9c8a6e, plants: [] },
    ]
    const result = computeThemeSegmentState(wide, 'minimal')
    expect(Object.keys(result[0])).toEqual(['id', 'displayName', 'active'])
  })
})
