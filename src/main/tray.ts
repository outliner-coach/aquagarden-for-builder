import { app, Menu, Tray, nativeImage, screen, type BrowserWindow } from 'electron'
import { WINDOW } from '../shared/config'

// 모듈 레벨 참조 — GC로 트레이가 사라지지 않게 유지.
let tray: Tray | null = null

/** 트레이 아이콘. mac은 메뉴바에 이모지 제목을 쓰므로 빈 이미지, 그 외엔 단색 비트맵. */
function buildIcon(): Electron.NativeImage {
  if (process.platform === 'darwin') return nativeImage.createEmpty()
  const size = 16
  const buf = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    const o = i * 4
    buf[o] = 0xc8 // B
    buf[o + 1] = 0xd0 // G
    buf[o + 2] = 0x40 // R → 청록 계열
    buf[o + 3] = 0xff // A
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size })
}

/** 창을 현재 디스플레이 상단 전폭(기본 위치)으로 되돌리고 표시 — 버튼을 잃었을 때 복구용. */
function resetPosition(win: BrowserWindow): void {
  const area = screen.getDisplayMatching(win.getBounds()).workArea
  win.setBounds({ x: area.x, y: area.y, width: area.width, height: WINDOW.height })
  if (!win.isVisible()) win.show()
}

/**
 * 메뉴바 트레이를 만든다. 플로팅 버튼을 잃거나 숨겼을 때 보이기/복구/종료 경로를 제공.
 * (오버레이는 프레임·dock 메뉴가 없어 트레이가 유일한 안전한 제어 수단이다.)
 */
export function createTray(win: BrowserWindow): Tray {
  tray = new Tray(buildIcon())
  if (process.platform === 'darwin') tray.setTitle('🐠')
  tray.setToolTip('Aquagarden')

  const rebuild = (): void => {
    const menu = Menu.buildFromTemplate([
      {
        label: win.isVisible() ? '수족관 숨기기' : '수족관 보이기',
        click: () => {
          if (win.isVisible()) win.hide()
          else win.show()
          rebuild()
        },
      },
      { label: '위치 초기화(상단으로)', click: () => resetPosition(win) },
      { type: 'separator' },
      {
        label: '로그인 시 시작',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
      },
      { type: 'separator' },
      { label: '종료', click: () => app.quit() },
    ])
    tray!.setContextMenu(menu)
  }

  rebuild()
  win.on('show', rebuild)
  win.on('hide', rebuild)
  return tray
}
