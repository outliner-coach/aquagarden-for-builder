import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type { AquaBridge, TokenUsage } from '../shared/types'

const bridge: AquaBridge = {
  moveWindowBy(dx: number, dy: number): void {
    ipcRenderer.send(IPC.MOVE_WINDOW_BY, { dx, dy })
  },
  setMouseIgnore(ignore: boolean): void {
    ipcRenderer.send(IPC.SET_MOUSE_IGNORE, { ignore })
  },
  setWindowHeight(height: number): void {
    ipcRenderer.send(IPC.SET_WINDOW_HEIGHT, { height })
  },
  setAlwaysOnTop(enabled: boolean): void {
    ipcRenderer.send(IPC.SET_ALWAYS_ON_TOP, { enabled })
  },
  setWindowSize(width: number, height: number, anchorBottom = false): void {
    ipcRenderer.send(IPC.SET_WINDOW_SIZE, { width, height, anchorBottom })
  },
  setWindowBounds(x: number, y: number, width: number, height: number): void {
    ipcRenderer.send(IPC.SET_WINDOW_BOUNDS, { x, y, width, height })
  },
  quitApp(): void {
    ipcRenderer.send(IPC.QUIT_APP)
  },
  // 유일한 요청/응답 채널 — send가 아닌 invoke로 main의 핸들러 결과(TokenUsage)를 받는다.
  getTokenUsage(): Promise<TokenUsage> {
    return ipcRenderer.invoke(IPC.GET_TOKEN_USAGE)
  },
}

contextBridge.exposeInMainWorld('aqua', bridge)
