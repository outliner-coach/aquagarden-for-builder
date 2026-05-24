import { SceneRoot } from './core/SceneRoot'
import { RenderLoop } from './core/RenderLoop'
import { Aquascape } from './entities/Aquascape'
import { FishSchool } from './entities/FishSchool'
import { Lighting } from './lighting/Lighting'
import { Bubbles } from './entities/Bubbles'
import { GlowSprites } from './entities/GlowSprites'
import { LightShafts } from './entities/LightShafts'
import { ControlPanel } from './ui/ControlPanel'
import { computeMouseIgnore } from './ui/passthrough'
import { FISH, LIGHT, WATER, WINDOW } from '../shared/config'
import type { AppSettings } from '../shared/types'
import { markReady, setFishActive, tickFrame } from './health'

const container = document.getElementById('app')!
// 캔버스를 바 높이에 고정한다. 패널 확장 시 창이 커져도 수조는 리프레임되지 않는다.
container.style.cssText = `width:100%;height:${WINDOW.height}px;`

const sceneRoot = new SceneRoot(container)

const lighting = new Lighting(sceneRoot.scene)
sceneRoot.add(lighting)

const aquascape = new Aquascape()
sceneRoot.add(aquascape)

const fishSchool = new FishSchool()
sceneRoot.add(fishSchool)

// 비동기 GLB 프로토타입 로딩 — 렌더 루프는 즉시 시작, 물고기는 로드 후 등장
fishSchool
  .init()
  .then(() => markReady())
  .catch((err) => {
    console.error('[FishSchool] 초기화 실패:', err)
  })

const lightShafts = new LightShafts()
sceneRoot.add(lightShafts)

const bubbles = new Bubbles()
sceneRoot.add(bubbles)

const glowSprites = new GlowSprites()
sceneRoot.add(glowSprites)

const loop = new RenderLoop((dt) => {
  sceneRoot.update(dt)
  sceneRoot.render()
  setFishActive(fishSchool.activeCount)
  tickFrame()
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

// ── 수중 분위기 베일 ──
// 투명 오버레이라 '물 부피' 색이 없으므로, 화면 상단이 살짝 푸르게 물드는 은은한
// 반투명 그라디언트를 덧씌워 수중 느낌을 준다(바탕화면은 여전히 비침). 밝기와 연동.
const waterVeil = document.createElement('div')
waterVeil.id = 'water-veil'
waterVeil.style.cssText = [
  'position:fixed', 'top:0', 'left:0', 'width:100%',
  `height:${WINDOW.height}px`,
  'pointer-events:none', 'z-index:1',
].join(';')
document.body.appendChild(waterVeil)

function setWaterVeil(b01: number): void {
  // 어두울수록(밤) 살짝 더 짙게, 밝을수록 옅게
  const v = WATER.veil
  const a = v.maxAlpha - v.brightnessScale * b01
  const [tr, tg, tb] = v.topColor
  const [mr, mg, mb] = v.midColor
  const [br, bg, bb] = v.bottomColor
  waterVeil.style.background =
    `linear-gradient(180deg,` +
    ` rgba(${tr},${tg},${tb},${a.toFixed(3)}) 0%,` +
    ` rgba(${mr},${mg},${mb},${(a * v.midAlphaRatio).toFixed(3)}) ${v.midStop}%,` +
    ` rgba(${br},${bg},${bb},${(a * v.bottomAlphaRatio).toFixed(3)}) 100%)`
}
setWaterVeil(LIGHT.default01)

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
      lightShafts.setBrightness01(b01)
      glowSprites.setBrightness01(b01)
      setWaterVeil(b01)
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
