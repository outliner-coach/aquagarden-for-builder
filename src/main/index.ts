import { app } from 'electron'
import { createOverlayWindow } from './window'

app.whenReady().then(() => {
  createOverlayWindow()
})

app.on('window-all-closed', () => {
  app.quit()
})
