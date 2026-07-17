import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { Lighting } from '../Lighting'
import { IDENTITY_MOOD } from '../moodHelpers'
import { brightnessToIntensity } from '../lightingHelpers'
import { LIGHT, MOOD } from '../../../shared/config'

function dirLight(l: Lighting): THREE.DirectionalLight {
  const d = l.object3d.children.find((c) => (c as THREE.DirectionalLight).isDirectionalLight)
  return d as THREE.DirectionalLight
}

/** 전환을 끝까지 수렴시킨다(전환 시간 이상 dt 1회 = alpha 1). */
function settle(l: Lighting): void {
  l.update(MOOD.transitionSeconds + 1)
}

describe('Lighting 무드 합성', () => {
  it('항등 무드는 사용자 밝기 그대로 + 흰색(현행 동일)', () => {
    const scene = new THREE.Scene()
    const lighting = new Lighting(scene)
    lighting.setBrightness01(1)
    lighting.setMood(IDENTITY_MOOD)
    settle(lighting)

    const d = dirLight(lighting)
    expect(d.intensity).toBeCloseTo(brightnessToIntensity(1, LIGHT.minIntensity, LIGHT.maxIntensity))
    expect(d.color.r).toBeCloseTo(1)
    expect(d.color.g).toBeCloseTo(1)
    expect(d.color.b).toBeCloseTo(1)
  })

  it('무드 배율은 사용자 밝기에 곱해진다(밝기 1 × 0.5 → eff 0.5)', () => {
    const scene = new THREE.Scene()
    const lighting = new Lighting(scene)
    lighting.setBrightness01(1)
    lighting.setMood({ brightnessScale: 0.5, tint: [1, 1, 1] })
    settle(lighting)

    const d = dirLight(lighting)
    expect(d.intensity).toBeCloseTo(brightnessToIntensity(0.5, LIGHT.minIntensity, LIGHT.maxIntensity))
    // 환경맵 강도도 eff로 스케일된다.
    expect(scene.environmentIntensity).toBeGreaterThan(0)
  })

  it('따뜻한 틴트는 광원 색에 반영된다(R ≥ G ≥ B)', () => {
    const scene = new THREE.Scene()
    const lighting = new Lighting(scene)
    lighting.setBrightness01(1)
    lighting.setMood({ brightnessScale: 1, tint: [1, 0.82, 0.68] })
    settle(lighting)

    const d = dirLight(lighting)
    expect(d.color.r).toBeGreaterThanOrEqual(d.color.g)
    expect(d.color.g).toBeGreaterThanOrEqual(d.color.b)
    expect(d.color.r).toBeCloseTo(1)
  })

  it('무드를 항등으로 되돌리면 색이 흰색으로 복귀', () => {
    const scene = new THREE.Scene()
    const lighting = new Lighting(scene)
    lighting.setBrightness01(0.8)
    lighting.setMood({ brightnessScale: 0.7, tint: [1, 0.8, 0.6] })
    settle(lighting)
    lighting.setMood(IDENTITY_MOOD)
    settle(lighting)

    const d = dirLight(lighting)
    expect(d.color.r).toBeCloseTo(1)
    expect(d.color.g).toBeCloseTo(1)
    expect(d.color.b).toBeCloseTo(1)
    // 사용자 밝기(0.8)는 유지되어야 한다.
    expect(d.intensity).toBeCloseTo(brightnessToIntensity(0.8, LIGHT.minIntensity, LIGHT.maxIntensity))
  })
})

describe('Lighting 무드 전환(점진 수렴)', () => {
  it('setMood 직후 한 프레임(작은 dt)에는 목표에 도달하지 않는다 — 부드러운 전환', () => {
    const scene = new THREE.Scene()
    const lighting = new Lighting(scene)
    lighting.setBrightness01(1)
    settle(lighting)
    const before = dirLight(lighting).intensity

    lighting.setMood({ brightnessScale: 0.4, tint: [0.55, 0.72, 1] })
    lighting.update(0.033) // 한 프레임
    const after = dirLight(lighting).intensity
    const target = brightnessToIntensity(0.4, LIGHT.minIntensity, LIGHT.maxIntensity)

    expect(after).toBeLessThan(before) // 움직이기 시작했고
    expect(after).toBeGreaterThan(target) // 아직 목표 전
  })

  it('프레임을 반복하면 목표로 수렴하고, 수렴 후엔 값이 흔들리지 않는다', () => {
    const scene = new THREE.Scene()
    const lighting = new Lighting(scene)
    lighting.setBrightness01(1)
    lighting.setMood({ brightnessScale: 0.4, tint: [0.55, 0.72, 1] })
    for (let i = 0; i < 300; i++) lighting.update(0.033) // ~10초
    const d = dirLight(lighting)
    const target = brightnessToIntensity(0.4, LIGHT.minIntensity, LIGHT.maxIntensity)
    expect(d.intensity).toBeCloseTo(target, 3)
    expect(d.color.r).toBeCloseTo(0.55, 2)

    const settled = d.intensity
    lighting.update(0.033)
    expect(d.intensity).toBe(settled)
  })
})
