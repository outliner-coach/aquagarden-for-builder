import { describe, it, expect } from 'vitest'
import { resolveThemeId } from '../themeHelpers'

const VALID_IDS = ['minimal', 'kelp-forest', 'coral-reef'] as const
const DEFAULT_ID = 'minimal'

describe('resolveThemeId', () => {
  it('유효한 id는 그대로 반환한다', () => {
    expect(resolveThemeId('kelp-forest', VALID_IDS, DEFAULT_ID)).toBe('kelp-forest')
    expect(resolveThemeId('coral-reef', VALID_IDS, DEFAULT_ID)).toBe('coral-reef')
    expect(resolveThemeId('minimal', VALID_IDS, DEFAULT_ID)).toBe('minimal')
  })

  it('비문자열이면 defaultId로 대체한다', () => {
    expect(resolveThemeId(42, VALID_IDS, DEFAULT_ID)).toBe(DEFAULT_ID)
    expect(resolveThemeId(null, VALID_IDS, DEFAULT_ID)).toBe(DEFAULT_ID)
    expect(resolveThemeId(true, VALID_IDS, DEFAULT_ID)).toBe(DEFAULT_ID)
    expect(resolveThemeId({}, VALID_IDS, DEFAULT_ID)).toBe(DEFAULT_ID)
    expect(resolveThemeId(['minimal'], VALID_IDS, DEFAULT_ID)).toBe(DEFAULT_ID)
  })

  it('undefined(누락)면 defaultId로 대체한다', () => {
    expect(resolveThemeId(undefined, VALID_IDS, DEFAULT_ID)).toBe(DEFAULT_ID)
  })

  it('유령(미등록) id면 defaultId로 대체한다', () => {
    expect(resolveThemeId('atlantis', VALID_IDS, DEFAULT_ID)).toBe(DEFAULT_ID)
    expect(resolveThemeId('', VALID_IDS, DEFAULT_ID)).toBe(DEFAULT_ID)
  })

  it('defaultId 자체가 유효 id 목록에 있으면 그대로 반환한다(회귀 가드)', () => {
    expect(resolveThemeId(DEFAULT_ID, VALID_IDS, DEFAULT_ID)).toBe(DEFAULT_ID)
  })
})
