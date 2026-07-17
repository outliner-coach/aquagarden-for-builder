import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { SceneEntity } from '../core/SceneRoot'
import { advanceTime, generatePlantInstances, generateHardscape, mulberry32 } from './aquascapeHelpers'
import type { PlantSpeciesParams, HardscapeConfig } from './aquascapeHelpers'
import { generateKelpInstances, kelpTaperHalfWidth } from './kelpHelpers'
import type { KelpParams } from './kelpHelpers'
import { displaceRockPositions } from './rockHelpers'
import { sandHeightAt } from './terrainHelpers'
import { generateBranchCoral, generateCoralClusters } from './coralHelpers'
import { AQUASCAPE, PLANT, KELP, CORAL, HARDSCAPE, SCENE } from '../../shared/config'
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

/* ── Kelp ribbon vertex shader: 누적 벤딩(뿌리 고정·팁 최대), instanced ──
 * 그래스 스웨이의 확장: 저주파·대진폭 주 흔들림(pow(h01,1.5) 가중으로 위로 갈수록
 * 크게 휘는 아치) + 위상이 h01을 따라 진행하는 2차 미세 웨이브(굽이치는 S자 곡률). */
const KELP_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSwaySpeed;
  uniform float uSwayAmplitude;
  uniform float uSwaySpeed2;
  uniform float uSwayAmplitude2;
  uniform float uWorldFreq;
  uniform float uWaveAlongBlade;
  uniform float uZSwayRatio;

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

    // Scale ribbon by instance height/scale
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

    // 누적 벤딩: 뿌리(h01=0) 고정, 팁 최대 — pow 1.5 가중으로 아치형 곡률
    float h01 = uv.y;
    float bend = pow(h01, 1.5);
    float worldX = instanceOffset.x + rotated.x;

    // 주 흔들림 — 저주파·대진폭. worldX 위상으로 숲을 가로지르는 파도감
    float mainPhase = uTime * uSwaySpeed + worldX * uWorldFreq + instancePhase;
    float swayX = sin(mainPhase) * bend * uSwayAmplitude;
    float swayZ = cos(mainPhase * 0.83) * bend * uSwayAmplitude * uZSwayRatio;

    // 2차 미세 웨이브 — 위상이 블레이드를 따라 진행(h01)해 리본이 굽이친다
    float wavePhase = uTime * uSwaySpeed2 + h01 * uWaveAlongBlade + instancePhase * 1.7;
    swayX += sin(wavePhase) * bend * uSwayAmplitude2;
    swayZ += cos(wavePhase * 0.9) * bend * uSwayAmplitude2 * uZSwayRatio;

    vec3 worldPos = rotated + instanceOffset;
    worldPos.x += swayX;
    worldPos.z += swayZ;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
  }
`

/* CRITICAL: vertex에서 쓴 varying(vUv/vBaseColor/vTipColor)을 여기에도 전부 선언 —
 * 누락 시 조용한 컴파일 실패로 투명 패스 전체가 붕괴한 과거 사고가 있다(CLAUDE.md). */
const KELP_FRAG = /* glsl */ `
  uniform sampler2D uLeafAlpha;
  uniform float uAlphaTest;
  uniform float uSceneOpacity;
  uniform vec3 uMoodColor;
  uniform float uEdgeShade;

  varying vec2 vUv;
  varying vec3 vBaseColor;
  varying vec3 vTipColor;

  void main() {
    float alpha = texture2D(uLeafAlpha, vUv).a;
    if (alpha < uAlphaTest) discard;
    // 그래스와 동일 규약: 비조명 셰이더 → 무드(틴트×배율)를 직접 곱한다.
    vec3 col = mix(vBaseColor, vTipColor, vUv.y) * uMoodColor;
    // 리본 폭 방향 음영(중앙 밝게·가장자리 어둡게) — 알파-discard만 사용, 블렌딩 불변
    col *= (1.0 - uEdgeShade) + (2.0 * uEdgeShade) * sin(vUv.x * 3.141592653589793);
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

/* ── Noise-displaced low-poly rock geometry (rockStyle: 'displaced') ──
 * classic(정12면체)의 대안. IcosahedronGeometry(1,1)은 이미 non-indexed(면마다 독립 버텍스로
 * 저장)라, displaceRockPositions의 위치기반 해시 변위가 같은 자리의 중복 버텍스에 같은 변위를
 * 줘 면이 찢어지지 않는다(rockHelpers.ts CRITICAL 가드). computeVertexNormals()는 non-indexed
 * 지오메트리에서 진짜 flat(면당) 노멀을 계산한다. */
function createDisplacedRockGeometry(seed: number, strength: number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, 1)
  const displaced = displaceRockPositions(geo.attributes.position.array, seed, strength)
  geo.setAttribute('position', new THREE.Float32BufferAttribute(displaced, 3))
  geo.computeVertexNormals()
  return geo
}

/* ── 가지 산호 지오메트리: BranchSpec 세그먼트들을 실린더로 만들어 하나로 병합 ──
 * 클러스터 전체(메인 + 사이드 트리)를 mergeGeometries로 합쳐 드로우콜 1. 각 실린더는
 * 밑동 원점·+Y 정렬로 만든 뒤 세그먼트 방향(dir)으로 회전(applyQuaternion이 position·normal
 * 모두 변환)해 start로 옮긴다.
 * worldScale = CORAL.branch.scale × cluster.scale(단위공간 트렁크 길이 1 → 월드 크기). */
function createBranchCoralGeometry(seed: number, worldScale: number): THREE.BufferGeometry {
  const up = new THREE.Vector3(0, 1, 0)
  const start = new THREE.Vector3()
  const end = new THREE.Vector3()
  const dir = new THREE.Vector3()
  const quat = new THREE.Quaternion()
  const parts: THREE.BufferGeometry[] = []

  const addTree = (treeSeed: number, treeScale: number, worldOffX: number, worldOffZ: number): void => {
    const specs = generateBranchCoral(treeSeed, {
      depth: CORAL.branch.depth,
      childCount: [...CORAL.branch.childCount] as [number, number],
      spreadAngle: CORAL.branch.spreadAngle,
      lengthDecay: CORAL.branch.lengthDecay,
      radiusDecay: CORAL.branch.radiusDecay,
    })
    const s2w = worldScale * treeScale // 트리 단위공간 → 월드
    for (const s of specs) {
      start.set(s.start[0], s.start[1], s.start[2]).multiplyScalar(s2w)
      end.set(s.end[0], s.end[1], s.end[2]).multiplyScalar(s2w)
      start.x += worldOffX
      start.z += worldOffZ
      end.x += worldOffX
      end.z += worldOffZ
      dir.subVectors(end, start)
      const len = dir.length()
      if (len < 1e-6) continue
      const rBottom = s.radius * s2w
      const rTop = rBottom * CORAL.branch.radiusDecay // 자식 밑동과 이어지는 테이퍼
      const cyl = new THREE.CylinderGeometry(rTop, rBottom, len, CORAL.branch.radialSegments)
      cyl.translate(0, len / 2, 0) // 밑동을 원점으로
      quat.setFromUnitVectors(up, dir.normalize())
      cyl.applyQuaternion(quat)
      cyl.translate(start.x, start.y, start.z)
      parts.push(cyl)
    }
  }

  // 메인 트리 + 사이드 트리(작게, 옆에) — "클러스터로 모인" 군집 실루엣.
  addTree(seed, 1, 0, 0)
  addTree(
    seed + 1,
    CORAL.branch.sideScale,
    worldScale * CORAL.branch.sideOffsetX,
    worldScale * CORAL.branch.sideOffsetZ,
  )

  const merged = mergeGeometries(parts, false)
  for (const p of parts) p.dispose()
  // 실린더 자체 노멀은 applyQuaternion으로 이미 올바르므로 재계산 불필요(병합만).
  return merged ?? new THREE.BufferGeometry()
}

/* ── 뇌 산호 지오메트리: 반구(dome) + step3 위치기반 해시 변위(작은 strength·고빈도) ──
 * SphereGeometry의 thetaLength=π/2 → 상단 반구(밑면 개방, 모래에 앉음). indexed(공유 버텍스)라
 * displaceRockPositions가 찢어짐 없이 적용되고 computeVertexNormals로 smooth(둥근) 요철이 된다.
 * 메인 돔 + 사이드 돔을 병합해 군집 실루엣(드로우콜 1). */
function createBrainCoralGeometry(seed: number): THREE.BufferGeometry {
  const makeDome = (domeSeed: number, radius: number, offX: number, offZ: number): THREE.BufferGeometry => {
    const geo = new THREE.SphereGeometry(
      radius,
      CORAL.brain.widthSegments,
      CORAL.brain.heightSegments,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    )
    const displaced = displaceRockPositions(
      geo.attributes.position.array,
      domeSeed,
      CORAL.brain.displaceStrength,
    )
    geo.setAttribute('position', new THREE.Float32BufferAttribute(displaced, 3))
    geo.computeVertexNormals() // smooth 셰이딩(둥근 요철) — flat 아님
    geo.translate(offX, 0, offZ)
    return geo
  }

  const r = CORAL.brain.radius
  const off = r * CORAL.brain.sideOffsetFactor
  const main = makeDome(seed, r, 0, 0)
  const side = makeDome(seed + 1, r * CORAL.brain.sideScale, off, off * 0.35)
  const merged = mergeGeometries([main, side], false)
  main.dispose()
  side.dispose()
  return merged ?? new THREE.BufferGeometry()
}

/* ── 뇌 산호 미로(groove) 무늬 텍스처(CanvasTexture, 외부 파일 없음) ──
 * 밝은 능선 + 어두운 골이 굽이치는 그레이스케일 — material.color(팔레트)와 곱연산되어 색 유지.
 * 민무늬 돔은 "뇌 산호"로 읽히지 않아 무늬로 정체성을 만든다. u 방향 주기는 정수(RepeatWrapping
 * seamless), v는 ClampToEdge. 내부 계수는 무늬 형태 상수(caustics 텍스처 계수와 동일한 성격). */
function createBrainCoralTexture(): THREE.CanvasTexture {
  const cfg = CORAL.brain.groove
  const S = cfg.texSize
  const canvas = document.createElement('canvas')
  canvas.width = S
  canvas.height = S
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.createImageData(S, S)
  const data = imgData.data
  const TWO_PI = Math.PI * 2

  for (let y = 0; y < S; y++) {
    const v = y / S
    for (let x = 0; x < S; x++) {
      const u = x / S
      // 줄무늬 위상을 두 겹의 사인으로 워프 → 굽이치는 골(미로 느낌). u 주기는 정수만 사용.
      const warpA = Math.sin(u * 3 * TWO_PI + v * 5.0) * 1.2
      const warpB = Math.sin(v * cfg.scale * 0.7 * TWO_PI) * cfg.warp
      const band = Math.sin(u * cfg.scale * TWO_PI + warpA + warpB)
      const ridge = Math.min(1, Math.abs(band) * 1.6) // 0=골, 1=능선
      const value = 1 - cfg.depth * (1 - ridge)
      const byte = Math.round(value * 255)
      const i = (y * S + x) * 4
      data[i] = byte
      data[i + 1] = byte
      data[i + 2] = byte
      data[i + 3] = 255
    }
  }

  ctx.putImageData(imgData, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.repeat.set(cfg.repeatX, cfg.repeatY)
  return tex
}

/* ── 부채 산호 알파 텍스처(CanvasTexture, 외부 파일 없음) ──
 * 밑동(하단 중앙)에서 위로 펼쳐지는 부채꼴 + 방사 갈래(잎맥) 사이 투명 컷으로 성긴 그물 실루엣.
 * 알파-discard만 사용(그래스/켈프와 동일 규약 — additive/반투명 평면 금지). */
function createCoralFanAlphaTexture(): THREE.CanvasTexture {
  const cfg = CORAL.fan
  const W = cfg.texWidth
  const H = cfg.texHeight
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, W, H)

  const baseX = W / 2
  const baseY = H // 밑동: 캔버스 하단 중앙(uv.y=0 = 카드 밑동)
  const R = H * 0.96 // 부채 반경
  const half = cfg.fanHalfAngle
  const UP = -Math.PI / 2 // 캔버스 각도계에서 위쪽
  const baseSolidR = H * cfg.baseSolidRatio
  const veins = cfg.veinCount
  const slot = (2 * half) / veins
  const fingerAng = slot * (1 - cfg.veinGapRatio)

  ctx.fillStyle = 'rgba(255,255,255,1)'

  // 1) 밑동 솔리드 웨지(갈래들을 이어 붙임)
  ctx.beginPath()
  ctx.moveTo(baseX, baseY)
  ctx.arc(baseX, baseY, baseSolidR, UP - half, UP + half)
  ctx.closePath()
  ctx.fill()

  // 2) 각 갈래(finger): 밑동 근처에서 부채 반경까지 채운 환형 섹터
  const innerR = baseSolidR * 0.5
  for (let i = 0; i < veins; i++) {
    const center = UP - half + slot * (i + 0.5)
    const a0 = center - fingerAng / 2
    const a1 = center + fingerAng / 2
    ctx.beginPath()
    ctx.arc(baseX, baseY, innerR, a0, a1, false)
    ctx.arc(baseX, baseY, R, a1, a0, true)
    ctx.closePath()
    ctx.fill()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipMapLinearFilter
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
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

/* ── Kelp blade alpha texture (CanvasTexture, no external file) ──
 * createLeafAlphaTexture의 "키 큰 형제": 길쭉하고 가장자리가 물결치는 잎 실루엣.
 * 중심선은 살짝 미앤더하고(뿌리 고정), 좌우 가장자리는 위상이 어긋난 사인 물결로 비대칭. */
function createKelpBladeAlphaTexture(): THREE.CanvasTexture {
  const cfg = KELP.blade
  const W = cfg.texWidth
  const H = cfg.texHeight
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, W, H)

  const TWO_PI = Math.PI * 2
  const N = cfg.silhouetteSamples

  // t: 0=뿌리(캔버스 하단), 1=팁(상단). CanvasTexture flipY로 uv.y=0이 하단 행을 샘플한다.
  const yAt = (t: number): number => H * (1 - t)
  const centerX = (t: number): number =>
    W * (0.5 + cfg.meanderAmp * Math.sin(t * cfg.meanderCount * TWO_PI) * Math.pow(t, cfg.meanderRootLock))
  const halfAt = (t: number, phase: number): number => {
    const base = W * (cfg.rootHalf + (cfg.tipHalf - cfg.rootHalf) * t)
    const wave = 1 + cfg.edgeWaveAmp * Math.sin(t * cfg.edgeWaveCount * TWO_PI + phase)
    const tipRound = Math.min(1, (1 - t) / cfg.tipRoundSpan)
    return base * wave * tipRound
  }

  ctx.beginPath()
  ctx.moveTo(centerX(0) - halfAt(0, 0), yAt(0))
  for (let i = 1; i <= N; i++) {
    const t = i / N
    ctx.lineTo(centerX(t) - halfAt(t, 0), yAt(t))
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N
    ctx.lineTo(centerX(t) + halfAt(t, cfg.edgePhaseOffset), yAt(t))
  }
  ctx.closePath()

  // 알파는 discard 임계(0.5) 기준 — 본체는 1.0, 팁만 살짝 낮춰 원거리 밉맵에서 부드럽게 침식
  const grad = ctx.createLinearGradient(0, H, 0, 0)
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)')
  grad.addColorStop(0.85, 'rgba(255, 255, 255, 0.95)')
  grad.addColorStop(1, 'rgba(255, 255, 255, 0.8)')
  ctx.fillStyle = grad
  ctx.fill()

  const tex = new THREE.CanvasTexture(canvas)
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipMapLinearFilter
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
}

/* ── Kelp ribbon geometry: 세로 멀티 세그먼트 연속 스트립(링당 2버텍스) ──
 * uv.y = h01(0=뿌리, 1=팁), 폭은 kelpTaperHalfWidth로 단조 감소.
 * 높이 1 기준(셰이더에서 instanceHeight 배율). 한 장 + DoubleSide. */
function createKelpRibbonGeometry(segments: number, baseHalfWidth: number, tipRatio: number): THREE.BufferGeometry {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (let i = 0; i <= segments; i++) {
    const h01 = i / segments
    const half = kelpTaperHalfWidth(h01, baseHalfWidth, tipRatio)
    positions.push(-half, h01, 0)
    uvs.push(0, h01)
    positions.push(half, h01, 0)
    uvs.push(1, h01)
    if (i < segments) {
      const b = i * 2
      indices.push(b, b + 1, b + 3, b, b + 3, b + 2)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
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

  /**
   * 월드 (x, z)에서의 지형 높이(sandY 기준 상대 변위). 수초·다시마·하드스케이프·산호를 지형
   * 표면에 안착시켜(떠 있거나 파묻히지 않게) 배치 y에 더한다. 지형 없는 테마(미니멀)는 항상
   * 0을 반환해 기존 평면 배치를 그대로 유지한다(하위호환).
   */
  private _terrainLift(x: number, z: number): number {
    const t = this._theme.terrain
    return t ? sandHeightAt(x, z, t) : 0
  }

  /** 현 테마로 모래/수초/다시마/하드스케이프/산호를 빌드한다. */
  private _buildAll(): void {
    this._buildSand()
    this._buildGrassCards()
    this._buildKelp()
    this._buildHardscape()
    this._buildCoral()
  }

  /**
   * 자식 메시·지오메트리·머티리얼·텍스처를 정리한다(dispose와 setTheme 재빌드가 공유).
   * object3d(Group) 인스턴스 자체는 유지 — children만 비운다.
   */
  private _clearBuild(): void {
    // InstancedMesh는 geometry.dispose()로 정리되지 않는 instanceMatrix GPU 버퍼를 갖는다
    // — mesh.dispose()의 'dispose' 이벤트만이 해제 경로라, 테마 전환 반복 시 누수를 막으려면 필수.
    this.object3d.traverse((o) => {
      const im = o as THREE.InstancedMesh
      if (im.isInstancedMesh) im.dispose()
    })
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

  /* ── Sand floor with procedural color variation + normal map ──
   * 테마에 terrain이 있으면 PlaneGeometry 버텍스 Y를 sandHeightAt로 변위하고(마운드/기복),
   * computeVertexNormals로 실루엣 셰이딩을 만든다. 세그먼트를 80x20→120x32로 올려 마운드가
   * 각지지 않게 한다. 미니멀(terrain 없음)은 80x20·무변위로 기존과 동일(하위호환).
   * CRITICAL(CLAUDE.md): 가장자리 알파 페이드는 sandHeightAt의 edge/front taper가 그 영역을
   * 변위 0으로 남겨 보존한다(하드컷 수평선 아티팩트 재발 방지). */
  private _buildSand(): void {
    const terrain = this._theme.terrain
    const segW = terrain ? 120 : 80
    const segH = terrain ? 32 : 20
    const geo = new THREE.PlaneGeometry(200, 14, segW, segH)
    geo.rotateX(-Math.PI / 2)

    // Vertex color variation for subtle sand grain color
    const pos = geo.attributes.position
    const count = pos.count
    const colors = new Float32Array(count * 3)
    const baseColor = new THREE.Color(this._theme.sandColor)
    const cv = HARDSCAPE.sand.colorVariation
    const crest = terrain ? new THREE.Color(terrain.crestColor) : null
    for (let i = 0; i < count; i++) {
      const px = pos.getX(i)
      const pz = pos.getZ(i)
      // Deterministic noise based on position
      const n = Math.sin(px * 1.3 + pz * 0.9) * 0.5 + Math.sin(px * 3.7 - pz * 2.1) * 0.25
      let r = baseColor.r + n * cv
      let g = baseColor.g + n * cv * 0.8
      let b = baseColor.b + n * cv * 0.6

      if (terrain) {
        // 평면 로컬 z → 월드 z(worldZ = localZ + sandZ) 변환 후 높이 계산·버텍스 변위.
        const h = sandHeightAt(px, pz + AQUASCAPE.sandZ, terrain)
        pos.setY(i, h)
        // 마운드/기복 정점을 crestColor(암반색)로 변조해 지형이 읽히게(정규화 높이 기준, 정점만).
        const heightN = Math.max(0, Math.min(1, h / terrain.maxHeight))
        const blend = heightN * terrain.crestColorStrength
        if (blend > 0 && crest) {
          r += (crest.r - r) * blend
          g += (crest.g - g) * blend
          b += (crest.b - b) * blend
        }
      }
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    if (terrain) geo.computeVertexNormals() // 변위 표면의 셰이딩(마운드 실루엣) — 노멀맵과 공존

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
    mesh.position.set(0, AQUASCAPE.sandY, AQUASCAPE.sandZ)
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
        // 지형 표면에 안착(뿌리가 마운드/기복 위에 얹히도록). 미니멀은 lift=0.
        offsets[i * 3 + 1] = AQUASCAPE.sandY + 0.005 + this._terrainLift(inst.x, inst.z)
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

  /* ── Kelp ribbons with InstancedMesh + vertex shader bending ──
   * 그래스 카드와 동일한 인스턴스드 속성 구성. 머티리얼을 _grassMaterials에 push해
   * uTime/무드/투명도 갱신 루프에 자동 편승한다(별도 배선 금지). */
  private _buildKelp(): void {
    const kelpCfg = this._theme.kelp
    if (!kelpCfg) return

    const bladeTex = createKelpBladeAlphaTexture()
    this._disposables.push({ texture: bladeTex })

    const params: KelpParams = {
      minHeight: kelpCfg.minHeight,
      maxHeight: kelpCfg.maxHeight,
      minScale: kelpCfg.minScale,
      maxScale: kelpCfg.maxScale,
      baseColor: [...kelpCfg.baseColor] as [number, number, number],
      tipColor: [...kelpCfg.tipColor] as [number, number, number],
      colorVariation: kelpCfg.colorVariation,
      centerGap: kelpCfg.centerGap,
      centerProbability: kelpCfg.centerProbability,
      backBias: kelpCfg.backBias,
    }
    const instances = generateKelpInstances(kelpCfg.seed, kelpCfg.count, kelpCfg.area, params)
    const count = instances.length

    const iGeo = createKelpRibbonGeometry(KELP.segments, KELP.baseHalfWidth, KELP.tipRatio)

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
      // 다시마 뿌리를 암반 기복 표면에 안착(다시마는 바위에 붙어 자람). 미니멀은 lift=0.
      offsets[i * 3 + 1] = AQUASCAPE.sandY + 0.005 + this._terrainLift(inst.x, inst.z)
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
      vertexShader: KELP_VERT,
      fragmentShader: KELP_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uSwaySpeed: { value: KELP.swaySpeed },
        uSwayAmplitude: { value: KELP.swayAmplitude },
        uSwaySpeed2: { value: KELP.swaySpeed2 },
        uSwayAmplitude2: { value: KELP.swayAmplitude2 },
        uWorldFreq: { value: KELP.worldFreq },
        uWaveAlongBlade: { value: KELP.waveAlongBlade },
        uZSwayRatio: { value: KELP.zSwayRatio },
        uEdgeShade: { value: KELP.edgeShade },
        uLeafAlpha: { value: bladeTex },
        uAlphaTest: { value: KELP.alphaTest },
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
    // classic(미지정 포함)=기존 정12면체(미니멀 무변화). displaced=노이즈 변위 로우폴리(step3).
    const rockStyle = theme.rock.rockStyle ?? 'classic'
    const rockGeoBase = rockStyle === 'displaced'
      ? createDisplacedRockGeometry(theme.rock.displaceSeed ?? 0, theme.rock.displaceStrength ?? 0)
      : new THREE.DodecahedronGeometry(1, 0)
    // 큰 바위에만 적용되는 추가 Y 스케일 배율(낮고 넓은 암반 등). 미지정 시 1=변화 없음.
    const flattenY = theme.rock.flattenY ?? 1
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
        // flatShading은 노이즈 변위 큰 바위에만 — 자갈(pebble)은 기존과 동일(부드러운 구, scope 밖).
        flatShading: isLargeRock && rockStyle === 'displaced',
      })
      applyCausticToStandardMaterial(mat, 'rock-caustic')
      applyWaterDepthToMaterial(mat)
      const geo = isLargeRock ? rockGeoBase : pebbleGeoBase
      const mesh = new THREE.Mesh(geo, mat)
      // 지형 표면에 안착(마운드 위/기복 위에 얹히도록 — 파묻힘/뜸 방지). 미니멀은 lift=0.
      mesh.position.set(p.x, p.y + this._terrainLift(p.x, p.z), p.z)
      // flattenY는 큰 바위에만 적용 — 자갈 스케일은 기존과 동일.
      const scaleY = isLargeRock ? p.scaleY * flattenY : p.scaleY
      mesh.scale.set(p.scaleX, scaleY, p.scaleZ)
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
      mesh.position.set(p.x, p.y + this._terrainLift(p.x, p.z), p.z)
      mesh.scale.set(p.scaleX, p.scaleY, p.scaleZ)
      mesh.rotation.set(p.rotX, p.rotY, p.rotZ)
      this.object3d.add(mesh)
      this._opaqueMaterials.push(mat)
      this._disposables.push({ material: mat })
    }
  }

  /* ── Coral clusters (산호초 테마 전용) ──
   * 가지 산호 = BranchSpec 실린더 병합(클러스터당 드로우콜 1) — MeshStandard(_opaqueMaterials).
   * 뇌 산호   = 노이즈 변위 반구(smooth) — MeshStandard(_opaqueMaterials).
   * 부채 산호 = alpha-discard 카드(그래스 셰이더 재사용, 스웨이 미세) — 전체 fan을 하나의
   *             InstancedMesh로 모아 드로우콜 1, 머티리얼은 _grassMaterials 편승(무드/투명 자동).
   * additive/반투명 대형 평면 금지(CLAUDE.md 투명 오버레이 함정) — 불투명 메시와 discard 카드만. */
  private _buildCoral(): void {
    const coralCfg = this._theme.coral
    if (!coralCfg) return

    const clusters = generateCoralClusters(coralCfg.seed, coralCfg.count, coralCfg.area)

    // 뇌 산호 무늬 텍스처 — brain 클러스터끼리 공유(lazy 1회 생성)
    let grooveTex: THREE.CanvasTexture | null = null

    interface FanCard {
      x: number
      z: number
      yaw: number
      scale: number
      height: number
      phase: number
      base: THREE.Color
      tip: THREE.Color
    }
    const fanCards: FanCard[] = []

    for (const cluster of clusters) {
      const colorHex = CORAL.palette[cluster.paletteIndex % CORAL.palette.length]

      if (cluster.type === 'branch') {
        const geo = createBranchCoralGeometry(cluster.seed, CORAL.branch.scale * cluster.scale)
        const mat = new THREE.MeshStandardMaterial({
          color: colorHex,
          roughness: CORAL.branch.roughness,
          metalness: 0,
          // 은은한 자기 색 자발광 — 어두운 무드에서도 채도가 완전히 죽지 않게(생기 보존).
          emissive: colorHex,
          emissiveIntensity: CORAL.emissiveIntensity,
        })
        applyCausticToStandardMaterial(mat, 'coral-branch-caustic')
        // 주의: applyWaterDepthToMaterial은 적용하지 않는다 — 청록 깊이 틴트가 주황/분홍을
        // 갈색으로 죽인다(캡처 루프 확인). 산호는 근경(z≥−4)이라 가장자리 알파 용해도 불필요.
        // 투명 슬라이더는 _opaqueMaterials 등록으로 동작한다.
        const mesh = new THREE.Mesh(geo, mat)
        // 리프 마운드 표면에 안착(모래에서 솟은 암초를 산호가 덮는 배치). 미니멀엔 coral 없음.
        const lift = this._terrainLift(cluster.x, cluster.z)
        mesh.position.set(cluster.x, AQUASCAPE.sandY - CORAL.branch.sinkDepth + lift, cluster.z)
        mesh.rotation.y = cluster.yaw
        this.object3d.add(mesh)
        this._opaqueMaterials.push(mat)
        this._disposables.push({ geometry: geo, material: mat })
      } else if (cluster.type === 'brain') {
        if (!grooveTex) {
          grooveTex = createBrainCoralTexture()
          this._disposables.push({ texture: grooveTex })
        }
        const geo = createBrainCoralGeometry(cluster.seed)
        const mat = new THREE.MeshStandardMaterial({
          color: colorHex,
          roughness: CORAL.brain.roughness,
          metalness: 0,
          emissive: colorHex,
          emissiveIntensity: CORAL.emissiveIntensity,
          map: grooveTex, // 미로 무늬(그레이스케일 × 팔레트 색)
          emissiveMap: grooveTex, // emissive 가산이 무늬를 씻지 않도록 같은 무늬로 변조
        })
        applyCausticToStandardMaterial(mat, 'coral-brain-caustic')
        // waterDepth 미적용 — 가지 산호와 동일 사유(청록 틴트의 갈색화 방지).
        const mesh = new THREE.Mesh(geo, mat)
        const lift = this._terrainLift(cluster.x, cluster.z)
        mesh.position.set(cluster.x, AQUASCAPE.sandY - CORAL.brain.sinkDepth + lift, cluster.z)
        mesh.rotation.y = cluster.yaw
        mesh.scale.setScalar(cluster.scale)
        this.object3d.add(mesh)
        this._opaqueMaterials.push(mat)
        this._disposables.push({ geometry: geo, material: mat })
      } else {
        // fan: 클러스터 중심 주변에 perCluster장 흩뿌림(클러스터 seed 기반 결정적 변주)
        const rng = mulberry32(cluster.seed)
        const col = new THREE.Color(colorHex)
        const base = col.clone().multiplyScalar(CORAL.fan.baseShade)
        const tip = col.clone().multiplyScalar(CORAL.fan.tipShade)
        for (let c = 0; c < CORAL.fan.perCluster; c++) {
          const ang = rng() * Math.PI * 2
          const dist = rng() * CORAL.fan.spreadRadius
          const yaw = cluster.yaw + (rng() - 0.5) * CORAL.fan.yawJitter
          const cardScale =
            CORAL.fan.cardScaleMin + rng() * (CORAL.fan.cardScaleMax - CORAL.fan.cardScaleMin)
          const phase = rng() * Math.PI * 2 * 0.9999
          fanCards.push({
            x: cluster.x + Math.cos(ang) * dist,
            z: cluster.z + Math.sin(ang) * dist,
            yaw,
            scale: cluster.scale * cardScale,
            height: CORAL.fan.height * cluster.scale * cardScale,
            phase,
            base,
            tip,
          })
        }
      }
    }

    if (fanCards.length === 0) return

    // 부채 카드 InstancedMesh — 그래스 카드 지오메트리(한 장)·셰이더 재사용, 스웨이만 미세하게.
    const fanTex = createCoralFanAlphaTexture()
    this._disposables.push({ texture: fanTex })

    const count = fanCards.length
    const iGeo = createGrassCardGeometry(1, CORAL.fan.cardHalfWidth)
    const offsets = new Float32Array(count * 3)
    const yaws = new Float32Array(count)
    const scales = new Float32Array(count)
    const heights = new Float32Array(count)
    const phases = new Float32Array(count)
    const baseColors = new Float32Array(count * 3)
    const tipColors = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const card = fanCards[i]
      offsets[i * 3] = card.x
      offsets[i * 3 + 1] = AQUASCAPE.sandY + 0.005 + this._terrainLift(card.x, card.z)
      offsets[i * 3 + 2] = card.z
      yaws[i] = card.yaw
      scales[i] = card.scale
      heights[i] = card.height
      phases[i] = card.phase
      baseColors[i * 3] = card.base.r
      baseColors[i * 3 + 1] = card.base.g
      baseColors[i * 3 + 2] = card.base.b
      tipColors[i * 3] = card.tip.r
      tipColors[i * 3 + 1] = card.tip.g
      tipColors[i * 3 + 2] = card.tip.b
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
        uSwaySpeed: { value: CORAL.fan.swaySpeed },
        uSwayAmplitude: { value: CORAL.fan.swayAmplitude },
        uSwaySpeed2: { value: CORAL.fan.swaySpeed2 },
        uSwayAmplitude2: { value: CORAL.fan.swayAmplitude2 },
        uLeafAlpha: { value: fanTex },
        uAlphaTest: { value: CORAL.fan.alphaTest },
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
