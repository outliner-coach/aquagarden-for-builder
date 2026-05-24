import * as THREE from 'three'
import type { SceneEntity } from '../core/SceneRoot'
import { WATER, LIGHT } from '../../shared/config'

const SHAFT_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const SHAFT_FRAG = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  // 수직 그라디언트: 위(v=1) 밝고 아래(v=0) 부드럽게 사라짐
  float gradient = smoothstep(0.0, 0.65, vUv.y);
  // 수평 벨 커브: 가운데 밝고 가장자리 사라짐
  float hDist = abs(vUv.x - 0.5) * 2.0;
  float horizontal = 1.0 - hDist * hDist;
  // 2중 드리프트: 주파수가 다른 두 사인파로 유기적 일렁임
  float drift = 0.82 + 0.12 * sin(uTime + vUv.y * 2.0)
              + 0.06 * sin(uTime * 0.7 + vUv.y * 3.5);
  float alpha = gradient * horizontal * drift * uOpacity;
  gl_FragColor = vec4(uColor, alpha);
}
`

export class LightShafts implements SceneEntity {
  readonly object3d: THREE.Group
  private _time = 0
  private readonly _materials: THREE.ShaderMaterial[] = []
  private readonly _geometries: THREE.PlaneGeometry[] = []
  private _brightness01: number = LIGHT.default01

  constructor() {
    this.object3d = new THREE.Group()

    const cfg = WATER.shaft
    const count = cfg.xPositions.length

    for (let i = 0; i < count; i++) {
      const width = cfg.widths[i] ?? cfg.widths[0]
      const geo = new THREE.PlaneGeometry(width, cfg.height)
      const mat = new THREE.ShaderMaterial({
        vertexShader: SHAFT_VERT,
        fragmentShader: SHAFT_FRAG,
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: cfg.baseOpacity * this._brightness01 },
          uColor: { value: new THREE.Vector3(...cfg.color) },
        },
        // 색은 가산(글로우)하되, 알파도 누적해야 투명 캔버스에서 OS 합성 시 보인다.
        // (blendSrcAlpha=Zero면 알파가 0으로 남아 premultiplied 합성에서 사라짐 — 버그였음)
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneFactor,
        blendSrcAlpha: THREE.OneFactor,
        blendDstAlpha: THREE.OneFactor,
        depthWrite: false,
        transparent: true,
        side: THREE.DoubleSide,
      })

      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(
        cfg.xPositions[i] ?? 0,
        cfg.topY - cfg.height / 2,
        cfg.zPos,
      )
      mesh.rotation.y = cfg.angles[i] ?? 0

      this.object3d.add(mesh)
      this._materials.push(mat)
      this._geometries.push(geo)
    }
  }

  setBrightness01(b01: number): void {
    this._brightness01 = Math.max(0, Math.min(1, b01))
    const opacity = WATER.shaft.baseOpacity * this._brightness01
    for (const mat of this._materials) {
      mat.uniforms.uOpacity.value = opacity
    }
  }

  update(dt: number): void {
    this._time += dt * WATER.shaft.driftSpeed
    for (const mat of this._materials) {
      mat.uniforms.uTime.value = this._time
    }
  }

  dispose(): void {
    for (const mat of this._materials) {
      mat.dispose()
    }
    for (const geo of this._geometries) {
      geo.dispose()
    }
    this._materials.length = 0
    this._geometries.length = 0
  }
}
