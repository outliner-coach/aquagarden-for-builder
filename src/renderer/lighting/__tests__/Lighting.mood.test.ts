import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { Lighting } from '../Lighting'
import { IDENTITY_MOOD } from '../moodHelpers'
import { brightnessToIntensity } from '../lightingHelpers'
import { LIGHT } from '../../../shared/config'

function dirLight(l: Lighting): THREE.DirectionalLight {
  const d = l.object3d.children.find((c) => (c as THREE.DirectionalLight).isDirectionalLight)
  return d as THREE.DirectionalLight
}

describe('Lighting 무드 합성', () => {
  it('항등 무드는 사용자 밝기 그대로 + 흰색(현행 동일)', () => {
    const scene = new THREE.Scene()
    const lighting = new Lighting(scene)
    lighting.setBrightness01(1)
    lighting.setMood(IDENTITY_MOOD)

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
    lighting.setMood(IDENTITY_MOOD)

    const d = dirLight(lighting)
    expect(d.color.r).toBeCloseTo(1)
    expect(d.color.g).toBeCloseTo(1)
    expect(d.color.b).toBeCloseTo(1)
    // 사용자 밝기(0.8)는 유지되어야 한다.
    expect(d.intensity).toBeCloseTo(brightnessToIntensity(0.8, LIGHT.minIntensity, LIGHT.maxIntensity))
  })
})
