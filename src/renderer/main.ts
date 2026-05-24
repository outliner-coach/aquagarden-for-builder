import { SceneRoot } from './core/SceneRoot'
import { RenderLoop } from './core/RenderLoop'
import { Aquascape } from './entities/Aquascape'
import { FishSchool } from './entities/FishSchool'
import { Lighting } from './lighting/Lighting'
import { Bubbles } from './entities/Bubbles'
import { GlowSprites } from './entities/GlowSprites'
import { FishDialogue } from './entities/FishDialogue'
import { ControlPanel } from './ui/ControlPanel'
import { setupResizeHandles } from './ui/resizeHandles'
import { computeMouseIgnore } from './ui/passthrough'
import { sceneOpacityFactor } from './core/sceneOpacity'
import { FISH, LIGHT, WATER, WINDOW, SCENE, CAMERA } from '../shared/config'
import type { AppSettings } from '../shared/types'
import { markReady, setFishActive, tickFrame } from './health'

const container = document.getElementById('app')!

// 현재 바(수조 캔버스) 크기 — 모서리 드래그 리사이즈로 변경된다.
// 시작 시 창은 work-area 전폭으로 생성되므로 innerWidth가 곧 전폭이다.
let currentBarWidth: number = window.innerWidth
let currentBarHeight: number = WINDOW.height
// 패널 확장 여부 — 확장 시 창 높이를 패널 전체가 담기도록 키운다(잘림 방지).
let panelExpanded = false

// 캔버스를 바 높이에 고정한다. 패널 확장 시 창이 커져도 수조는 리프레임되지 않는다.
container.style.cssText = `width:100%;height:${currentBarHeight}px;`

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
  sceneTransparency01: SCENE.defaultTransparency01,
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
  `height:${currentBarHeight}px`,
  'pointer-events:none', 'z-index:1',
].join(';')
document.body.appendChild(waterVeil)

let _veilSceneFactor = 1
function setWaterVeil(b01: number, sceneFactor?: number): void {
  if (sceneFactor !== undefined) _veilSceneFactor = sceneFactor
  // 어두울수록(밤) 살짝 더 짙게, 밝을수록 옅게. sceneOpacity factor로 곱.
  const v = WATER.veil
  const a = (v.maxAlpha - v.brightnessScale * b01) * _veilSceneFactor
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

// 컨트롤(버튼/패널) 또는 리사이즈 핸들 위에 마우스가 있는지. click-through 중에도 조작 위해 추적.
let hoveringControls = false
let hoveringHandles = false

/**
 * 현재 상태로 창의 click-through(마우스 무시) 여부를 계산해 main에 반영한다.
 * 숨김 또는 투과가 켜져 있고 컨트롤/핸들 위가 아닐 때만 통과시킨다 → 버튼/패널/핸들은 항상 조작 가능.
 */
function applyMouseIgnore(): void {
  const passthrough = settings.hidden || settings.clickThrough
  window.aqua.setMouseIgnore(computeMouseIgnore(passthrough, hoveringControls || hoveringHandles))
}

/**
 * 현재 바 크기 + 패널 확장 여부로 OS 창 크기를 갱신한다.
 * 패널이 열려 있으면 창 높이를 패널 전체가 담길 만큼(expandedHeight) 키워 잘림을 막는다.
 * 캔버스(수조)는 항상 바 높이에 고정되고, 늘어난 영역은 투명 패널 공간이다.
 */
function syncWindowSize(): void {
  const winH = panelExpanded
    ? Math.max(currentBarHeight, WINDOW.expandedHeight)
    : currentBarHeight
  window.aqua.setWindowSize(currentBarWidth, winH)
}

// ── ControlPanel 배선 ──
new ControlPanel(
  document.body,
  {
    fishCount: settings.fishCount,
    brightness01: settings.brightness01,
    sceneTransparency01: settings.sceneTransparency01,
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
      glowSprites.setBrightness01(b01)
      setWaterVeil(b01)
    },
    onSceneTransparencyChange(t01: number) {
      settings.sceneTransparency01 = t01
      const factor = sceneOpacityFactor(t01)
      aquascape.setSceneOpacity(factor)
      glowSprites.setSceneOpacity(factor)
      bubbles.setSceneOpacity(factor)
      setWaterVeil(settings.brightness01, factor)
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
      // 패널이 열리면 창을 패널 전체가 담길 만큼 키운다(작은 바에서도 안 잘림). 닫으면 바 높이로 복귀.
      panelExpanded = expanded
      syncWindowSize()
    },
  },
)

// ── 물고기 클릭 대사 ──
new FishDialogue(
  document.body,
  sceneRoot.camera,
  canvas!,
  fishSchool,
  () => !settings.clickThrough && !settings.hidden,
)

// ── 모서리 드래그 리사이즈 핸들 ──
// 창 크기 슬라이더 대신 캔버스 가장자리(우/하/우하단)를 드래그해 크기 조정.
// 좌상단 앵커(중앙정렬 안 함)로 창이 점프하지 않는다. 내용은 배율 보존(중앙 크롭).
setupResizeHandles(
  container,
  () => ({
    minWidth: WINDOW.minWidth,
    minHeight: WINDOW.minHeight,
    maxWidth: window.screen.availWidth,
    maxHeight: WINDOW.maxHeight,
  }),
  {
    getStartSize: () => ({ width: currentBarWidth, height: currentBarHeight }),
    onResize(width: number, height: number) {
      currentBarWidth = width
      currentBarHeight = height
      container.style.height = `${height}px`
      waterVeil.style.height = `${height}px`
      syncWindowSize()
      sceneRoot.resizePreservingScale(CAMERA.fov, WINDOW.height)
    },
    onHoverChange(hovering: boolean) {
      hoveringHandles = hovering
      applyMouseIgnore()
    },
  },
)
