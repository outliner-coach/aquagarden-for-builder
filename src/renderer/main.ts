import { SceneRoot } from './core/SceneRoot'
import { RenderLoop } from './core/RenderLoop'
import { Aquascape } from './entities/Aquascape'
import { FishSchool } from './entities/FishSchool'
import { Lighting } from './lighting/Lighting'
import { Bubbles } from './entities/Bubbles'
import { ControlPanel } from './ui/ControlPanel'
import { computeMouseIgnore } from './ui/passthrough'
import { FISH, LIGHT, WINDOW } from '../shared/config'
import type { AppSettings } from '../shared/types'

const container = document.getElementById('app')!
// 캔버스를 바 높이에 고정한다. 패널 확장 시 창이 커져도 수조는 리프레임되지 않는다.
container.style.cssText = `width:100%;height:${WINDOW.height}px;`

const sceneRoot = new SceneRoot(container)

const lighting = new Lighting()
sceneRoot.add(lighting)

const aquascape = new Aquascape()
sceneRoot.add(aquascape)

const fishSchool = new FishSchool()
sceneRoot.add(fishSchool)

const bubbles = new Bubbles()
sceneRoot.add(bubbles)

const loop = new RenderLoop((dt) => {
  sceneRoot.update(dt)
  sceneRoot.render()
})

loop.start()

// ── AppSettings: 단일 런타임 상태 ──
const settings: AppSettings = {
  fishCount: FISH.default,
  brightness01: LIGHT.default01,
  hidden: false,
  clickThrough: false,
}

// 캔버스 참조 (hidden 시 display 제어)
const canvas = container.querySelector('canvas')

// 컨트롤(버튼/패널) 위에 마우스가 있는지. click-through 중에도 컨트롤 조작을 위해 추적.
let hoveringControls = false

/**
 * 현재 상태로 창의 click-through(마우스 무시) 여부를 계산해 main에 반영한다.
 * 숨김 또는 투과가 켜져 있고 컨트롤 위가 아닐 때만 통과시킨다 → 버튼/패널은 항상 조작 가능.
 */
function applyMouseIgnore(): void {
  const passthrough = settings.hidden || settings.clickThrough
  window.aqua.setMouseIgnore(computeMouseIgnore(passthrough, hoveringControls))
}

// ── ControlPanel 배선 ──
new ControlPanel(
  document.body,
  {
    fishCount: settings.fishCount,
    brightness01: settings.brightness01,
    hidden: settings.hidden,
    clickThrough: settings.clickThrough,
    alwaysOnTop: true,
  },
  {
    onFishCountChange(count: number) {
      settings.fishCount = count
      fishSchool.setCount(count)
    },
    onBrightnessChange(b01: number) {
      settings.brightness01 = b01
      lighting.setBrightness01(b01)
    },
    onHiddenChange(hidden: boolean) {
      settings.hidden = hidden
      // CRITICAL: hidden 시 렌더 루프 정지, 표시 시 재개.
      // 창은 숨기지 않는다(PRD: 제어용 플로팅 버튼은 남는다) — 캔버스만 숨기고
      // click-through로 뒤쪽 화면이 클릭되게 한다.
      if (hidden) {
        loop.stop()
        if (canvas) canvas.style.display = 'none'
      } else {
        if (canvas) canvas.style.display = ''
        loop.start()
      }
      applyMouseIgnore()
    },
    onClickThroughChange(enabled: boolean) {
      settings.clickThrough = enabled
      applyMouseIgnore()
    },
    onAlwaysOnTopChange(enabled: boolean) {
      window.aqua.setAlwaysOnTop(enabled)
    },
    onMoveWindow(dx: number, dy: number) {
      window.aqua.moveWindowBy(dx, dy)
    },
    onControlsHoverChange(hovering: boolean) {
      hoveringControls = hovering
      applyMouseIgnore()
    },
    onExpandedChange(expanded: boolean) {
      window.aqua.setWindowHeight(expanded ? WINDOW.expandedHeight : WINDOW.height)
    },
  },
)
