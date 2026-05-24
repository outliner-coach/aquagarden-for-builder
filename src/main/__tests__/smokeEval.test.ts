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
