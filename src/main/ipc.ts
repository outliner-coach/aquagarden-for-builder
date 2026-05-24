import { BrowserWindow, ipcMain } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type {
  MoveWindowByPayload,
  SetMouseIgnorePayload,
  SetWindowHeightPayload,
  SetAlwaysOnTopPayload,
  SetWindowSizePayload,
} from '../shared/types'
import { setAlwaysOnTop, setWindowHeight, setWindowSize } from './window'
import { setMouseIgnore, moveWindowBy } from './overlay'

/** 화이트리스트 IPC 채널을 등록한다. */
export function registerIpcHandlers(win: BrowserWindow): void {
  ipcMain.on(IPC.MOVE_WINDOW_BY, (_event, payload: MoveWindowByPayload) => {
    moveWindowBy(win, payload.dx, payload.dy)
  })

  ipcMain.on(IPC.SET_MOUSE_IGNORE, (_event, payload: SetMouseIgnorePayload) => {
    setMouseIgnore(win, payload.ignore)
  })

  ipcMain.on(IPC.SET_WINDOW_HEIGHT, (_event, payload: SetWindowHeightPayload) => {
    setWindowHeight(win, payload.height)
  })

  ipcMain.on(IPC.SET_ALWAYS_ON_TOP, (_event, payload: SetAlwaysOnTopPayload) => {
    setAlwaysOnTop(win, payload.enabled)
  })

  ipcMain.on(IPC.SET_WINDOW_SIZE, (_event, payload: SetWindowSizePayload) => {
    setWindowSize(win, payload.width, payload.height)
  })
}
