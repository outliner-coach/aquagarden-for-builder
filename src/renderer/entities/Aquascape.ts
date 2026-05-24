import * as THREE from 'three'
import type { SceneEntity } from '../core/SceneRoot'
import { advanceTime, generatePlantInstances } from './aquascapeHelpers'
import type { PlantSpeciesParams } from './aquascapeHelpers'
import { AQUASCAPE, PLANT } from '../../shared/config'

/* ── Grass card vertex shader: height-weighted sway, instanced ── */
const GRASS_CARD_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSwaySpeed;
  uniform float uSwayAmplitude;

  attribute vec3 instanceOffset;   // x, y(=sandY), z
  attribute float instanceYaw;
  attribute float instanceScale;
  attribute float instanceHeight;
  attribute float instancePhase;
  attribute vec3 instanceBaseColor;
  attribute vec3 instanceTipColor;

  varying vec2 vUv;
  varying vec3 vBaseColor;
  varying vec3 vTipColor;

  void main() {
    vUv = uv;
    vBaseColor = instanceBaseColor;
    vTipColor = instanceTipColor;

    // Scale card by instance height/scale
    vec3 pos = position;
    pos.y *= instanceHeight;
    pos.x *= instanceScale;
    pos.z *= instanceScale;

    // Rotate around Y by instanceYaw
    float c = cos(instanceYaw);
    float s = sin(instanceYaw);
    vec3 rotated = vec3(
      pos.x * c - pos.z * s,
      pos.y,
      pos.x * s + pos.z * c
    );

    // Height-weighted sway: root fixed, tip sways
    float h01 = uv.y;  // 0 at base, 1 at tip
    float heightFactor = h01 * h01;  // quadratic falloff
    float worldX = instanceOffset.x + rotated.x;
    float swayX = sin(uTime * uSwaySpeed + worldX * 3.0 + instancePhase) * heightFactor * uSwayAmplitude;
    float swayZ = cos(uTime * uSwaySpeed * 0.75 + worldX * 2.5 + instancePhase * 0.7) * heightFactor * uSwayAmplitude * 0.5;

    vec3 worldPos = rotated + instanceOffset;
    worldPos.x += swayX;
    worldPos.z += swayZ;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
  }
`

const GRASS_CARD_FRAG = /* glsl */ `
  uniform sampler2D uLeafAlpha;
  uniform float uAlphaTest;

  varying vec2 vUv;
  varying vec3 vBaseColor;
  varying vec3 vTipColor;

  void main() {
    float alpha = texture2D(uLeafAlpha, vUv).a;
    if (alpha < uAlphaTest) discard;
    vec3 col = mix(vBaseColor, vTipColor, vUv.y);
    gl_FragColor = vec4(col, 1.0);
  }
`

/* ── Layout constants ── */
const SAND_COLOR = 0xe8dcc8
const ROCK_COLOR = 0x7a7570
const GLASS_EDGE_OPACITY = 0.12

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

/* ── Leaf alpha texture (CanvasTexture, no external file) ── */
function createLeafAlphaTexture(width = 64, height = 128): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  // Clear to transparent
  ctx.clearRect(0, 0, width, height)

  // Draw a tapered leaf shape: wide at bottom, pointed at top
  const cx = width / 2
  ctx.beginPath()
  ctx.moveTo(cx - width * 0.35, height)         // base left
  ctx.quadraticCurveTo(cx - width * 0.4, height * 0.5, cx, 0) // left edge to tip
  ctx.quadraticCurveTo(cx + width * 0.4, height * 0.5, cx + width * 0.35, height) // tip to right base
  ctx.closePath()

  // Gradient fill: subtle green tint for more natural alpha
  const grad = ctx.createLinearGradient(0, height, 0, 0)
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)')
  grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.95)')
  grad.addColorStop(1, 'rgba(255, 255, 255, 0.6)')
  ctx.fillStyle = grad
  ctx.fill()

  const tex = new THREE.CanvasTexture(canvas)
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipMapLinearFilter
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
}

/* ── Crossed grass card geometry (2-3 quads intersecting) ── */
function createGrassCardGeometry(quadCount = 2): THREE.BufferGeometry {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const halfW = 0.12

  for (let q = 0; q < quadCount; q++) {
    const angle = (q / quadCount) * Math.PI // spread quads evenly across 180°
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    const base = q * 4

    // bottom-left
    positions.push(-halfW * c, 0, -halfW * s)
    uvs.push(0, 0)
    // bottom-right
    positions.push(halfW * c, 0, halfW * s)
    uvs.push(1, 0)
    // top-right
    positions.push(halfW * c, 1, halfW * s) // height=1, scaled by instance
    uvs.push(1, 1)
    // top-left
    positions.push(-halfW * c, 1, -halfW * s)
    uvs.push(0, 1)

    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
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
  texture?: THREE.Texture
}

export class Aquascape implements SceneEntity {
  readonly object3d: THREE.Group
  private _time = 0
  private readonly _grassMaterials: THREE.ShaderMaterial[] = []
  private readonly _disposables: Disposable[] = []

  constructor() {
    this.object3d = new THREE.Group()
    this._buildSand()
    this._buildGrassCards()
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
      d.texture?.dispose()
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

  /* ── Grass cards with InstancedMesh + vertex shader sway ── */
  private _buildGrassCards(): void {
    const leafTex = createLeafAlphaTexture()
    this._disposables.push({ texture: leafTex })

    // Shared base card geometry (2 crossed quads)
    const cardGeo = createGrassCardGeometry(2)
    this._disposables.push({ geometry: cardGeo })

    for (const speciesCfg of PLANT.species) {
      const params: PlantSpeciesParams = {
        minHeight: speciesCfg.minHeight,
        maxHeight: speciesCfg.maxHeight,
        minScale: speciesCfg.minScale,
        maxScale: speciesCfg.maxScale,
        baseColor: [...speciesCfg.baseColor] as [number, number, number],
        tipColor: [...speciesCfg.tipColor] as [number, number, number],
        colorVariation: speciesCfg.colorVariation,
      }

      const instances = generatePlantInstances(
        speciesCfg.seed,
        speciesCfg.count,
        speciesCfg.area,
        params,
      )

      const count = instances.length
      const iMesh = new THREE.InstancedMesh(cardGeo, undefined as unknown as THREE.Material, count)

      // Prepare instanced attributes
      const offsets = new Float32Array(count * 3)
      const yaws = new Float32Array(count)
      const scales = new Float32Array(count)
      const heights = new Float32Array(count)
      const phases = new Float32Array(count)
      const baseColors = new Float32Array(count * 3)
      const tipColors = new Float32Array(count * 3)

      for (let i = 0; i < count; i++) {
        const inst = instances[i]
        offsets[i * 3] = inst.x
        offsets[i * 3 + 1] = AQUASCAPE.sandY + 0.005
        offsets[i * 3 + 2] = inst.z
        yaws[i] = inst.yaw
        scales[i] = inst.scale
        heights[i] = inst.height
        phases[i] = inst.phase
        baseColors[i * 3] = inst.baseColor[0]
        baseColors[i * 3 + 1] = inst.baseColor[1]
        baseColors[i * 3 + 2] = inst.baseColor[2]
        tipColors[i * 3] = inst.tipColor[0]
        tipColors[i * 3 + 1] = inst.tipColor[1]
        tipColors[i * 3 + 2] = inst.tipColor[2]
      }

      // Set dummy identity matrices for all instances
      const identity = new THREE.Matrix4()
      for (let i = 0; i < count; i++) {
        iMesh.setMatrixAt(i, identity)
      }

      // Attach instanced buffer attributes to the geometry clone
      const iGeo = cardGeo.clone()
      iGeo.setAttribute('instanceOffset', new THREE.InstancedBufferAttribute(offsets, 3))
      iGeo.setAttribute('instanceYaw', new THREE.InstancedBufferAttribute(yaws, 1))
      iGeo.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(scales, 1))
      iGeo.setAttribute('instanceHeight', new THREE.InstancedBufferAttribute(heights, 1))
      iGeo.setAttribute('instancePhase', new THREE.InstancedBufferAttribute(phases, 1))
      iGeo.setAttribute('instanceBaseColor', new THREE.InstancedBufferAttribute(baseColors, 3))
      iGeo.setAttribute('instanceTipColor', new THREE.InstancedBufferAttribute(tipColors, 3))

      const mat = new THREE.ShaderMaterial({
        vertexShader: GRASS_CARD_VERT,
        fragmentShader: GRASS_CARD_FRAG,
        uniforms: {
          uTime: { value: 0 },
          uSwaySpeed: { value: PLANT.swaySpeed },
          uSwayAmplitude: { value: PLANT.swayAmplitude },
          uLeafAlpha: { value: leafTex },
          uAlphaTest: { value: PLANT.alphaTest },
        },
        side: THREE.DoubleSide,
      })

      const mesh = new THREE.InstancedMesh(iGeo, mat, count)
      for (let i = 0; i < count; i++) {
        mesh.setMatrixAt(i, identity)
      }
      mesh.instanceMatrix.needsUpdate = true
      mesh.frustumCulled = false

      this.object3d.add(mesh)
      this._grassMaterials.push(mat)
      this._disposables.push({ geometry: iGeo, material: mat })
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
