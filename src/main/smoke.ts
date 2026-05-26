/**
 * 스모크 하니스 — headless 런타임 eval.
 * AQUA_SMOKE=1 일 때 main에서 호출된다. 실제 renderer를 숨김 창으로 띄워
 *  - 콘솔(셰이더 에러·useProgram 무효·WebGL 경고 등) 수집
 *  - window.__AQUA_HEALTH__ (ready/fishActive/errors/frames) 폴링
 *  - capturePage 스크린샷 저장 + 픽셀 분석(블랭크/단색 감지)
 * 결과를 JSON 리포트로 쓰고 종료코드로 합불을 알린다(0=pass, 1=fail).
 *
 * 환경변수:
 *   AQUA_SMOKE_REPORT  리포트 JSON 경로 (기본 ./eval-report.json)
 *   AQUA_SMOKE_SHOT    스크린샷 PNG 경로 (기본 ./eval-screenshot.png)
 *   AQUA_SMOKE_READY_TIMEOUT_MS  ready 대기 한계 (기본 20000)
 *   AQUA_SMOKE_SETTLE_MS         ready 이후 추가 렌더 대기 (기본 2500)
 */
import { app, nativeImage } from 'electron'
import type { BrowserWindow } from 'electron'
import { writeFileSync } from 'fs'
import {
  evaluatePixels,
  evaluateSmoke,
  type ConsoleMsg,
  type SmokeHealth,
} from './smokeEval'

const REPORT = process.env['AQUA_SMOKE_REPORT'] || 'eval-report.json'
const SHOT = process.env['AQUA_SMOKE_SHOT'] || 'eval-screenshot.png'
const READY_TIMEOUT = Number(process.env['AQUA_SMOKE_READY_TIMEOUT_MS'] || 20000)
const SETTLE = Number(process.env['AQUA_SMOKE_SETTLE_MS'] || 2500)

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** BGRA 비트맵을 불투명 배경색(BGR) 위에 알파 합성한다. 반환도 BGRA(알파=255). */
function compositeOverBackground(bitmap: Buffer, bgBgr: [number, number, number]): Buffer {
  const out = Buffer.from(bitmap)
  const [bb, bg, br] = bgBgr
  for (let i = 0; i < out.length; i += 4) {
    const a = bitmap[i + 3] / 255
    out[i] = Math.round(bitmap[i] * a + bb * (1 - a))
    out[i + 1] = Math.round(bitmap[i + 1] * a + bg * (1 - a))
    out[i + 2] = Math.round(bitmap[i + 2] * a + br * (1 - a))
    out[i + 3] = 255
  }
  return out
}

export async function runSmoke(win: BrowserWindow): Promise<void> {
  // 하드 워치독: 어떤 경우에도 행(hang) 없이 종료시킨다.
  const watchdogMs = READY_TIMEOUT + SETTLE + 15000
  const watchdog = setTimeout(() => {
    try {
      writeFileSync(REPORT, JSON.stringify({ pass: false, failures: ['watchdog timeout — smoke가 시간 내 완료되지 못함'] }, null, 2))
    } catch {
      /* noop */
    }
    app.exit(1)
  }, watchdogMs)
  watchdog.unref?.()

  const consoleMsgs: ConsoleMsg[] = []

  win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    consoleMsgs.push({ level, message, sourceId, line })
  })
  win.webContents.on('render-process-gone', (_e, details) => {
    consoleMsgs.push({ level: 3, message: `render-process-gone: ${JSON.stringify(details)}`, sourceId: '', line: 0 })
  })

  let fatal: string | null = null
  try {
    await waitForReady(win)
    await delay(SETTLE)
  } catch (e) {
    fatal = String(e)
  }

  // 선택: 특별 개체(대형 어종) 렌더 검증용. 실제 토글 체크박스를 구동해
  // onEnabledFeaturesChange→setEnabledFeatures→스폰 경로를 그대로 태운 뒤 추가 settle.
  if (process.env['AQUA_SMOKE_FEATURES'] === '1') {
    await win.webContents
      .executeJavaScript(
        `(() => {
          const boxes = document.querySelectorAll('.cp__feature-body input[type=checkbox]');
          boxes.forEach((b) => { if (!b.checked) { b.checked = true; b.dispatchEvent(new Event('change', { bubbles: true })); } });
          return boxes.length;
        })()`,
      )
      .catch(() => 0)
    await delay(2000)
  }

  const health = await readHealth(win)

  // 스크린샷 + 픽셀 분석
  // 픽셀 분석은 원본 알파(투명도 측정)로, 저장 스크린샷은 데스크톱 대용 배경 위에
  // 합성한다. (투명 PNG를 그대로 비전이 보면 투명영역이 흰/크림으로 평탄화돼 오판하므로)
  let pixel = evaluatePixels(null, 0, 0)
  try {
    const img = await win.webContents.capturePage()
    const size = img.getSize()
    const bitmap = img.toBitmap() // BGRA (원본 알파 보존)
    pixel = evaluatePixels(bitmap, size.width, size.height)
    const composited = compositeOverBackground(bitmap, [38, 40, 46]) // 짙은 회색 = 데스크톱 대용
    const out = nativeImage.createFromBitmap(composited, { width: size.width, height: size.height })
    writeFileSync(SHOT, out.toPNG())
  } catch (e) {
    fatal = (fatal ? fatal + '; ' : '') + `capturePage 실패: ${String(e)}`
  }

  const result = evaluateSmoke({ consoleMsgs, health, pixel, fatal })
  const report = {
    pass: result.pass,
    failures: result.failures,
    health,
    pixel,
    screenshot: SHOT,
    errorConsole: consoleMsgs.filter((m) => m.level >= 2).slice(0, 50),
  }
  writeFileSync(REPORT, JSON.stringify(report, null, 2))

  // eslint-disable-next-line no-console
  console.log(`[smoke] pass=${result.pass} failures=${result.failures.length} → ${REPORT}`)
  clearTimeout(watchdog)
  app.exit(result.pass ? 0 : 1)
}

async function waitForReady(win: BrowserWindow): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT
  while (Date.now() < deadline) {
    const ready = await win.webContents
      .executeJavaScript('!!(window.__AQUA_HEALTH__ && window.__AQUA_HEALTH__.ready)')
      .catch(() => false)
    if (ready) return
    await delay(300)
  }
  throw new Error(`ready 신호 타임아웃 (${READY_TIMEOUT}ms)`)
}

async function readHealth(win: BrowserWindow): Promise<SmokeHealth> {
  return win.webContents
    .executeJavaScript('window.__AQUA_HEALTH__ ? JSON.parse(JSON.stringify(window.__AQUA_HEALTH__)) : null')
    .catch(() => null) as Promise<SmokeHealth>
}
