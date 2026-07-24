import { SceneRoot } from './core/SceneRoot'
import { RenderLoop } from './core/RenderLoop'
import { Aquascape } from './entities/Aquascape'
import { FishSchool } from './entities/FishSchool'
import type { SpeciesId } from './entities/fishAssets'
import { getSpecies } from './entities/speciesRegistry'
import { Lighting } from './lighting/Lighting'
import { Bubbles } from './entities/Bubbles'
import { GlowSprites } from './entities/GlowSprites'
import { FishDialogue } from './entities/FishDialogue'
import { FoodParticles } from './entities/FoodParticles'
import { FoodLure } from './entities/FoodLure'
import { ControlPanel } from './ui/ControlPanel'
import { setupResizeHandles } from './ui/resizeHandles'
import { computeMouseIgnore } from './ui/passthrough'
import { computeInteractive } from './ui/interaction'
import { zoomFromWheel } from './core/zoomHelpers'
import { orbitCameraPose, applyOrbitDrag, approachAngle } from './core/cameraHelpers'
import { exceedsThreshold } from './ui/drag'
import { choosePanelDirection, expandedWindowHeight, canvasTopOffset, shouldAnchorBottom, requiredPanelExtra, type PanelDirection } from './ui/panelLayout'
import { sceneOpacityFactor } from './core/sceneOpacity'
import { FISH, LIGHT, WINDOW, SCENE, CAMERA, ZOOM, MOOD, RENDER, DRAG, TOKEN } from '../shared/config'
import { moodForHour, IDENTITY_MOOD, type Mood } from './lighting/moodHelpers'
import { setCausticMood } from './entities/caustics'
import { getTheme, DEFAULT_THEME_ID } from './entities/themeRegistry'
import type { AppSettings, TokenUsage } from '../shared/types'
import { markReady, setFishActive, tickFrame, setAppliedTheme, setTerrainClips, setTokenUsageHealth } from './health'
import { loadPersisted, savePersisted, type PersistedState } from './persistence'

const container = document.getElementById('app')!

// 재시작 간 유지된 상태(있으면) — 설정·바 크기·창 위치 복원.
const persisted = loadPersisted()

// 현재 바(수조 캔버스) 크기 — 모서리 드래그 리사이즈로 변경된다.
// 시작 시 창은 work-area 전폭으로 생성되므로 innerWidth가 곧 전폭이다.
let currentBarWidth: number = persisted?.barWidth ?? window.innerWidth
let currentBarHeight: number = persisted?.barHeight ?? WINDOW.height
// 패널 확장 여부 — 확장 시 창 높이를 패널 전체가 담기도록 키운다(잘림 방지).
let panelExpanded = false

// 캔버스를 바 높이에 고정한다. 패널 확장 시 창이 커져도 수조는 리프레임되지 않는다.
// position:fixed + top/bottom 토글로 패널을 위로 펼칠 때(바를 창 하단에 앵커) 바가 제자리 유지.
container.style.cssText = `position:fixed;left:0;top:0;width:100%;height:${currentBarHeight}px;`

const sceneRoot = new SceneRoot(container)

const lighting = new Lighting(sceneRoot.scene)
sceneRoot.add(lighting)

// 복원된 themeId(없으면 기본 테마)로 Aquascape를 생성 — persistence.loadPersisted가 이미
// 하위호환 보정(누락/비문자열/유령 id → 기본값)을 거쳤으므로 여기서는 그대로 조회한다.
const initialThemeId = persisted?.settings.themeId ?? DEFAULT_THEME_ID
const aquascape = new Aquascape(getTheme(initialThemeId))
sceneRoot.add(aquascape)
setAppliedTheme(initialThemeId)

// 스모크 전용 강제 훅(AQUA_SMOKE_MOOD의 __AQUA_MOOD_HOUR__ 패턴과 일관) — 테마 전환 UI가 아직
// 없어도(step5 범위) smoke가 테마를 지시할 수 있게 한다. 존재하지 않는 id는 무시(콘솔 경고만) —
// health.ts는 console.error만 훅하므로 console.warn은 스모크가 에러로 오판하지 않는다.
;(window as unknown as { __AQUA_APPLY_THEME__?: (id: string) => void }).__AQUA_APPLY_THEME__ = (
  id: string,
) => {
  try {
    applyThemeById(id)
  } catch {
    console.warn(`[theme] 알 수 없는 테마 id 무시: ${id}`)
  }
}

const fishSchool = new FishSchool()
sceneRoot.add(fishSchool)

/**
 * 테마 적용 단일 경로: 배경 재구축 + 물고기 지형 회피 갱신 + 헬스 리드백.
 * 모르는 id면 getTheme이 throw(호출부가 처리). 지형 없는 테마(미니멀)는 null 주입 —
 * 물고기가 평평한 bounds.minY 바닥 거동으로 복귀한다.
 */
function applyThemeById(id: string): void {
  const target = getTheme(id)
  aquascape.setTheme(target)
  fishSchool.setTerrain(target.terrain ?? null)
  setAppliedTheme(id)
}

// 초기 테마의 지형을 물고기에 주입(Aquascape 배경은 위 생성자에서 이미 적용됨).
fishSchool.setTerrain(getTheme(initialThemeId).terrain ?? null)

// 검사용 궤도 카메라 훅(AQUA_SMOKE_CAM·데브툴즈용) — __AQUA_APPLY_THEME__와 같은 스모크 훅
// 패턴. 씬은 정면 고정 카메라 전제로 authoring돼 있으므로 프로덕트 기능이 아니라 "다른
// 각도에서 파탄 여부"를 점검하는 QA 도구다. 인자 없이 부르면 정면 기본 뷰로 복귀한다.
;(window as unknown as { __AQUA_SET_CAMERA__?: (yaw?: number, pitch?: number, dist?: number) => string }).__AQUA_SET_CAMERA__ = (yawDeg = 0, pitchDeg = 0, dist?: number) => {
  // 프로덕트 궤도 상태와 동기화(표시각=목표각) — 렌더 루프 수렴이 훅 값을 되돌리지 않게 한다.
  // 클램프하지 않는다(QA는 무대 세트 밖 극단각도 봐야 함). 영속 로드 시 드래그 범위로 보정됨.
  settings.cameraYaw = yawDeg
  settings.cameraPitch = pitchDeg
  camYaw = yawDeg
  camPitch = pitchDeg
  applyCameraPose(dist)
  // 콘솔 피드백(데브툴즈에서 undefined 대신 적용 상태가 보이게)
  return `카메라 적용: yaw ${yawDeg}° · pitch ${pitchDeg}°${dist !== undefined ? ` · dist ${dist}` : ''} (복귀: __AQUA_SET_CAMERA__())`
}

// 비동기 GLB 프로토타입 로딩 — 렌더 루프는 즉시 시작, 물고기는 로드 후 등장
fishSchool
  .init()
  .then(() => {
    markReady()
    // 영속된 enabledFeatures를 실제 로드된 종과 교집합해 유효 id만 적용(유령 차단).
    const avail = fishSchool.availableFeatures()
    const valid = settings.enabledFeatures.filter((id) => avail.has(id as SpeciesId))
    if (valid.length !== settings.enabledFeatures.length) {
      settings.enabledFeatures = valid // 미지/로드실패 id 드롭 → 영속 정리
      persistSoon()
    }
    fishSchool.setEnabledFeatures(valid as SpeciesId[])
    // 가용 특별 개체 목록으로 ControlPanel 토글 UI 채우기
    const featureList = [...avail].map((id) => ({ id, displayName: getSpecies(id).displayName }))
    controlPanel.setFeatureSpecies(featureList, valid)
  })
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

// FPS 캡(RENDER.maxFps) — 표시 중 CPU/GPU 절감. dt 보정이라 유영 속도는 그대로다.
// 무드는 Lighting이 전환 보간의 단일 원천 — 비조명 요소(수초·커스틱)는 매 프레임 참조 비교로 따라간다.
let lastAppliedMood: Mood | null = null
const loop = new RenderLoop((dt) => {
  sceneRoot.update(dt)
  const m = lighting.currentMood
  if (m !== lastAppliedMood) {
    lastAppliedMood = m
    const s = m.brightnessScale
    aquascape.setMood(m.tint[0] * s, m.tint[1] * s, m.tint[2] * s)
    setCausticMood(m.tint[0] * s, m.tint[1] * s, m.tint[2] * s)
  }
  // 카메라 궤도: 목표각(더블클릭 복귀 등)으로 지수 수렴. 드래그 중엔 목표=표시라 no-op.
  const targetYaw = settings.cameraYaw ?? 0
  const targetPitch = settings.cameraPitch ?? 0
  if (camYaw !== targetYaw || camPitch !== targetPitch) {
    camYaw = approachAngle(camYaw, targetYaw, dt, CAMERA.orbit.drag.returnRate)
    camPitch = approachAngle(camPitch, targetPitch, dt, CAMERA.orbit.drag.returnRate)
    applyCameraPose()
  }
  sceneRoot.render()
  setFishActive(fishSchool.activeCount)
  setTerrainClips(fishSchool.terrainClipCount)
  tickFrame()
}, RENDER.maxFps)

loop.start()

// ── AppSettings: 단일 런타임 상태 (저장된 값이 있으면 복원) ──
const settings: AppSettings = persisted?.settings ?? {
  fishCount: FISH.default,
  brightness01: LIGHT.default01,
  hidden: false,
  clickThrough: false,
  sceneTransparency01: SCENE.defaultTransparency01,
  zoom: ZOOM.default,
  enabledFeatures: [],
  moodReactive: false,
  showTokenUsage: true,
  themeId: DEFAULT_THEME_ID,
  cameraYaw: 0,
  cameraPitch: 0,
}
let currentAlwaysOnTop = persisted?.alwaysOnTop ?? true
sceneRoot.setZoom(settings.zoom)

// ── 카메라 궤도 상태 ──
// settings.cameraYaw/Pitch = 목표각(영속·클램프는 applyOrbitDrag/로드 보정이 보장),
// camYaw/camPitch = 표시각. 드래그는 즉응(둘 다 갱신), 더블클릭 복귀는 목표만 0으로 두고
// 렌더 루프가 returnRate로 지수 수렴시킨다(무드 전환과 같은 패턴).
let camYaw = settings.cameraYaw ?? 0
let camPitch = settings.cameraPitch ?? 0
function applyCameraPose(dist?: number): void {
  const pose = orbitCameraPose(camYaw, camPitch, dist)
  sceneRoot.camera.position.set(pose.position.x, pose.position.y, pose.position.z)
  sceneRoot.camera.lookAt(pose.target.x, pose.target.y, pose.target.z)
}
if (camYaw !== 0 || camPitch !== 0) applyCameraPose() // 재시작 복원 각 적용

// ── 시간대(무드) 반응 조명 ──
// ON이면 시스템 시각을 밝기 배율+광원 틴트로 매핑해 조명에 얹는다(사용자 밝기 슬라이더가 마스터).
// 시각은 window.__AQUA_MOOD_HOUR__(테스트/라이브 QA용 강제 시각)이 있으면 그 값을, 없으면 실제 시계를 쓴다.
function readMoodHour(): number {
  const forced = (window as unknown as { __AQUA_MOOD_HOUR__?: number }).__AQUA_MOOD_HOUR__
  if (typeof forced === 'number' && Number.isFinite(forced)) return forced
  const now = new Date()
  return now.getHours() + now.getMinutes() / 60
}
function applyMood(): void {
  lighting.setMood(settings.moodReactive ? moodForHour(readMoodHour(), MOOD.keyframes) : IDENTITY_MOOD)
}
// 시각은 천천히 변하므로 주기적으로만 재계산(렌더 루프와 독립, 숨김 중에도 무해).
setInterval(() => {
  if (settings.moodReactive) applyMood()
}, MOOD.updateIntervalMs)

// ── 영속화 ──
// 펼친 상태(패널 open/'up' 이동)의 좌표를 저장하지 않도록, 접힌(resting) 상태 창 위치만 추적한다.
let restingWinX = persisted?.winX ?? window.screenX
let restingWinY = persisted?.winY ?? window.screenY
function updateRestingFromWindow(): void {
  if (!panelExpanded) {
    restingWinX = window.screenX
    restingWinY = window.screenY
  }
}
let _persistTimer: ReturnType<typeof setTimeout> | null = null
function persistSoon(): void {
  if (_persistTimer !== null) clearTimeout(_persistTimer)
  _persistTimer = setTimeout(() => {
    _persistTimer = null
    const state: PersistedState = {
      settings: { ...settings },
      alwaysOnTop: currentAlwaysOnTop,
      barWidth: currentBarWidth,
      barHeight: currentBarHeight,
      winX: restingWinX,
      winY: restingWinY,
    }
    savePersisted(state)
  }, 400)
}

// 캔버스 참조 (hidden 시 display 제어)
const canvas = container.querySelector('canvas')

// 캔버스 가장자리 페이드 — 하단(불투명 모래 하드 컷=가로선) + 좌우(창 경계에서 모래·수초가
// 세로로 뚝 끊김)를 마스크로 용해. 두 그라디언트는 mask-composite:intersect로 곱해진다.
if (canvas) {
  const bottomFade = `linear-gradient(to bottom, #000 calc(100% - ${WINDOW.canvasBottomFadePx}px), transparent 100%)`
  const edgeFade = `linear-gradient(to right, transparent 0, #000 ${WINDOW.canvasEdgeFadePx}px, #000 calc(100% - ${WINDOW.canvasEdgeFadePx}px), transparent 100%)`
  canvas.style.setProperty('-webkit-mask-image', `${bottomFade}, ${edgeFade}`)
  canvas.style.setProperty('-webkit-mask-composite', 'source-in')
  canvas.style.setProperty('mask-image', `${bottomFade}, ${edgeFade}`)
  canvas.style.setProperty('mask-composite', 'intersect')
}

// 수중 분위기 베일(상단 푸른 반투명 그라디언트)은 제거했다. 투명 오버레이 위에서 저알파
// CSS 그라디언트가 8비트로 양자화되며 ~10px 간격의 균일한 가로 밴딩(여러 개의 수평선)을 만들었고,
// 밝기/투명도를 바꾸면 알파가 변해 그 선들이 움직였다. 디더링 없이 DOM에서 제거가 가장 확실한 해법.

// 컨트롤(버튼/패널) 또는 리사이즈 핸들 위에 마우스가 있는지. click-through 중에도 조작 위해 추적.
let hoveringControls = false
let hoveringHandles = false

/**
 * 현재 상태로 창의 click-through(마우스 무시) 여부를 계산해 main에 반영한다.
 * 숨김 또는 투과가 켜져 있고 컨트롤/핸들 위가 아닐 때만 통과시킨다 → 버튼/패널/핸들은 항상 조작 가능.
 * 패널이 펼쳐진 동안은 투과를 일시 해제한다(hover 감지 IPC가 클릭보다 늦어 패널 첫 클릭이
 * 뒤 화면으로 새던 문제 방지 — passthrough.ts 참고).
 */
function applyMouseIgnore(): void {
  const passthrough = settings.hidden || settings.clickThrough
  window.aqua.setMouseIgnore(
    computeMouseIgnore(passthrough, hoveringControls || hoveringHandles, panelExpanded),
  )
}

// 패널 펼침 방향. 펼칠 때 하단 공간이 부족하면 'up'(위로) — 창을 강제 이동하지 않는다.
let currentPanelDir: PanelDirection = 'down'
// 펼침 시 측정된 패널 밴드 높이(가용 공간으로 클램프됨). 측정 전/실패 시 fallback=WINDOW.panelExtra.
let currentPanelExtra: number = WINDOW.panelExtra

/** 펼침 방향에 맞춰 캔버스(바)의 창 내 앵커를 설정한다. 'up'이면 바를 창 하단에 붙인다. */
function applyCanvasAnchor(): void {
  const winH = panelExpanded
    ? expandedWindowHeight(currentBarHeight, currentPanelExtra)
    : currentBarHeight
  const top = canvasTopOffset(currentPanelDir, winH, currentBarHeight)
  container.style.top = `${top}px`
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
    ? expandedWindowHeight(currentBarHeight, currentPanelExtra)
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
  () => computeInteractive(settings.clickThrough, settings.hidden),
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
    alwaysOnTop: currentAlwaysOnTop,
    zoom: settings.zoom,
    moodReactive: settings.moodReactive,
    showTokenUsage: settings.showTokenUsage,
  },
  {
    onFishCountChange(count: number) {
      settings.fishCount = count
      fishSchool.setCount(count)
      persistSoon()
    },
    onBrightnessChange(b01: number) {
      settings.brightness01 = b01
      lighting.setBrightness01(b01)
      glowSprites.setBrightness01(b01)
      persistSoon()
    },
    onSceneTransparencyChange(t01: number) {
      settings.sceneTransparency01 = t01
      const factor = sceneOpacityFactor(t01)
      aquascape.setSceneOpacity(factor)
      glowSprites.setSceneOpacity(factor)
      bubbles.setSceneOpacity(factor)
      persistSoon()
    },
    onZoomChange(factor: number) {
      settings.zoom = factor
      sceneRoot.setZoom(factor)
      persistSoon()
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
      applyInteractive()
      // 렌더 루프와 같은 표시/숨김 신호로 토큰 폴링도 동기화: 숨김이면 폴링 정지(네트워크 0),
      // 표시로 복귀하면 즉시 1회 조회 + 주기 폴링 재개(전력 규칙 준수).
      syncTokenPolling()
      persistSoon()
    },
    onClickThroughChange(enabled: boolean) {
      settings.clickThrough = enabled
      applyMouseIgnore()
      applyInteractive()
      persistSoon()
    },
    onAlwaysOnTopChange(enabled: boolean) {
      currentAlwaysOnTop = enabled
      window.aqua.setAlwaysOnTop(enabled)
      persistSoon()
    },
    onMoveWindow(dx: number, dy: number) {
      // 펼친 채 창을 옮기면 위 열림 패널이 메뉴바에 잘리는 등 기하가 꼬인다 — 드래그 시작 시 접는다.
      if (panelExpanded) controlPanel.collapse()
      window.aqua.moveWindowBy(dx, dy)
      updateRestingFromWindow()
      persistSoon()
    },
    onControlsHoverChange(hovering: boolean) {
      hoveringControls = hovering
      applyMouseIgnore()
    },
    onExpandedChange(expanded: boolean) {
      // 패널이 열리면 창을 패널 전체가 담길 만큼 키운다(작은 바에서도 안 잘림). 닫으면 바 높이로 복귀.
      panelExpanded = expanded
      if (expanded) {
        // 펼치기 직전 패널 실제 높이를 측정해 방향 결정 + 가용 공간으로 클램프.
        // availTop은 비표준이라 옵셔널 캐스트(없으면 0). 멀티모니터 작업영역 상단 오프셋 반영.
        const scr = window.screen as Screen & { availTop?: number }
        const availTop = scr.availTop ?? 0
        const desired = controlPanel.getPanelHeight() + WINDOW.panelGap
        currentPanelDir = choosePanelDirection({
          winTop: window.screenY,
          barHeight: currentBarHeight,
          panelExtra: desired,
          availTop,
          availHeight: scr.availHeight,
        })
        currentPanelExtra = requiredPanelExtra(
          desired, availTop, scr.availHeight, window.screenY, currentBarHeight, currentPanelDir,
        )
        controlPanel.setOpenDirection(currentPanelDir, currentBarHeight)
      }
      // 펼침/접힘에서만 'up'이면 하단 앵커(바를 제자리에 유지).
      syncWindowSize(shouldAnchorBottom('toggle', panelExpanded, currentPanelDir))
      // 패널 펼침 동안 투과 일시 해제 / 접으면 원래 규칙 복귀.
      applyMouseIgnore()
      // 패널을 열 때 최신 사용량을 즉시 조회한다(간격 대기 없이 게이지를 최신화).
      if (expanded) refreshTokenNow()
    },
    onEnabledFeaturesChange(ids: string[]) {
      settings.enabledFeatures = ids
      fishSchool.setEnabledFeatures(ids as SpeciesId[])
      persistSoon()
    },
    onMoodReactiveChange(enabled: boolean) {
      settings.moodReactive = enabled
      applyMood()
      persistSoon()
    },
    onShowTokenUsageChange(show: boolean) {
      settings.showTokenUsage = show
      persistSoon()
      // ON: 폴러 시작(즉시 1회 + 주기, 표시 상태에서만 실제 조회). OFF: 폴러 정지 + 게이지 placeholder.
      syncTokenPolling()
      if (!show) controlPanel.updateTokenUsage(null)
      // enabled 변경을 헬스에 즉시 반영(숨김/OFF라 조회를 안 해도 토글 상태는 리드백돼야 함).
      refreshTokenHealth()
    },
    onThemeChange(id: string) {
      settings.themeId = id
      applyThemeById(id)
      persistSoon()
    },
    onLureModeChange(mode) {
      foodLure.setMode(mode)
    },
    onQuit() {
      window.aqua.quitApp()
    },
  },
)

// 복원된(또는 기본) themeId를 패널 세그먼트의 초기 선택 상태로 주입한다.
controlPanel.setTheme(initialThemeId)

// FoodLure → ControlPanel 모드 동기화 (토글 해제 시 UI 반영)
foodLure.onModeChange = (mode) => {
  controlPanel.setLureMode(mode)
}

// 인터랙션 가용성(투과/숨김)에 따라 패널 컨트롤 비활성·안내 + armed lure 해제.
function applyInteractive(): void {
  const interactive = computeInteractive(settings.clickThrough, settings.hidden)
  controlPanel.setInteractive(interactive)
  if (!interactive) foodLure.setMode(null)
}

// ── 마우스 휠 줌 ──
// 인터랙티브(투과 OFF·숨김 OFF)일 때만 캔버스 휠로 확대/축소. 그 외엔 기본 스크롤 보존.
canvas?.addEventListener(
  'wheel',
  (e: WheelEvent) => {
    if (!computeInteractive(settings.clickThrough, settings.hidden)) return
    const next = zoomFromWheel(settings.zoom, e.deltaY)
    if (next === settings.zoom) {
      e.preventDefault()
      return
    }
    e.preventDefault()
    settings.zoom = next
    sceneRoot.setZoom(next)
    controlPanel.setZoom(next)
    persistSoon()
  },
  { passive: false },
)

// ── 물고기 탭 대사 ──
// lure(먹이/놀래키기)가 armed일 때는 대사를 띄우지 않는다 — 한 번의 탭에 두 핸들러가
// 동시에 발동하던 겹침(#3) 방지. lure 해제(mode===null) 상태에서만 대사 활성.
// 발동은 아래 탭/드래그 중재가 handleTap으로 호출한다(자체 pointerdown 리스너 없음).
const fishDialogue = new FishDialogue(
  document.body,
  sceneRoot.camera,
  canvas!,
  fishSchool,
  () => computeInteractive(settings.clickThrough, settings.hidden) && foodLure.mode === null,
)

// ── 토큰 사용량 폴러 ──
// 계정 사용량(5시간/주간 %)을 main 브리지(window.aqua.getTokenUsage)로 주기 조회해 패널 게이지·
// 물고기 대사에 공급한다. 조회/자격증명 취급은 전적으로 main 프로세스이고, 렌더러(여기)는 % 스냅샷만
// 받는다 — 토큰 값은 이 파일 어디에도 들어오지 않는다.
// 전력 규칙: 렌더 루프를 멈추는 것과 동일한 표시/숨김 신호(settings.hidden)로 폴링도 멈춘다
// (유휴 시 네트워크/CPU 0). 표시 ON이고 창이 표시 중일 때만 폴링한다.
let latestTokenUsage: TokenUsage | null = null
let _tokenTimer: ReturnType<typeof setInterval> | null = null

/** 헬스 리드백 갱신 — 토글 상태 + 최신 스냅샷 상태/사용률(%)만. 토큰/자격증명은 절대 넣지 않는다. */
function refreshTokenHealth(): void {
  setTokenUsageHealth({
    enabled: settings.showTokenUsage,
    state: latestTokenUsage?.state ?? 'unavailable',
    fiveHourPct: latestTokenUsage?.fiveHour?.pct ?? null,
    weeklyPct: latestTokenUsage?.weekly?.pct ?? null,
  })
}

/** 1회 조회 — main 브리지 호출(계약상 never-throw이나 방어적으로 reject→unavailable 처리). */
async function fetchTokenUsage(): Promise<void> {
  let u: TokenUsage
  try {
    u = await window.aqua.getTokenUsage()
  } catch {
    u = { state: 'unavailable', fetchedAt: Math.floor(Date.now() / 1000) }
  }
  latestTokenUsage = u
  controlPanel.updateTokenUsage(u)
  refreshTokenHealth()
}

/** 즉시 1회 조회(간격 대기 없음). 표시 OFF거나 숨김이면 no-op(전력 규칙·표시 규칙). */
function refreshTokenNow(): void {
  if (settings.showTokenUsage && !settings.hidden) void fetchTokenUsage()
}

/**
 * 폴링 활성 조건(표시 ON && 창 표시)을 실제 타이머 상태와 화해시킨다(멱등).
 * OFF→ON 전이: 즉시 1회 조회(스모크 게이트 결정성) + 주기 인터벌 시작. ON→OFF: 인터벌 정지.
 */
function syncTokenPolling(): void {
  const shouldPoll = settings.showTokenUsage && !settings.hidden
  if (shouldPoll && _tokenTimer === null) {
    void fetchTokenUsage()
    _tokenTimer = setInterval(() => void fetchTokenUsage(), TOKEN.pollIntervalMs)
  } else if (!shouldPoll && _tokenTimer !== null) {
    clearInterval(_tokenTimer)
    _tokenTimer = null
  }
}

// 물고기 대사 provider: 탭 시점의 최신 표시 여부·사용량 스냅샷을 읽는다(FishDialogue가 종·상태로 분기).
fishDialogue.setTokenUsageProvider(() => ({ show: settings.showTokenUsage, usage: latestTokenUsage }))

// ── 카메라 궤도 드래그 + 탭 중재 ──
// 캔버스 드래그(클릭 임계 초과)=카메라 회전, 임계 이내에서 뗌=탭(먹이/놀래키기·대사).
// FishDialogue/FoodLure가 pointerdown 즉발이면 드래그 시작마다 오발동하므로 탭으로 이전했다.
// 더블클릭=정면 복귀(렌더 루프 지수 수렴). 투과/숨김 중엔 줌 휠과 같은 게이트로 비활성.
let orbitPointerId: number | null = null
let orbitStart = { x: 0, y: 0 }
let orbitLast = { x: 0, y: 0 }
let orbitDragging = false

canvas?.addEventListener('pointerdown', (e: PointerEvent) => {
  if (e.button !== 0) return
  if (!computeInteractive(settings.clickThrough, settings.hidden)) return
  orbitPointerId = e.pointerId
  orbitStart = { x: e.clientX, y: e.clientY }
  orbitLast = orbitStart
  orbitDragging = false
  canvas.setPointerCapture(e.pointerId) // 창 밖으로 나가도 드래그 추적
})

canvas?.addEventListener('pointermove', (e: PointerEvent) => {
  if (orbitPointerId !== e.pointerId) return
  const cur = { x: e.clientX, y: e.clientY }
  if (!orbitDragging) {
    // 클릭 지터(1~2px)를 드래그로 오인하지 않는다 — 버튼 드래그(#4)와 같은 임계.
    if (!exceedsThreshold(orbitStart, cur, DRAG.clickThresholdPx)) return
    orbitDragging = true
  }
  const next = applyOrbitDrag(
    settings.cameraYaw ?? 0,
    settings.cameraPitch ?? 0,
    cur.x - orbitLast.x,
    cur.y - orbitLast.y,
  )
  orbitLast = cur
  settings.cameraYaw = next.yaw
  settings.cameraPitch = next.pitch
  camYaw = next.yaw // 드래그는 즉응(수렴 생략)
  camPitch = next.pitch
  applyCameraPose()
})

const endOrbitPointer = (e: PointerEvent): void => {
  if (orbitPointerId !== e.pointerId) return
  const wasDrag = orbitDragging
  orbitPointerId = null
  orbitDragging = false
  if (wasDrag) {
    persistSoon() // 유지된 각도 저장(줌과 같은 영속 패턴)
    return
  }
  if (e.type === 'pointercancel') return
  // 탭 → 기존 즉발 소비자 순서 유지: lure(armed면 소비) → 대사(armed면 predicate가 스킵)
  foodLure.handleTap(e.clientX, e.clientY)
  fishDialogue.handleTap(e.clientX, e.clientY)
}
canvas?.addEventListener('pointerup', endOrbitPointer)
canvas?.addEventListener('pointercancel', endOrbitPointer)

canvas?.addEventListener('dblclick', () => {
  if (!computeInteractive(settings.clickThrough, settings.hidden)) return
  settings.cameraYaw = 0
  settings.cameraPitch = 0
  persistSoon() // 표시각은 렌더 루프가 returnRate로 부드럽게 정면 수렴
})

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
      // 'up' 방향일 때 버튼은 바 상단(창 하단 기준 barHeight-84)에 맞춰야 하므로 바 높이 변화에 재정렬.
      controlPanel.setOpenDirection(currentPanelDir, currentBarHeight)
      // 리사이즈는 좌상단 앵커가 기본. 단 패널이 '위로' 펼쳐진 상태에서의 리사이즈만 하단 앵커 유지.
      syncWindowSize(shouldAnchorBottom('resize', panelExpanded, currentPanelDir))
      sceneRoot.resizePreservingScale(CAMERA.fov, WINDOW.height)
      updateRestingFromWindow()
      persistSoon()
    },
    onHoverChange(hovering: boolean) {
      hoveringHandles = hovering
      applyMouseIgnore()
    },
  },
)

// ── 저장된 상태 적용 (재시작 복원) ──
// settings 값은 ControlPanel 초기 상태로 이미 UI에 반영됨. 여기선 실제 시스템·창에 적용한다.
if (persisted) {
  fishSchool.setCount(settings.fishCount)
  lighting.setBrightness01(settings.brightness01)
  glowSprites.setBrightness01(settings.brightness01)
  const factor = sceneOpacityFactor(settings.sceneTransparency01)
  aquascape.setSceneOpacity(factor)
  glowSprites.setSceneOpacity(factor)
  bubbles.setSceneOpacity(factor)
  if (settings.hidden) {
    loop.stop()
    if (canvas) canvas.style.display = 'none'
  }
  window.aqua.setAlwaysOnTop(currentAlwaysOnTop)
  // 창 위치/크기 복원(main이 화면 안으로 클램프). 렌더러 container는 width:100%·height=barHeight라
  // 창 resize 이벤트로 캔버스가 자동 리프레임된다.
  window.aqua.setWindowBounds(persisted.winX, persisted.winY, currentBarWidth, currentBarHeight)
  applyMouseIgnore()
}

// 시작 시 패널 비활성 상태를 현재 설정에 맞춰 반영(예: 투과/숨김이 복원된 경우).
applyInteractive()

// 시작 시 무드 반영(복원된 moodReactive가 ON이면 즉시 적용, OFF면 항등 유지).
applyMood()

// 시작 시 토큰 사용량 폴러 기동. 헬스 token을 먼저 초기화(조회 전에도 enabled 노출)한 뒤,
// 표시 ON이고 숨김이 아니면 즉시 1회 조회(간격 대기 없음 — 스모크 게이트 결정성) + 주기 폴링 시작.
// 숨김 상태로 복원됐다면 조회하지 않는다(전력 규칙) — 표시로 전환될 때 onHiddenChange가 재개한다.
refreshTokenHealth()
syncTokenPolling()
