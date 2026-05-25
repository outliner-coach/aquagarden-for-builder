import { app, Menu, Tray, nativeImage, screen, type BrowserWindow } from 'electron'
import { WINDOW } from '../shared/config'

// 모듈 레벨 참조 — GC로 트레이가 사라지지 않게 유지.
let tray: Tray | null = null

/**
 * 트레이 아이콘 — 생성한 비트맵(에셋 파일 불필요)의 채워진 원.
 * mac은 템플릿 이미지(검정+알파)로 만들어 메뉴바 명암에 맞게 자동 틴트, 그 외엔 청록 원.
 * (빈 이미지+setTitle 방식은 일부 macOS에서 메뉴바에 안 보였음.)
 */
function buildIcon(): Electron.NativeImage {
  const size = 16
  const r = 6.5
  const c = (size - 1) / 2
  const isMac = process.platform === 'darwin'
  const buf = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 4
      const inside = (x - c) * (x - c) + (y - c) * (y - c) <= r * r
      // BGRA. mac 템플릿은 검정+알파, 그 외는 청록.
      buf[o] = isMac ? 0 : 0xc8 // B
      buf[o + 1] = isMac ? 0 : 0xd0 // G
      buf[o + 2] = isMac ? 0 : 0x40 // R
      buf[o + 3] = inside ? 0xff : 0 // A (원 모양)
    }
  }
  const img = nativeImage.createFromBitmap(buf, { width: size, height: size })
  if (isMac) img.setTemplateImage(true)
  return img
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
