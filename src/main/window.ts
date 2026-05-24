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
 * 창 크기를 변경하고 가로 중앙 정렬한다. work area를 벗어나지 않도록 클램프.
 */
export function setWindowSize(win: BrowserWindow, width: number, height: number): void {
  const workArea = screen.getPrimaryDisplay().workAreaSize
  const clampedW = Math.max(1, Math.min(width, workArea.width))
  const clampedH = Math.max(1, Math.min(height, workArea.height))
  const bounds = centeredBarBounds(workArea, clampedW, clampedH, WINDOW.topMargin)
  win.setBounds(bounds)
}

// ── 창 크기 슬라이더 순수 함수 ──

interface SizeLimits {
  minWidth: number
  minHeight: number
  maxHeight: number
}

/**
 * t∈[0,1]을 width·height로 선형 매핑 후 클램프.
 * t=0 → 최소(minWidth, minHeight), t=1 → 최대(workArea.width, maxHeight).
 */
export function barSizeForScale(
  t: number,
  workArea: { width: number },
  limits: SizeLimits,
): { width: number; height: number } {
  const clamped = Math.max(0, Math.min(1, t))
  const width = Math.round(limits.minWidth + (workArea.width - limits.minWidth) * clamped)
  const height = Math.round(limits.minHeight + (limits.maxHeight - limits.minHeight) * clamped)
  return { width, height }
}

/**
 * 가로 중앙 정렬 bounds 계산. x = round((workArea.width - width)/2), y = topMargin.
 */
export function centeredBarBounds(
  workArea: { width: number },
  width: number,
  height: number,
  topMargin: number,
): BarBounds {
  const x = Math.max(0, Math.round((workArea.width - width) / 2))
  return { x, y: topMargin, width, height }
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
