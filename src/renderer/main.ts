import { SceneRoot } from './core/SceneRoot'
import { RenderLoop } from './core/RenderLoop'
import { Aquascape } from './entities/Aquascape'
import { FishSchool } from './entities/FishSchool'
import { Lighting } from './lighting/Lighting'
import { Bubbles } from './entities/Bubbles'
import { GlowSprites } from './entities/GlowSprites'
import { FishDialogue } from './entities/FishDialogue'
import { FoodParticles } from './entities/FoodParticles'
import { FoodLure } from './entities/FoodLure'
import { ControlPanel } from './ui/ControlPanel'
import { setupResizeHandles } from './ui/resizeHandles'
import { computeMouseIgnore } from './ui/passthrough'
import { choosePanelDirection, expandedWindowHeight, canvasTopOffset, shouldAnchorBottom, type PanelDirection } from './ui/panelLayout'
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
// position:fixed + top/bottom 토글로 패널을 위로 펼칠 때(바를 창 하단에 앵커) 바가 제자리 유지.
container.style.cssText = `position:fixed;left:0;top:0;width:100%;height:${currentBarHeight}px;`

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

const foodParticles = new FoodParticles()
sceneRoot.add(foodParticles)

// FishSchool에 FoodParticles 참조 연결 (먹이 소비 연동)
fishSchool.setFoodParticles(foodParticles)

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

// 캔버스 하단 페이드 — 바 아래 가장자리의 불투명 모래 하드 컷(=가로선)을 마스크로 용해.
// 패널 펼침 시 캔버스 하단이 투명 영역 위에 선으로 드러나던 문제 제거.
if (canvas) {
  const fade = `linear-gradient(to bottom, #000 calc(100% - ${WINDOW.canvasBottomFadePx}px), transparent 100%)`
  canvas.style.setProperty('-webkit-mask-image', fade)
  canvas.style.setProperty('mask-image', fade)
}

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

// 패널 펼침 방향. 펼칠 때 하단 공간이 부족하면 'up'(위로) — 창을 강제 이동하지 않는다.
let currentPanelDir: PanelDirection = 'down'

/** 펼침 방향에 맞춰 캔버스(바)·베일의 창 내 앵커를 설정한다. 'up'이면 바를 창 하단에 붙인다. */
function applyCanvasAnchor(): void {
  const winH = panelExpanded
    ? expandedWindowHeight(currentBarHeight, WINDOW.panelExtra)
    : currentBarHeight
  const top = canvasTopOffset(currentPanelDir, winH, currentBarHeight)
  container.style.top = `${top}px`
  waterVeil.style.top = `${top}px`
}

/**
 * 현재 바 크기 + 패널 확장 여부로 OS 창 크기를 갱신한다.
 * 패널이 열려 있으면 창 높이를 바+panelExtra로 키워 잘림을 막는다. 'up' 방향이면 하단 앵커로
 * 키워(위로 펼침) 바가 화면 제자리를 유지한다. 캔버스(수조)는 바 높이에 고정.
 *
 * anchorBottom은 **패널 펼침/접힘에서만** true여야 한다. 리사이즈는 항상 좌상단 앵커(false)다.
 * (currentPanelDir가 'up'으로 남아 있을 때 리사이즈까지 하단 앵커가 되면, 우하단 그립을 끌어도
 *  바닥이 고정되고 top이 위로 기어올라 창이 화면 밖으로 사라지는 버그가 있었다.)
 */
function syncWindowSize(anchorBottom: boolean): void {
  const winH = panelExpanded
    ? expandedWindowHeight(currentBarHeight, WINDOW.panelExtra)
    : currentBarHeight
  window.aqua.setWindowSize(currentBarWidth, winH, anchorBottom)
  applyCanvasAnchor()
}

// ── FoodLure 컨트롤러 (먹이주기/놀래키기) ──
const foodLure = new FoodLure(
  sceneRoot.camera,
  canvas!,
  fishSchool,
  foodParticles,
  () => !settings.clickThrough && !settings.hidden,
)

// ── ControlPanel 배선 ──
const controlPanel = new ControlPanel(
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
        // 수조 숨김 시 수중 베일(DOM 그라디언트)도 같이 숨긴다. 안 그러면 캔버스만 사라지고
        // 베일이 옅은 사각형 '레이어'로 바탕화면 위에 남는다.
        waterVeil.style.display = 'none'
      } else {
        if (canvas) canvas.style.display = ''
        waterVeil.style.display = ''
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
      if (expanded) {
        // 펼치기 직전 하단/상단 공간을 보고 방향 결정 → 하단 부족 시 위로 펼쳐 창 강제 이동 방지.
        // availTop은 비표준이라 옵셔널 캐스트(없으면 0). 멀티모니터에서 작업영역 상단 오프셋 반영.
        const scr = window.screen as Screen & { availTop?: number }
        currentPanelDir = choosePanelDirection({
          winTop: window.screenY,
          barHeight: currentBarHeight,
          panelExtra: WINDOW.panelExtra,
          availTop: scr.availTop ?? 0,
          availHeight: scr.availHeight,
        })
        controlPanel.setOpenDirection(currentPanelDir, currentBarHeight)
      }
      // 펼침/접힘에서만 'up'이면 하단 앵커(바를 제자리에 유지).
      syncWindowSize(shouldAnchorBottom('toggle', panelExpanded, currentPanelDir))
    },
    onLureModeChange(mode) {
      foodLure.setMode(mode)
    },
    onQuit() {
      window.aqua.quitApp()
    },
  },
)

// FoodLure → ControlPanel 모드 동기화 (토글 해제 시 UI 반영)
foodLure.onModeChange = (mode) => {
  controlPanel.setLureMode(mode)
}

// ── 물고기 클릭 대사 ──
// lure(먹이/놀래키기)가 armed일 때는 대사를 띄우지 않는다 — 한 번의 클릭에 두 핸들러가
// 동시에 발동하던 겹침(#3) 방지. lure 해제(mode===null) 상태에서만 대사 활성.
new FishDialogue(
  document.body,
  sceneRoot.camera,
  canvas!,
  fishSchool,
  () => !settings.clickThrough && !settings.hidden && foodLure.mode === null,
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
      // 'up' 방향일 때 버튼은 바 상단(창 하단 기준 barHeight-84)에 맞춰야 하므로 바 높이 변화에 재정렬.
      controlPanel.setOpenDirection(currentPanelDir, currentBarHeight)
      // 리사이즈는 좌상단 앵커가 기본. 단 패널이 '위로' 펼쳐진 상태에서의 리사이즈만 하단 앵커 유지.
      syncWindowSize(shouldAnchorBottom('resize', panelExpanded, currentPanelDir))
      sceneRoot.resizePreservingScale(CAMERA.fov, WINDOW.height)
    },
    onHoverChange(hovering: boolean) {
      hoveringHandles = hovering
      applyMouseIgnore()
    },
  },
)
