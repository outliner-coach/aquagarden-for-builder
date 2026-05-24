import * as THREE from 'three'
import type { SceneEntity } from '../core/SceneRoot'
import { advanceTime } from './aquascapeHelpers'
import { AQUASCAPE } from '../../shared/config'

/* ── Grass vertex shader: sin-based sway, tip only ── */
const GRASS_VERT = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 pos = position;
    float h = uv.y;
    float phase = pos.x * 3.0 + pos.z * 2.5;
    pos.x += sin(uTime * 1.2 + phase) * h * h * 0.08;
    pos.z += cos(uTime * 0.9 + phase * 0.7) * h * h * 0.04;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const GRASS_FRAG = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vec3 base = vec3(0.22, 0.48, 0.18);
    vec3 tip  = vec3(0.35, 0.68, 0.28);
    vec3 col  = mix(base, tip, vUv.y);
    gl_FragColor = vec4(col, 0.9);
  }
`

/* ── Layout constants ── */
const SAND_COLOR = 0xe8dcc8
const ROCK_COLOR = 0x7a7570
const GLASS_EDGE_OPACITY = 0.12
const BLADE_HEIGHT = 0.3

const CLUSTERS: readonly [x: number, z: number, count: number, radius: number][] = [
  [-8,  -2.5, 25, 0.6],
  [-3,  -3.0, 30, 0.7],
  [ 1,  -2.0, 20, 0.5],
  [ 5,  -2.8, 28, 0.65],
  [10,  -3.5, 22, 0.55],
  [14,  -2.2, 18, 0.5],
]

const ROCKS: readonly [x: number, z: number, scale: number][] = [
  [-5,  -2.0, 0.15],
  [ 3,  -2.5, 0.20],
  [ 8,  -3.0, 0.12],
]

const PEBBLES: readonly [x: number, z: number, scale: number][] = [
  [-6,  -2.2, 0.06],
  [ 0,  -2.8, 0.05],
  [ 6,  -2.4, 0.07],
  [12,  -3.0, 0.05],
]

/* ── Grass blade geometry builder ── */
function createGrassClusterGeometry(
  bladeCount: number,
  clusterRadius: number,
  bladeHeight: number,
): THREE.BufferGeometry {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (let i = 0; i < bladeCount; i++) {
    const angle = (i / bladeCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.8
    const dist = Math.random() * clusterRadius
    const cx = Math.cos(angle) * dist
    const cz = Math.sin(angle) * dist
    const h = bladeHeight * (0.5 + Math.random() * 0.5)
    const halfW = 0.015 + Math.random() * 0.015

    const base = i * 3

    // base left
    positions.push(cx - halfW, 0, cz)
    uvs.push(0, 0)
    // base right
    positions.push(cx + halfW, 0, cz)
    uvs.push(1, 0)
    // tip
    positions.push(
      cx + (Math.random() - 0.5) * 0.01,
      h,
      cz + (Math.random() - 0.5) * 0.01,
    )
    uvs.push(0.5, 1)

    indices.push(base, base + 1, base + 2)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

/* ── Disposable tracking ── */
interface Disposable {
  geometry?: THREE.BufferGeometry
  material?: THREE.Material
}

export class Aquascape implements SceneEntity {
  readonly object3d: THREE.Group
  private _time = 0
  private readonly _grassMaterials: THREE.ShaderMaterial[] = []
  private readonly _disposables: Disposable[] = []

  constructor() {
    this.object3d = new THREE.Group()
    this._buildSand()
    this._buildGrass()
    this._buildRocks()
    this._buildGlassEdge()
  }

  update(dt: number): void {
    this._time = advanceTime(this._time, dt)
    for (const mat of this._grassMaterials) {
      mat.uniforms.uTime.value = this._time
    }
  }

  dispose(): void {
    for (const d of this._disposables) {
      d.geometry?.dispose()
      d.material?.dispose()
    }
    this._disposables.length = 0
    this._grassMaterials.length = 0
  }

  /* ── Sand floor ── */
  private _buildSand(): void {
    const geo = new THREE.PlaneGeometry(200, 14)
    geo.rotateX(-Math.PI / 2)
    const mat = new THREE.MeshStandardMaterial({
      color: SAND_COLOR,
      roughness: 0.9,
      metalness: 0,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(0, AQUASCAPE.sandY, -4)
    this.object3d.add(mesh)
    this._disposables.push({ geometry: geo, material: mat })
  }

  /* ── Grass clusters with vertex shader sway ── */
  private _buildGrass(): void {
    for (const [x, z, count, radius] of CLUSTERS) {
      const geo = createGrassClusterGeometry(count, radius, BLADE_HEIGHT)
      const mat = new THREE.ShaderMaterial({
        vertexShader: GRASS_VERT,
        fragmentShader: GRASS_FRAG,
        uniforms: { uTime: { value: 0 } },
        side: THREE.DoubleSide,
        transparent: true,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(x, AQUASCAPE.sandY + 0.005, z)
      this.object3d.add(mesh)
      this._grassMaterials.push(mat)
      this._disposables.push({ geometry: geo, material: mat })
    }
  }

  /* ── Rocks & pebbles ── */
  private _buildRocks(): void {
    const rockMat = new THREE.MeshStandardMaterial({ color: ROCK_COLOR, roughness: 0.8, metalness: 0 })

    for (const [x, z, scale] of ROCKS) {
      const geo = new THREE.DodecahedronGeometry(scale, 0)
      const mesh = new THREE.Mesh(geo, rockMat)
      mesh.position.set(x, AQUASCAPE.sandY + scale * 0.5, z)
      mesh.rotation.set(Math.random(), Math.random(), Math.random())
      this.object3d.add(mesh)
      this._disposables.push({ geometry: geo })
    }

    for (const [x, z, scale] of PEBBLES) {
      const geo = new THREE.SphereGeometry(scale, 4, 3)
      const mesh = new THREE.Mesh(geo, rockMat)
      mesh.position.set(x, AQUASCAPE.sandY + scale * 0.3, z)
      this.object3d.add(mesh)
      this._disposables.push({ geometry: geo })
    }

    this._disposables.push({ material: rockMat })
  }

  /* ── Subtle glass edge highlights ── */
  private _buildGlassEdge(): void {
    const topY = 2.2
    const bottomY = AQUASCAPE.sandY + 0.05
    const halfW = 30

    const mat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: GLASS_EDGE_OPACITY,
      depthWrite: false,
    })

    const topGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-halfW, topY, 0),
      new THREE.Vector3(halfW, topY, 0),
    ])
    this.object3d.add(new THREE.Line(topGeo, mat))
    this._disposables.push({ geometry: topGeo })

    const bottomGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-halfW, bottomY, 0),
      new THREE.Vector3(halfW, bottomY, 0),
    ])
    this.object3d.add(new THREE.Line(bottomGeo, mat))
    this._disposables.push({ geometry: bottomGeo, material: mat })
  }
}
