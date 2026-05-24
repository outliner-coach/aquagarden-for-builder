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

export function createOverlayWindow(): BrowserWindow {
  const workArea = screen.getPrimaryDisplay().workAreaSize
  const bounds = computeBarBounds(workArea, WINDOW)

  const win = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: false,
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

export function setOverlayVisible(win: BrowserWindow, hidden: boolean): void {
  if (hidden) {
    win.hide()
  } else {
    win.show()
  }
}

export function setAlwaysOnTop(win: BrowserWindow, enabled: boolean): void {
  win.setAlwaysOnTop(enabled, 'screen-saver')
}
