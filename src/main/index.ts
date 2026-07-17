import { app, globalShortcut, session } from 'electron'
import { createOverlayWindow } from './window'
import { registerIpcHandlers } from './ipc'
import { SHORTCUTS } from '../shared/config'

const SMOKE = !!process.env['AQUA_SMOKE']

app.whenReady().then(async () => {
  if (SMOKE) {
    // headless 런타임 eval: 숨김 창으로 렌더 후 검증·종료.
    // 사용자의 영속 상태(localStorage)를 물려받으면 캡처가 세션마다 달라져(개체수·투명도·무드 등)
    // 재현성이 깨진다 — 항상 기본 설정으로 평가하도록 저장소를 비운다.
    await session.defaultSession.clearStorageData({ storages: ['localstorage'] })
    const win = createOverlayWindow({ show: false })
    const { runSmoke } = await import('./smoke')
    await runSmoke(win)
    return
  }

  const win = createOverlayWindow()
  registerIpcHandlers(win)
  const { createTray, resetPosition } = await import('./tray')
  createTray(win)

  // 복구 전역 단축키 — 트레이 아이콘이 메뉴바 혼잡(노치 맥북)으로 안 보일 때의 최후 경로.
  // 창을 상단 전폭으로 되돌리고 표시한다. 등록 실패(다른 앱 선점)는 치명적이지 않으므로 무시.
  const ok = globalShortcut.register(SHORTCUTS.recovery, () => resetPosition(win))
  if (!ok) console.warn(`[shortcut] ${SHORTCUTS.recovery} 등록 실패(다른 앱이 사용 중)`)
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  app.quit()
})
