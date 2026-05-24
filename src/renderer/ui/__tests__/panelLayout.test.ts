import { describe, it, expect } from 'vitest'
import { choosePanelDirection, expandedWindowHeight, canvasTopOffset } from '../panelLayout'

describe('choosePanelDirection', () => {
  const base = { barHeight: 220, panelExtra: 420, availTop: 0, availHeight: 1080 }

  it('바가 화면 상단이고 아래 공간이 충분하면 down', () => {
    expect(choosePanelDirection({ ...base, winTop: 0 })).toBe('down')
  })

  it('바가 화면 하단에 가까워 아래 공간이 부족하면 up', () => {
    // winTop=600 → spaceBelow = 1080 - (600+220) = 260 < 420, spaceAbove = 600 ≥ 420 → up
    expect(choosePanelDirection({ ...base, winTop: 600 })).toBe('up')
  })

  it('아래가 정확히 panelExtra만큼이면 down', () => {
    // spaceBelow = 1080 - (winTop+220) = 420 → winTop=440
    expect(choosePanelDirection({ ...base, winTop: 440 })).toBe('down')
  })

  it('위·아래 모두 부족하면 더 넓은 쪽을 고른다', () => {
    // 작은 화면: availHeight=300, bar=220, extra=420 → 둘 다 부족
    const small = { barHeight: 220, panelExtra: 420, availTop: 0, availHeight: 300 }
    // winTop=10 → below=300-(230)=70, above=10 → below 넓음 → down
    expect(choosePanelDirection({ ...small, winTop: 10 })).toBe('down')
    // winTop=70 → below=300-290=10, above=70 → above 넓음 → up
    expect(choosePanelDirection({ ...small, winTop: 70 })).toBe('up')
  })

  it('availTop 오프셋(보조 모니터/메뉴바)을 반영한다', () => {
    // availTop=100, availHeight=900 → 작업영역 100..1000
    const off = { barHeight: 200, panelExtra: 400, availTop: 100, availHeight: 900 }
    // winTop=100(작업영역 최상단) → below=1000-(300)=700≥400 → down
    expect(choosePanelDirection({ ...off, winTop: 100 })).toBe('down')
    // winTop=550 → below=1000-750=250<400, above=550-100=450≥400 → up
    expect(choosePanelDirection({ ...off, winTop: 550 })).toBe('up')
  })
})

describe('expandedWindowHeight', () => {
  it('바 높이 + 패널 여백', () => {
    expect(expandedWindowHeight(220, 420)).toBe(640)
    expect(expandedWindowHeight(80, 420)).toBe(500)
  })
})

describe('canvasTopOffset', () => {
  it('down은 항상 0(상단)', () => {
    expect(canvasTopOffset('down', 640, 220)).toBe(0)
  })

  it('up은 창 하단에 바를 붙인다(winHeight-barHeight)', () => {
    expect(canvasTopOffset('up', 640, 220)).toBe(420)
  })

  it('음수가 되지 않는다', () => {
    expect(canvasTopOffset('up', 100, 220)).toBe(0)
  })
})
