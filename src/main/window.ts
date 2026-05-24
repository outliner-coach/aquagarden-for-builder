import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { WINDOW } from '../shared/config'

interface WorkArea {
  width: number
  height: number
}

interface BarConfig {
  height: number
  topMargin: number
}

interface BarBounds {
  x: number
  y: number
  width: number
  height: number
}

export function computeBarBounds(workArea: WorkArea, cfg: BarConfig): BarBounds {
  return {
    x: 0,
    y: cfg.topMargin,
    width: workArea.width,
    height: cfg.height,
  }
}

export function createOverlayWindow(opts?: { show?: boolean }): BrowserWindow {
  const workArea = screen.getPrimaryDisplay().workAreaSize
  const bounds = computeBarBounds(workArea, WINDOW)

  const win = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    show: opts?.show ?? true,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: false,
    // 스모크(headless eval) 시 숨김 창도 페인트되도록 — capturePage용
    paintWhenInitiallyHidden: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.setAlwaysOnTop(true, 'screen-saver')

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    win.loadURL(rendererUrl)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

/**
 * 패널 확장/축소에 맞춰 창 높이만 조정한다. x/y/width는 유지.
 * (수조 캔버스는 renderer에서 바 높이에 고정되므로 늘어난 영역은 투명 패널 공간)
 */
export function setWindowHeight(win: BrowserWindow, height: number): void {
  const b = win.getBounds()
  win.setBounds({ x: b.x, y: b.y, width: b.width, height })
}

export function setAlwaysOnTop(win: BrowserWindow, enabled: boolean): void {
  win.setAlwaysOnTop(enabled, 'screen-saver')
}

/**
 * 창 크기를 변경한다. 현재 위치(좌상단)를 유지하며 화면(work area)을 벗어나지 않게 클램프.
 * (가로 중앙 정렬하지 않는다 — 모서리 드래그 리사이즈 중 창이 점프하지 않도록.)
 */
export function setWindowSize(win: BrowserWindow, width: number, height: number): void {
  const workArea = screen.getPrimaryDisplay().workAreaSize
  const w = Math.max(WINDOW.minWidth, Math.min(Math.round(width), workArea.width))
  const h = Math.max(WINDOW.minHeight, Math.min(Math.round(height), workArea.height))
  const b = win.getBounds()
  const x = Math.max(0, Math.min(b.x, workArea.width - w))
  const y = Math.max(0, Math.min(b.y, workArea.height - h))
  win.setBounds({ x, y, width: w, height: h })
}

/**
 * 세로 픽셀이 줄어도 world↔pixel 배율을 보존하도록 카메라 수직 FOV를 재계산.
 * fov = degrees( 2 * atan( tan(radians(baseFov)/2) * (heightPx / baseHeightPx) ) )
 */
export function fovForHeight(baseFov: number, baseHeightPx: number, heightPx: number): number {
  const baseRad = (baseFov * Math.PI) / 180
  const halfTan = Math.tan(baseRad / 2)
  const newHalfTan = halfTan * (heightPx / baseHeightPx)
  return (2 * Math.atan(newHalfTan) * 180) / Math.PI
}
