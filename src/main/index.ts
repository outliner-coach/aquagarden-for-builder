import { app } from 'electron'
import { createOverlayWindow } from './window'
import { registerIpcHandlers } from './ipc'

const SMOKE = !!process.env['AQUA_SMOKE']

app.whenReady().then(async () => {
  if (SMOKE) {
    // headless 런타임 eval: 숨김 창으로 렌더 후 검증·종료
    const win = createOverlayWindow({ show: false })
    const { runSmoke } = await import('./smoke')
    await runSmoke(win)
    return
  }

  const win = createOverlayWindow()
  registerIpcHandlers(win)
})

app.on('window-all-closed', () => {
  app.quit()
})
