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

/** "r,g,b"(0-255) 환경변수를 BGR 튜플로 파싱. 실패 시 기본 짙은 회색. */
function parseBgBgr(env: string | undefined): [number, number, number] {
  const def: [number, number, number] = [46, 40, 38] // BGR of [38,40,46]
  if (!env) return def
  const parts = env.split(',').map((s) => Number(s.trim()))
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return def
  const [r, g, b] = parts
  return [b, g, r]
}

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

  // 선택: 특별 개체(대형 어종) 렌더 검증용. 실제 칩 버튼을 클릭해
  // onEnabledFeaturesChange→setEnabledFeatures→스폰 경로를 그대로 태운 뒤 추가 settle.
  if (process.env['AQUA_SMOKE_FEATURES'] === '1') {
    await win.webContents
      .executeJavaScript(
        `(() => {
          const chips = document.querySelectorAll('.cp__feature-chip');
          chips.forEach((c) => { if (c.getAttribute('aria-pressed') !== 'true') { c.click(); } });
          return chips.length;
        })()`,
      )
      .catch(() => 0)
    await delay(2000)
  }

  // 선택: 격리 캡처용 개체수/밝기/투명도 슬라이더 구동. 슬라이더 DOM 순서 = [어종수, 밝기, 투명도, 줌].
  // 가운데 까만 선(모래 지평선 등) 아티팩트는 고밝기+밝은 배경에서만 드러나므로 이 노브로 재현한다.
  const fishEnv = process.env['AQUA_SMOKE_FISH']
  const brightnessEnv = process.env['AQUA_SMOKE_BRIGHTNESS']
  const transparencyEnv = process.env['AQUA_SMOKE_TRANSPARENCY']
  if (fishEnv !== undefined || brightnessEnv !== undefined || transparencyEnv !== undefined) {
    await win.webContents
      .executeJavaScript(
        `(() => {
          const sliders = document.querySelectorAll('.cp__slider');
          const drive = (idx, val) => {
            const el = sliders[idx];
            if (!el) return false;
            el.value = String(val);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
          };
          const f = ${fishEnv !== undefined ? Number(fishEnv) : 'null'};
          const b = ${brightnessEnv !== undefined ? Number(brightnessEnv) : 'null'};
          const t = ${transparencyEnv !== undefined ? Number(transparencyEnv) : 'null'};
          const r = { count: sliders.length, fish: false, brightness: false, transparency: false };
          if (f !== null) r.fish = drive(0, f);
          if (b !== null) r.brightness = drive(1, b);
          if (t !== null) r.transparency = drive(2, t);
          return JSON.stringify(r);
        })()`,
      )
      .catch(() => '')
    // 개체수 스폰은 분할(async) 처리라 여유를 더 둔다.
    await delay(fishEnv !== undefined ? 3000 : 1200)
  }

  // 선택: 시간대 반응(무드) 조명 렌더 검증. 강제 시각(AQUA_SMOKE_MOOD_HOUR, 기본 20=저녁 따뜻)을
  // 주입하고 '시간대 반응' 토글을 켜(onMoodReactiveChange→applyMood→setMood 경로) 틴트를 캡처한다.
  let moodHook: string | null = null
  if (process.env['AQUA_SMOKE_MOOD'] === '1') {
    const hour = Number(process.env['AQUA_SMOKE_MOOD_HOUR'] ?? 20)
    await win.webContents
      .executeJavaScript(
        `(() => {
          window.__AQUA_MOOD_HOUR__ = ${Number.isFinite(hour) ? hour : 20};
          const t = document.querySelector('input[aria-label="시간대 반응"]');
          if (!t) return false;
          // 이미 ON이어도(영속 복원 등) 강제 시각이 반영되도록 off→on으로 재적용한다.
          if (t.checked) { t.checked = false; t.dispatchEvent(new Event('change', { bubbles: true })); }
          t.checked = true; t.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        })()`,
      )
      .catch(() => false)
    // 무드는 MOOD.transitionSeconds에 걸쳐 점진 수렴하므로 전환 완료 후 캡처한다.
    await delay(3000)
    // 훅이 실제로 걸렸는지 리드백(토글 상태·강제 시각) — 조용한 실패로 "무변화 캡처"가 나오는 것 방지.
    moodHook = await win.webContents
      .executeJavaScript(
        `(() => {
          const t = document.querySelector('input[aria-label="시간대 반응"]');
          return JSON.stringify({ checked: !!(t && t.checked), hour: window.__AQUA_MOOD_HOUR__ ?? null });
        })()`,
      )
      .catch((e: unknown) => `error: ${String(e)}`)
  }

  // 선택: 컨트롤 패널을 펼친 상태로 캡처(패널 UI 시각 검증용).
  // smoke 모드는 IPC 핸들러를 등록하지 않아 창 성장 요청(setWindowSize)이 no-op이다.
  // → 패널을 DOM에서 직접 표시하고, 캡처가 잘리지 않게 창 높이를 키운다(smoke 전용 계측).
  if (process.env['AQUA_SMOKE_OPEN_PANEL'] === '1') {
    await win.webContents
      .executeJavaScript(
        `(() => {
          const btn = document.querySelector('.cp__btn');
          if (btn) btn.click();
          const panel = document.querySelector('.cp__panel');
          if (panel) {
            panel.style.opacity = '1';
            panel.style.pointerEvents = 'auto';
            panel.style.transform = 'none';
          }
          return !!panel;
        })()`,
      )
      .catch(() => false)
    const b = win.getBounds()
    win.setBounds({ x: b.x, y: b.y, width: b.width, height: Math.max(b.height, 700) })
    await delay(1500)
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
    const composited = compositeOverBackground(bitmap, parseBgBgr(process.env['AQUA_SMOKE_BG'])) // 데스크톱 대용 배경(기본 짙은 회색, AQUA_SMOKE_BG로 override)
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
    ...(moodHook !== null ? { moodHook } : {}),
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
