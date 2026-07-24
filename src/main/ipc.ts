import { app, BrowserWindow, ipcMain } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type {
  MoveWindowByPayload,
  SetMouseIgnorePayload,
  SetWindowHeightPayload,
  SetAlwaysOnTopPayload,
  SetWindowSizePayload,
  SetWindowBoundsPayload,
} from '../shared/types'
import { setAlwaysOnTop, setWindowHeight, setWindowSize, setWindowBounds } from './window'
import { setMouseIgnore, moveWindowBy } from './overlay'
import { getTokenUsage } from './tokenUsage'

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
    setWindowSize(win, payload.width, payload.height, payload.anchorBottom ?? false)
  })

  ipcMain.on(IPC.SET_WINDOW_BOUNDS, (_event, payload: SetWindowBoundsPayload) => {
    setWindowBounds(win, payload.x, payload.y, payload.width, payload.height)
  })

  // OS 제어(앱 종료)는 main에서만. renderer는 종료 버튼에서 IPC 요청만 보낸다.
  ipcMain.on(IPC.QUIT_APP, () => {
    app.quit()
  })

  // 유일한 요청/응답(invoke) 채널 — 계정 토큰 사용량을 조회해 반환한다. getTokenUsage는 절대
  // throw하지 않으므로(내부에서 state:'unavailable'로 흡수) 핸들러도 renderer로 reject을 넘기지 않는다.
  ipcMain.handle(IPC.GET_TOKEN_USAGE, () => getTokenUsage())
}
