import { app } from 'electron'
import { createOverlayWindow } from './window'
import { registerIpcHandlers } from './ipc'

app.whenReady().then(() => {
  const win = createOverlayWindow()
  registerIpcHandlers(win)
})

app.on('window-all-closed', () => {
  app.quit()
})
