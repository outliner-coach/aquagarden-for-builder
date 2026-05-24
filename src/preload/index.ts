import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type { AquaBridge } from '../shared/types'

const bridge: AquaBridge = {
  moveWindowBy(dx: number, dy: number): void {
    ipcRenderer.send(IPC.MOVE_WINDOW_BY, { dx, dy })
  },
  setClickThrough(enabled: boolean): void {
    ipcRenderer.send(IPC.SET_CLICK_THROUGH, { enabled })
  },
  toggleVisibility(hidden: boolean): void {
    ipcRenderer.send(IPC.TOGGLE_VISIBILITY, { hidden })
  },
  setAlwaysOnTop(enabled: boolean): void {
    ipcRenderer.send(IPC.SET_ALWAYS_ON_TOP, { enabled })
  },
}

contextBridge.exposeInMainWorld('aqua', bridge)
