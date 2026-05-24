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
