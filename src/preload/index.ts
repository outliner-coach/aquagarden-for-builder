import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type { AquaBridge } from '../shared/types'

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
}

contextBridge.exposeInMainWorld('aqua', bridge)
