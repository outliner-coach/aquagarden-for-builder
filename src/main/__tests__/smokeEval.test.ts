import { describe, it, expect } from 'vitest'
import {
  messageIsError,
  textMatchesError,
  evaluatePixels,
  evaluateSmoke,
  type ConsoleMsg,
  type SmokeHealth,
} from '../smokeEval'

const okHealth: SmokeHealth = { ready: true, fishActive: 18, errors: [], frames: 120 }
const okPixel = { sampled: 1000, opaqueRatio: 0.4, transparentRatio: 0.6, uniqueBuckets: 25, lumVariance: 2000, blank: false }

describe('messageIsError', () => {
  it('level 3 (console.error) is always an error', () => {
    expect(messageIsError({ level: 3, message: 'anything', sourceId: '', line: 0 })).toBe(true)
  })
  it('shader compile error at any level matches', () => {
    expect(messageIsError({ level: 2, message: 'WebGL: INVALID_OPERATION: useProgram: program not valid', sourceId: '', line: 0 })).toBe(true)
  })
  it('benign CSP security warning (level 2) is NOT an error', () => {
    const m: ConsoleMsg = { level: 2, message: 'Electron Security Warning (Insecure Content-Security-Policy)', sourceId: '', line: 0 }
    expect(messageIsError(m)).toBe(false)
  })
  it('info/log messages are not errors', () => {
    expect(messageIsError({ level: 1, message: 'starting', sourceId: '', line: 0 })).toBe(false)
  })
})

describe('textMatchesError', () => {
  it('catches THREE shader error and GLB load failure', () => {
    expect(textMatchesError("ERROR: 0:63: 'vUv' : undeclared identifier")).toBe(true)
    expect(textMatchesError('[fishAssets] clownfish 로드 실패')).toBe(true)
    expect(textMatchesError('THREE.WebGLProgram: Shader Error')).toBe(true)
  })
  it('ignores benign text', () => {
    expect(textMatchesError('[DIAG] FishSchool ready')).toBe(false)
  })
})

describe('evaluatePixels', () => {
  it('null bitmap → blank (capture 실패)', () => {
    const p = evaluatePixels(null, 0, 0)
    expect(p.blank).toBe(true)
  })
  it('uniform single-color opaque fill → blank', () => {
    const w = 40, h = 40
    const buf = new Uint8Array(w * h * 4)
    for (let i = 0; i < buf.length; i += 4) {
      buf[i] = 232; buf[i + 1] = 220; buf[i + 2] = 200; buf[i + 3] = 255 // cream, opaque
    }
    const p = evaluatePixels(buf, w, h, 1)
    expect(p.blank).toBe(true)
    expect(p.transparentRatio).toBe(0)
  })
  it('fully transparent → blank (no opaque content)', () => {
    const w = 40, h = 40
    const buf = new Uint8Array(w * h * 4) // all zero, alpha 0
    const p = evaluatePixels(buf, w, h, 1)
    expect(p.blank).toBe(true)
    expect(p.transparentRatio).toBe(1)
  })
  it('varied colors + transparency → not blank', () => {
    const w = 60, h = 60
    const buf = new Uint8Array(w * h * 4)
    for (let p = 0; p < w * h; p++) {
      const i = p * 4
      if (p % 2 === 0) {
        buf[i + 3] = 0 // transparent
      } else {
        buf[i] = (p * 7) % 256; buf[i + 1] = (p * 13) % 256; buf[i + 2] = (p * 29) % 256; buf[i + 3] = 255
      }
    }
    const stats = evaluatePixels(buf, w, h, 1)
    expect(stats.blank).toBe(false)
    expect(stats.transparentRatio).toBeGreaterThan(0.3)
    expect(stats.uniqueBuckets).toBeGreaterThan(3)
  })
})

describe('evaluateSmoke', () => {
  it('healthy scene passes', () => {
    const r = evaluateSmoke({ consoleMsgs: [], health: okHealth, pixel: okPixel, fatal: null })
    expect(r.pass).toBe(true)
    expect(r.failures).toEqual([])
  })

  it('shader compile error in console → fail (the regression that slipped through)', () => {
    const msgs: ConsoleMsg[] = [
      { level: 3, message: "THREE.WebGLProgram: Shader Error ... ERROR: 0:63: 'vUv' : undeclared identifier", sourceId: '', line: 0 },
      { level: 2, message: 'WebGL: INVALID_OPERATION: useProgram: program not valid', sourceId: '', line: 0 },
    ]
    const r = evaluateSmoke({ consoleMsgs: msgs, health: okHealth, pixel: okPixel, fatal: null })
    expect(r.pass).toBe(false)
    expect(r.failures.length).toBeGreaterThan(0)
  })

  it('benign CSP warning alone → pass', () => {
    const msgs: ConsoleMsg[] = [
      { level: 2, message: 'Electron Security Warning (Insecure Content-Security-Policy) ...', sourceId: '', line: 0 },
    ]
    const r = evaluateSmoke({ consoleMsgs: msgs, health: okHealth, pixel: okPixel, fatal: null })
    expect(r.pass).toBe(true)
  })

  it('renderer not ready → fail', () => {
    const r = evaluateSmoke({ consoleMsgs: [], health: { ...okHealth, ready: false }, pixel: okPixel, fatal: null })
    expect(r.pass).toBe(false)
    expect(r.failures.some((f) => f.includes('ready'))).toBe(true)
  })

  it('물고기 지형 관통 감지(terrainClips > 0) → fail', () => {
    const r = evaluateSmoke({
      consoleMsgs: [],
      health: { ...okHealth, terrainClips: 3 },
      pixel: okPixel,
      fatal: null,
    })
    expect(r.pass).toBe(false)
    expect(r.failures.some((f) => f.includes('지형 관통'))).toBe(true)
  })

  it('terrainClips 미보고(구버전 헬스) 또는 0 → pass (하위호환)', () => {
    const legacy = evaluateSmoke({ consoleMsgs: [], health: okHealth, pixel: okPixel, fatal: null })
    expect(legacy.pass).toBe(true)
    const zero = evaluateSmoke({
      consoleMsgs: [],
      health: { ...okHealth, terrainClips: 0 },
      pixel: okPixel,
      fatal: null,
    })
    expect(zero.pass).toBe(true)
  })

  it('no fish → fail', () => {
    const r = evaluateSmoke({ consoleMsgs: [], health: { ...okHealth, fishActive: 0 }, pixel: okPixel, fatal: null })
    expect(r.pass).toBe(false)
    expect(r.failures.some((f) => f.includes('물고기'))).toBe(true)
  })

  it('blank/uniform screen → fail', () => {
    const blankPixel = { ...okPixel, blank: true }
    const r = evaluateSmoke({ consoleMsgs: [], health: okHealth, pixel: blankPixel, fatal: null })
    expect(r.pass).toBe(false)
  })

  it('no transparent pixels → fail (투과 미보존)', () => {
    const opaqueAll = { ...okPixel, transparentRatio: 0 }
    const r = evaluateSmoke({ consoleMsgs: [], health: okHealth, pixel: opaqueAll, fatal: null })
    expect(r.pass).toBe(false)
    expect(r.failures.some((f) => f.includes('투명'))).toBe(true)
  })

  it('null health → fail', () => {
    const r = evaluateSmoke({ consoleMsgs: [], health: null, pixel: okPixel, fatal: null })
    expect(r.pass).toBe(false)
  })

  it('fatal error → fail', () => {
    const r = evaluateSmoke({ consoleMsgs: [], health: okHealth, pixel: okPixel, fatal: 'capturePage 실패' })
    expect(r.pass).toBe(false)
  })
})

describe('evaluateSmoke - 테마 리드백 (AQUA_SMOKE_THEME)', () => {
  it('requestedTheme 미지정(기존 스모크) → theme 필드가 없어도 영향 없음', () => {
    const r = evaluateSmoke({ consoleMsgs: [], health: okHealth, pixel: okPixel, fatal: null })
    expect(r.pass).toBe(true)
  })

  it('요청 없음 + health.theme 존재 → 여전히 pass(체크 자체가 스킵됨)', () => {
    const r = evaluateSmoke({
      consoleMsgs: [], health: { ...okHealth, theme: 'minimal' }, pixel: okPixel, fatal: null,
    })
    expect(r.pass).toBe(true)
  })

  it('요청 == health.theme(일치) → pass', () => {
    const r = evaluateSmoke({
      consoleMsgs: [], health: { ...okHealth, theme: 'kelp-forest' }, pixel: okPixel, fatal: null,
      requestedTheme: 'kelp-forest',
    })
    expect(r.pass).toBe(true)
  })

  it('요청 != health.theme(불일치) → fail', () => {
    const r = evaluateSmoke({
      consoleMsgs: [], health: { ...okHealth, theme: 'minimal' }, pixel: okPixel, fatal: null,
      requestedTheme: 'coral-reef',
    })
    expect(r.pass).toBe(false)
    expect(r.failures.some((f) => f.includes('테마') && f.includes('불일치'))).toBe(true)
  })

  it('유령 id 요청(훅이 무시해 health.theme이 그대로) → fail', () => {
    const r = evaluateSmoke({
      consoleMsgs: [], health: { ...okHealth, theme: 'minimal' }, pixel: okPixel, fatal: null,
      requestedTheme: 'atlantis',
    })
    expect(r.pass).toBe(false)
    expect(r.failures.some((f) => f.includes('atlantis'))).toBe(true)
  })

  it('요청은 있으나 health가 null → 헬스 부재 실패에 더해 테마 불일치도 실패 사유에 포함', () => {
    const r = evaluateSmoke({ consoleMsgs: [], health: null, pixel: okPixel, fatal: null, requestedTheme: 'minimal' })
    expect(r.pass).toBe(false)
    expect(r.failures.some((f) => f.includes('테마'))).toBe(true)
  })
})

describe('evaluateSmoke - 토큰 stale 리드백 (AQUA_SMOKE_TOKEN_STALE)', () => {
  const okToken = { enabled: true, state: 'ok' as const, fiveHourPct: 0.34, weeklyPct: 0.87 }
  const req = { fiveHour: 0.34, weekly: 0.87 }

  it('fresh 주입 + stale:false 리드백 → pass', () => {
    const r = evaluateSmoke({
      consoleMsgs: [], health: { ...okHealth, token: { ...okToken, stale: false } }, pixel: okPixel,
      fatal: null, requestedToken: req,
    })
    expect(r.pass).toBe(true)
  })

  // 회귀: 라이브 실패(마지막 성공값)인데 fresh로 읽히면 옛 값이 현재값처럼 보인다.
  it('fresh 주입인데 stale:true로 읽히면 → fail', () => {
    const r = evaluateSmoke({
      consoleMsgs: [], health: { ...okHealth, token: { ...okToken, stale: true } }, pixel: okPixel,
      fatal: null, requestedToken: req,
    })
    expect(r.pass).toBe(false)
    expect(r.failures.some((f) => f.includes('stale'))).toBe(true)
  })

  it('stale 요청(AQUA_SMOKE_TOKEN_STALE) + stale:true 리드백 → pass', () => {
    const r = evaluateSmoke({
      consoleMsgs: [], health: { ...okHealth, token: { ...okToken, stale: true } }, pixel: okPixel,
      fatal: null, requestedToken: req, requestedTokenStale: true,
    })
    expect(r.pass).toBe(true)
  })

  it('stale 요청인데 fresh로 읽히면 → fail(훅이 무시된 증거)', () => {
    const r = evaluateSmoke({
      consoleMsgs: [], health: { ...okHealth, token: { ...okToken, stale: false } }, pixel: okPixel,
      fatal: null, requestedToken: req, requestedTokenStale: true,
    })
    expect(r.pass).toBe(false)
    expect(r.failures.some((f) => f.includes('stale'))).toBe(true)
  })

  it('토큰 미주입 모드에선 stale 게이트를 적용하지 않는다', () => {
    const r = evaluateSmoke({
      consoleMsgs: [],
      health: { ...okHealth, token: { enabled: true, state: 'unavailable', fiveHourPct: null, weeklyPct: null } },
      pixel: okPixel, fatal: null, requestedToken: null,
    })
    expect(r.pass).toBe(true)
  })
})
