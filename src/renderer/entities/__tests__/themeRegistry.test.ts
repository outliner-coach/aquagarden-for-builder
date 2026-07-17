import { describe, it, expect } from 'vitest'
import { THEME_REGISTRY, DEFAULT_THEME_ID, getTheme } from '../themeRegistry'
import { THEME } from '../../../shared/config'

/* ── 레지스트리 무결성 ── */

describe('THEME_REGISTRY', () => {
  it('config.THEME.themes와 동일한 개수다(3종)', () => {
    expect(THEME_REGISTRY).toHaveLength(THEME.themes.length)
    expect(THEME_REGISTRY).toHaveLength(3)
  })

  it('모든 항목의 id가 고유하다', () => {
    const ids = THEME_REGISTRY.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('모든 항목의 displayName이 비어있지 않다', () => {
    for (const t of THEME_REGISTRY) {
      expect(typeof t.displayName).toBe('string')
      expect(t.displayName.length).toBeGreaterThan(0)
    }
  })

  it('minimal·kelp-forest·coral-reef id가 모두 존재한다', () => {
    const ids = THEME_REGISTRY.map((t) => t.id)
    expect(ids).toEqual(['minimal', 'kelp-forest', 'coral-reef'])
  })

  it('모든 항목이 BackgroundTheme 형태를 갖춘다', () => {
    for (const t of THEME_REGISTRY) {
      expect(typeof t.sandColor).toBe('number')
      expect(Array.isArray(t.plants)).toBe(true)
      expect(t.plants.length).toBeGreaterThan(0)
      expect(t.hardscape).toBeDefined()
      expect(typeof t.hardscape.rockCount).toBe('number')
      expect(typeof t.hardscape.seed).toBe('number')
      expect(t.hardscape.rock.colors.length).toBeGreaterThan(0)
    }
  })

  it('미니멀 테마 값은 기존 상수를 참조한다(현 화면과 동일)', () => {
    const minimal = getTheme('minimal')
    expect(minimal.sandColor).toBe(0x9c8a6e)
    expect(minimal.plants).toBe(THEME.themes[0].plants)
  })
})

/* ── DEFAULT_THEME_ID ── */

describe('DEFAULT_THEME_ID', () => {
  it("'minimal'이다", () => {
    expect(DEFAULT_THEME_ID).toBe('minimal')
  })

  it('THEME_REGISTRY에 실존하는 id다', () => {
    expect(THEME_REGISTRY.some((t) => t.id === DEFAULT_THEME_ID)).toBe(true)
  })
})

/* ── getTheme ── */

describe('getTheme', () => {
  it('존재하는 id로 올바른 테마를 반환한다', () => {
    expect(getTheme('kelp-forest').id).toBe('kelp-forest')
    expect(getTheme('coral-reef').id).toBe('coral-reef')
  })

  it('모든 등록 id에 대해 라운드트립한다', () => {
    for (const t of THEME_REGISTRY) {
      expect(getTheme(t.id)).toBe(t)
    }
  })

  it('존재하지 않는 id를 넣으면 throw한다', () => {
    expect(() => getTheme('atlantis')).toThrow()
  })
})
