import * as THREE from 'three'
import type { SceneEntity } from '../core/SceneRoot'
import { advanceTime, generatePlantInstances, generateHardscape } from './aquascapeHelpers'
import type { PlantSpeciesParams, HardscapeConfig } from './aquascapeHelpers'
import { AQUASCAPE, PLANT, HARDSCAPE, SCENE } from '../../shared/config'
import { applyCausticToStandardMaterial, updateCausticTime } from './caustics'
import { applyWaterDepthToMaterial } from './waterDepth'
import { getTheme, DEFAULT_THEME_ID, type BackgroundTheme } from './themeRegistry'

/* ── Grass card vertex shader: height-weighted sway, instanced ── */
const GRASS_CARD_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSwaySpeed;
  uniform float uSwayAmplitude;
  uniform float uSwaySpeed2;
  uniform float uSwayAmplitude2;

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

    // Primary sway
    float swayX = sin(uTime * uSwaySpeed + worldX * 3.0 + instancePhase) * heightFactor * uSwayAmplitude;
    float swayZ = cos(uTime * uSwaySpeed * 0.75 + worldX * 2.5 + instancePhase * 0.7) * heightFactor * uSwayAmplitude * 0.5;

    // Secondary slow wave for organic feel
    swayX += sin(uTime * uSwaySpeed2 + worldX * 1.5 + instancePhase * 1.3) * heightFactor * uSwayAmplitude2;
    swayZ += cos(uTime * uSwaySpeed2 * 0.6 + worldX * 2.0 + instancePhase * 0.5) * heightFactor * uSwayAmplitude2 * 0.4;

    vec3 worldPos = rotated + instanceOffset;
    worldPos.x += swayX;
    worldPos.z += swayZ;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
  }
`

const GRASS_CARD_FRAG = /* glsl */ `
  uniform sampler2D uLeafAlpha;
  uniform float uAlphaTest;
  uniform float uSceneOpacity;
  uniform vec3 uMoodColor;

  varying vec2 vUv;
  varying vec3 vBaseColor;
  varying vec3 vTipColor;

  void main() {
    float alpha = texture2D(uLeafAlpha, vUv).a;
    if (alpha < uAlphaTest) discard;
    // 수초는 비조명 셰이더라 광원 무드가 자동 반영되지 않는다 — 무드(틴트×배율)를 직접 곱한다.
    vec3 col = mix(vBaseColor, vTipColor, vUv.y) * uMoodColor;
    gl_FragColor = vec4(col, uSceneOpacity);
  }
`

/* ── Procedural sand normal map (CanvasTexture, no external file) ── */
function createSandNormalTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.createImageData(size, size)
  const data = imgData.data

  // Simple value noise for sand grain normals
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      // Multiple noise octaves for sand grain texture
      const n1 = Math.sin(x * 0.8 + y * 0.6) * 0.3
      const n2 = Math.sin(x * 2.3 - y * 1.7) * 0.15
      const n3 = Math.sin(x * 5.1 + y * 4.3) * 0.08
      const nx = (n1 + n2 + n3) * HARDSCAPE.sand.normalStrength
      const ny = (Math.cos(x * 0.9 + y * 1.1) * 0.3 + Math.cos(x * 3.1 - y * 2.2) * 0.12) * HARDSCAPE.sand.normalStrength
      // Encode normal: (nx, ny, 1) normalized → [0,255]
      data[i] = Math.floor((nx * 0.5 + 0.5) * 255)
      data[i + 1] = Math.floor((ny * 0.5 + 0.5) * 255)
      data[i + 2] = 255 // z always ~1 for subtle normals
      data[i + 3] = 255
    }
  }

  ctx.putImageData(imgData, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(8, 4)
  return tex
}

/* ── Procedural driftwood mesh (code-generated, no external GLB) ── */
function createDriftwoodGeometry(segments = 18): THREE.BufferGeometry {
  const path = new THREE.CurvePath<THREE.Vector3>()
  // Multi-segment organic curved branch — thicker and more sinuous
  path.add(new THREE.CubicBezierCurve3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.15, 0.12, 0.06),
    new THREE.Vector3(0.35, 0.18, -0.04),
    new THREE.Vector3(0.5, 0.1, 0.02),
  ))
  path.add(new THREE.CubicBezierCurve3(
    new THREE.Vector3(0.5, 0.1, 0.02),
    new THREE.Vector3(0.65, 0.02, 0.08),
    new THREE.Vector3(0.8, -0.05, -0.06),
    new THREE.Vector3(1, 0.04, 0),
  ))
  const tube = new THREE.TubeGeometry(path as unknown as THREE.Curve<THREE.Vector3>, segments, 1.0, 6, false)
  return tube
}

/* ── Leaf alpha texture (CanvasTexture, no external file) ── */
function createLeafAlphaTexture(width = 64, height = 128): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  // Clear to transparent
  ctx.clearRect(0, 0, width, height)

  // Organic leaf shape: wider base with slight left/right asymmetry
  const cx = width / 2
  ctx.beginPath()
  ctx.moveTo(cx - width * 0.38, height)           // base left (wider)
  ctx.bezierCurveTo(
    cx - width * 0.42, height * 0.6,              // left bulge at lower third
    cx - width * 0.25, height * 0.25,             // taper toward tip
    cx, 0,                                         // tip
  )
  ctx.bezierCurveTo(
    cx + width * 0.28, height * 0.25,             // slightly different curve (asymmetry)
    cx + width * 0.44, height * 0.6,              // right bulge
    cx + width * 0.38, height,                    // base right
  )
  ctx.closePath()

  // Gradient fill: gradual fade toward tip for natural translucency
  const grad = ctx.createLinearGradient(0, height, 0, 0)
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)')
  grad.addColorStop(0.6, 'rgba(255, 255, 255, 0.95)')
  grad.addColorStop(0.85, 'rgba(255, 255, 255, 0.8)')
  grad.addColorStop(1, 'rgba(255, 255, 255, 0.5)')
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
function createGrassCardGeometry(quadCount = 2, halfW = 0.12): THREE.BufferGeometry {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

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
  private _theme: BackgroundTheme
  private readonly _grassMaterials: THREE.ShaderMaterial[] = []
  private readonly _disposables: Disposable[] = []
  /** 불투명 머티리얼(MeshStandard) — baseOpacity=1 고정 */
  private readonly _opaqueMaterials: THREE.MeshStandardMaterial[] = []
  /** setTheme 재빌드 직후 재적용하기 위해 보관하는 직전 값(리빌드로 투명도/무드가 풀리는 버그 방지). */
  private _lastOpacityFactor = 1
  private _lastMood: readonly [number, number, number] = [1, 1, 1]

  constructor(theme: BackgroundTheme = getTheme(DEFAULT_THEME_ID)) {
    this.object3d = new THREE.Group()
    this._theme = theme
    this._buildAll()
  }

  update(dt: number): void {
    this._time = advanceTime(this._time, dt)
    for (const mat of this._grassMaterials) {
      mat.uniforms.uTime.value = this._time
    }
    updateCausticTime(this._time)
  }

  /**
   * 배경 테마를 교체한다: 기존 자식 메시/지오메트리/머티리얼/텍스처를 정리하고 새 테마로 재빌드한다.
   * CRITICAL: object3d(Group) 인스턴스 자체는 유지한다 — SceneRoot가 이 참조를 scene에 이미
   * 추가해 두었으므로, 여기서 새 Group을 만들면 화면에서 사라진다. children만 비우고 다시 채운다.
   */
  setTheme(theme: BackgroundTheme): void {
    this._theme = theme
    this._clearBuild()
    this._buildAll()
    // 리빌드로 새로 만들어진 머티리얼은 기본값(불투명·흰 무드)이므로 직전 상태를 재적용한다.
    this.setSceneOpacity(this._lastOpacityFactor)
    this.setMood(this._lastMood[0], this._lastMood[1], this._lastMood[2])
  }

  /**
   * 시간대 무드(틴트×배율 프리멀티 RGB)를 비조명 수초 셰이더에 반영한다.
   * (모래·바위·유목은 MeshStandardMaterial이라 광원 무드가 자동 반영됨. 커스틱은 caustics.setCausticMood.)
   */
  setMood(r: number, g: number, b: number): void {
    this._lastMood = [r, g, b]
    for (const mat of this._grassMaterials) {
      const c = mat.uniforms.uMoodColor.value as THREE.Color
      c.setRGB(r, g, b)
    }
  }

  /** factor 1=평소(불투명), 0=완전 투명. 물고기 제외, 밝기와 곱연산으로 공존 */
  setSceneOpacity(factor: number): void {
    const f = Math.max(0, Math.min(1, factor))
    this._lastOpacityFactor = f
    const invisible = f <= SCENE.invisibleThreshold

    // 불투명 머티리얼(모래·바위·유목) → transparent + opacity
    for (const mat of this._opaqueMaterials) {
      mat.transparent = true
      mat.opacity = f
    }

    // 수초(ShaderMaterial) — gl_FragColor.a에 factor 곱
    for (const mat of this._grassMaterials) {
      if (!mat.uniforms.uSceneOpacity) {
        mat.uniforms.uSceneOpacity = { value: f }
      } else {
        mat.uniforms.uSceneOpacity.value = f
      }
    }

    // 드로우 비용 제거: factor≈0이면 그룹 전체 숨김
    this.object3d.visible = !invisible
  }

  dispose(): void {
    this._clearBuild()
  }

  /** 현 테마로 모래/수초/하드스케이프를 빌드한다. */
  private _buildAll(): void {
    this._buildSand()
    this._buildGrassCards()
    this._buildHardscape()
  }

  /**
   * 자식 메시·지오메트리·머티리얼·텍스처를 정리한다(dispose와 setTheme 재빌드가 공유).
   * object3d(Group) 인스턴스 자체는 유지 — children만 비운다.
   */
  private _clearBuild(): void {
    for (const d of this._disposables) {
      d.geometry?.dispose()
      d.material?.dispose()
      d.texture?.dispose()
    }
    this._disposables.length = 0
    this._grassMaterials.length = 0
    this._opaqueMaterials.length = 0
    this.object3d.clear()
  }

  /* ── Sand floor with procedural color variation + normal map ── */
  private _buildSand(): void {
    const segW = 80
    const segH = 20
    const geo = new THREE.PlaneGeometry(200, 14, segW, segH)
    geo.rotateX(-Math.PI / 2)

    // Vertex color variation for subtle sand grain color
    const count = geo.attributes.position.count
    const colors = new Float32Array(count * 3)
    const baseColor = new THREE.Color(this._theme.sandColor)
    const cv = HARDSCAPE.sand.colorVariation
    for (let i = 0; i < count; i++) {
      const px = geo.attributes.position.getX(i)
      const pz = geo.attributes.position.getZ(i)
      // Deterministic noise based on position
      const n = Math.sin(px * 1.3 + pz * 0.9) * 0.5 + Math.sin(px * 3.7 - pz * 2.1) * 0.25
      colors[i * 3] = baseColor.r + n * cv
      colors[i * 3 + 1] = baseColor.g + n * cv * 0.8
      colors[i * 3 + 2] = baseColor.b + n * cv * 0.6
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

    const normalTex = createSandNormalTexture()
    this._disposables.push({ texture: normalTex })

    const mat = new THREE.MeshStandardMaterial({
      color: this._theme.sandColor,
      vertexColors: true,
      normalMap: normalTex,
      normalScale: new THREE.Vector2(HARDSCAPE.sand.normalStrength, HARDSCAPE.sand.normalStrength),
      roughness: 1.0,
      metalness: 0,
      side: THREE.DoubleSide,
    })
    applyCausticToStandardMaterial(mat, 'sand-caustic')
    applyWaterDepthToMaterial(mat)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(0, AQUASCAPE.sandY, -4)
    this.object3d.add(mesh)
    this._opaqueMaterials.push(mat)
    this._disposables.push({ geometry: geo, material: mat })
  }

  /* ── Grass cards with InstancedMesh + vertex shader sway ── */
  private _buildGrassCards(): void {
    const leafTex = createLeafAlphaTexture()
    this._disposables.push({ texture: leafTex })

    for (const speciesCfg of this._theme.plants) {
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

      // Per-species card geometry with species-specific quad count and width
      const iGeo = createGrassCardGeometry(speciesCfg.quadCount, speciesCfg.cardHalfWidth)

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
          uSwaySpeed2: { value: PLANT.swaySpeed2 },
          uSwayAmplitude2: { value: PLANT.swayAmplitude2 },
          uLeafAlpha: { value: leafTex },
          uAlphaTest: { value: PLANT.alphaTest },
          uSceneOpacity: { value: 1.0 },
          uMoodColor: { value: new THREE.Color(1, 1, 1) },
        },
        transparent: true,
        side: THREE.DoubleSide,
      })

      const identity = new THREE.Matrix4()
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

  /* ── Rocks, pebbles & driftwood (generateHardscape 기반) ── */
  private _buildHardscape(): void {
    const theme = this._theme.hardscape
    const hsConfig: HardscapeConfig = {
      rockCount: theme.rockCount,
      pebbleCount: theme.pebbleCount,
      driftwoodCount: theme.driftwoodCount,
      clusterCount: theme.clusterCount,
      clusterSpread: theme.clusterSpread,
      rock: {
        minScale: theme.rock.minScale,
        maxScale: theme.rock.maxScale,
        maxHeightAboveSand: theme.rock.maxHeightAboveSand,
      },
      pebble: {
        minScale: theme.pebble.minScale,
        maxScale: theme.pebble.maxScale,
      },
      driftwood: {
        minLength: theme.driftwood.minLength,
        maxLength: theme.driftwood.maxLength,
        minRadius: theme.driftwood.minRadius,
        maxRadius: theme.driftwood.maxRadius,
        maxHeightAboveSand: theme.driftwood.maxHeightAboveSand,
      },
    }
    const hs = generateHardscape(
      theme.seed,
      theme.area,
      AQUASCAPE.sandY,
      hsConfig,
    )

    const rockColors = theme.rock.colors
    const rockGeoBase = new THREE.DodecahedronGeometry(1, 0)
    const pebbleGeoBase = new THREE.SphereGeometry(1, 5, 4)
    this._disposables.push({ geometry: rockGeoBase }, { geometry: pebbleGeoBase })

    // Rocks & pebbles (first ROCK_COUNT are large rocks, rest are pebbles)
    for (let i = 0; i < hs.rocks.length; i++) {
      const p = hs.rocks[i]
      const isLargeRock = i < theme.rockCount
      const colorHex = rockColors[i % rockColors.length]
      const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.85,
        metalness: 0,
      })
      applyCausticToStandardMaterial(mat, 'rock-caustic')
      applyWaterDepthToMaterial(mat)
      const geo = isLargeRock ? rockGeoBase : pebbleGeoBase
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(p.x, p.y, p.z)
      mesh.scale.set(p.scaleX, p.scaleY, p.scaleZ)
      mesh.rotation.set(p.rotX, p.rotY, p.rotZ)
      this.object3d.add(mesh)
      this._opaqueMaterials.push(mat)
      this._disposables.push({ material: mat })
    }

    // Driftwood — alternate between two tones for variety
    const dwGeo = createDriftwoodGeometry()
    const dwColors = [theme.driftwood.color, theme.driftwood.colorAlt]
    this._disposables.push({ geometry: dwGeo })

    for (let i = 0; i < hs.driftwood.length; i++) {
      const p = hs.driftwood[i]
      const mat = new THREE.MeshStandardMaterial({
        color: dwColors[i % dwColors.length],
        roughness: 0.92,
        metalness: 0,
      })
      applyCausticToStandardMaterial(mat, 'driftwood-caustic')
      applyWaterDepthToMaterial(mat)
      const mesh = new THREE.Mesh(dwGeo, mat)
      mesh.position.set(p.x, p.y, p.z)
      mesh.scale.set(p.scaleX, p.scaleY, p.scaleZ)
      mesh.rotation.set(p.rotX, p.rotY, p.rotZ)
      this.object3d.add(mesh)
      this._opaqueMaterials.push(mat)
      this._disposables.push({ material: mat })
    }
  }

}
