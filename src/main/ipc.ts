import { BrowserWindow, ipcMain } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type { MoveWindowByPayload, SetClickThroughPayload, SetVisibilityPayload } from '../shared/types'
import { setOverlayVisible, setAlwaysOnTop } from './window'
import { setClickThrough, moveWindowBy } from './overlay'

/** 화이트리스트 IPC 채널 4종을 등록한다. */
export function registerIpcHandlers(win: BrowserWindow): void {
  ipcMain.on(IPC.MOVE_WINDOW_BY, (_event, payload: MoveWindowByPayload) => {
    moveWindowBy(win, payload.dx, payload.dy)
  })

  ipcMain.on(IPC.SET_CLICK_THROUGH, (_event, payload: SetClickThroughPayload) => {
    setClickThrough(win, payload.enabled)
  })

  ipcMain.on(IPC.TOGGLE_VISIBILITY, (_event, payload: SetVisibilityPayload) => {
    setOverlayVisible(win, payload.hidden)
  })

  ipcMain.on(IPC.SET_ALWAYS_ON_TOP, (_event, payload: { enabled: boolean }) => {
    setAlwaysOnTop(win, payload.enabled)
  })
}
