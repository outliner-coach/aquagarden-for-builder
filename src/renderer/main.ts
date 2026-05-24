import { SceneRoot } from './core/SceneRoot'
import { RenderLoop } from './core/RenderLoop'
import { Aquascape } from './entities/Aquascape'
import { FishSchool } from './entities/FishSchool'
import { Lighting } from './lighting/Lighting'
import { Bubbles } from './entities/Bubbles'
import { ControlPanel } from './ui/ControlPanel'
import { FISH, LIGHT } from '../shared/config'
import type { AppSettings } from '../shared/types'

const container = document.getElementById('app')!

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
      // CRITICAL: hidden 시 렌더 루프 정지, 표시 시 재개
      if (hidden) {
        loop.stop()
        if (canvas) canvas.style.display = 'none'
      } else {
        if (canvas) canvas.style.display = ''
        loop.start()
      }
      window.aqua.toggleVisibility(hidden)
    },
    onClickThroughChange(enabled: boolean) {
      settings.clickThrough = enabled
      window.aqua.setClickThrough(enabled)
    },
    onAlwaysOnTopChange(enabled: boolean) {
      window.aqua.setAlwaysOnTop(enabled)
    },
    onMoveWindow(dx: number, dy: number) {
      window.aqua.moveWindowBy(dx, dy)
    },
  },
)
