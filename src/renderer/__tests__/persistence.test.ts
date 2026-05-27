import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadPersisted, savePersisted, type PersistedState } from '../persistence'
import { ZOOM } from '../../shared/config'

// jsdom localStorage가 없으면 메모리 목으로 대체
function installLocalStorage(): void {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  })
}

const base: PersistedState = {
  settings: {
    fishCount: 20,
    brightness01: 0.6,
    sceneTransparency01: 0.3,
    hidden: false,
    clickThrough: false,
    zoom: 1.5,
    enabledFeatures: ['manta', 'whale'],
  },
  alwaysOnTop: true,
  barWidth: 1200,
  barHeight: 220,
  winX: 0,
  winY: 0,
}

describe('persistence zoom', () => {
  beforeEach(() => installLocalStorage())

  it('저장한 zoom을 그대로 복원', () => {
    savePersisted(base)
    expect(loadPersisted()?.settings.zoom).toBeCloseTo(1.5)
  })

  it('zoom이 없는 (구버전) 저장본도 유효 — zoom은 기본값으로 보정', () => {
    const legacy = { ...base, settings: { ...base.settings } } as Record<string, unknown>
    delete (legacy.settings as Record<string, unknown>).zoom
    localStorage.setItem('aquagarden.state.v1', JSON.stringify(legacy))
    const loaded = loadPersisted()
    expect(loaded).not.toBeNull()
    expect(loaded?.settings.zoom).toBe(ZOOM.default)
    expect(loaded?.settings.fishCount).toBe(20) // 나머지 설정은 보존
  })

  it('범위 밖 zoom은 [min,max]로 클램프', () => {
    savePersisted({ ...base, settings: { ...base.settings, zoom: 99 } })
    expect(loadPersisted()?.settings.zoom).toBe(ZOOM.max)
  })
})

describe('persistence enabledFeatures', () => {
  beforeEach(() => installLocalStorage())

  it('저장한 enabledFeatures를 그대로 복원', () => {
    savePersisted(base)
    expect(loadPersisted()?.settings.enabledFeatures).toEqual(['manta', 'whale'])
  })

  it('enabledFeatures 없는 (구버전) 저장본도 유효 — 빈 배열로 보정', () => {
    const legacy = { ...base, settings: { ...base.settings } } as Record<string, unknown>
    delete (legacy.settings as Record<string, unknown>).enabledFeatures
    localStorage.setItem('aquagarden.state.v1', JSON.stringify(legacy))
    const loaded = loadPersisted()
    expect(loaded).not.toBeNull()
    expect(loaded?.settings.enabledFeatures).toEqual([])
    expect(loaded?.settings.fishCount).toBe(20) // 나머지 설정 보존
  })

  it('enabledFeatures가 배열이 아니면(문자열/null) 빈 배열', () => {
    const bad1 = { ...base, settings: { ...base.settings, enabledFeatures: 'manta' } }
    localStorage.setItem('aquagarden.state.v1', JSON.stringify(bad1))
    expect(loadPersisted()?.settings.enabledFeatures).toEqual([])

    const bad2 = { ...base, settings: { ...base.settings, enabledFeatures: null } }
    localStorage.setItem('aquagarden.state.v1', JSON.stringify(bad2))
    expect(loadPersisted()?.settings.enabledFeatures).toEqual([])
  })

  it('enabledFeatures 배열에 비문자열이 섞이면 문자열만 보존', () => {
    const mixed = { ...base, settings: { ...base.settings, enabledFeatures: ['manta', 42, null, 'shark', true] } }
    localStorage.setItem('aquagarden.state.v1', JSON.stringify(mixed))
    expect(loadPersisted()?.settings.enabledFeatures).toEqual(['manta', 'shark'])
  })

  it('필수 필드 누락 시 null — enabledFeatures 존재해도 구제 안 됨 (하드 가드 회귀)', () => {
    const noFishCount = { ...base, settings: { ...base.settings } } as Record<string, unknown>
    delete (noFishCount.settings as Record<string, unknown>).fishCount
    localStorage.setItem('aquagarden.state.v1', JSON.stringify(noFishCount))
    expect(loadPersisted()).toBeNull()
  })
})
