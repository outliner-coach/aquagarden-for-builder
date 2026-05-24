import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { FishKind } from './Fish'

/* ── GLB URL imports (Vite ?url) ── */

import clownfishUrl from '../assets/fish/clownfish.glb?url'
import butterflyfishUrl from '../assets/fish/butterflyfish.glb?url'
import lionfishUrl from '../assets/fish/lionfish.glb?url'
import tetraAUrl from '../assets/fish/tetra-a.glb?url'
import tetraBUrl from '../assets/fish/tetra-b.glb?url'

/* ── Types ── */

export type SpeciesId =
  | 'clownfish'
  | 'butterflyfish'
  | 'lionfish'
  | 'tetra-a'
  | 'tetra-b'

export interface FishSpecies {
  id: SpeciesId
  file: string
  kind: FishKind
  baseScale: number
  swimAmplitude: number
  swimSpeed: number
}

export interface FishPrototype {
  geometry: THREE.BufferGeometry
  baseScale: number
  swimAmplitude: number
  swimSpeed: number
}

/* ── Manifest ── */

export const FISH_SPECIES: readonly FishSpecies[] = [
  // 군집(schooling) — 소형 슬림어. (바가 매우 넓어 작으면 점처럼 보이므로 충분히 키운다)
  {
    id: 'tetra-a',
    file: tetraAUrl,
    kind: 'schooling',
    baseScale: 0.58,
    swimAmplitude: 0.3,
    swimSpeed: 1.2,
  },
  {
    id: 'tetra-b',
    file: tetraBUrl,
    kind: 'schooling',
    baseScale: 0.58,
    swimAmplitude: 0.25,
    swimSpeed: 1.3,
  },
  // 개체(individual) — 중형 관상어 (주인공, 더 크게)
  {
    id: 'clownfish',
    file: clownfishUrl,
    kind: 'individual',
    baseScale: 0.85,
    swimAmplitude: 0.4,
    swimSpeed: 0.8,
  },
  {
    id: 'butterflyfish',
    file: butterflyfishUrl,
    kind: 'individual',
    baseScale: 0.9,
    swimAmplitude: 0.35,
    swimSpeed: 0.7,
  },
  {
    id: 'lionfish',
    file: lionfishUrl,
    kind: 'individual',
    baseScale: 0.95,
    swimAmplitude: 0.45,
    swimSpeed: 0.6,
  },
]

/* ── Pure helpers (TDD) ── */

/**
 * 시드 기반 결정적 종 선택. 해당 kind의 종 중에서 선택한다.
 * Fish.ts의 pseudoRandom 패턴과 호환.
 */
export function pickSpecies(seed: number, kind: FishKind): SpeciesId {
  const candidates = FISH_SPECIES.filter((s) => s.kind === kind)
  const hash = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  const frac = hash - Math.floor(hash)
  const index = Math.floor(Math.abs(frac) * candidates.length) % candidates.length
  return candidates[index].id
}

/**
 * 모델을 원점 중심으로 옮기고 가장 긴 축의 길이가 1이 되도록 하는
 * scale/offset을 계산하는 순수 함수.
 */
export function computeNormalizeTransform(bbox: {
  min: { x: number; y: number; z: number }
  max: { x: number; y: number; z: number }
}): { scale: number; offset: { x: number; y: number; z: number } } {
  const sizeX = bbox.max.x - bbox.min.x
  const sizeY = bbox.max.y - bbox.min.y
  const sizeZ = bbox.max.z - bbox.min.z
  const maxDim = Math.max(sizeX, sizeY, sizeZ)

  const scale = maxDim > 0 ? 1 / maxDim : 1

  const offset = {
    x: -(bbox.min.x + sizeX / 2),
    y: -(bbox.min.y + sizeY / 2),
    z: -(bbox.min.z + sizeZ / 2),
  }

  return { scale, offset }
}

/* ── Loading util (side-effect, no unit test) ── */

/**
 * 모든 종의 GLB를 로드하고 geometry를 추출·정규화·+X 정렬한다.
 * SkinnedMesh의 geometry(바인드 포즈)만 추출해 정적 메시로 쓴다.
 * AnimationMixer/SkeletonUtils 사용하지 않음.
 */
export async function loadFishPrototypes(): Promise<Map<SpeciesId, FishPrototype>> {
  const loader = new GLTFLoader()
  const prototypes = new Map<SpeciesId, FishPrototype>()

  const loadPromises = FISH_SPECIES.map(async (species) => {
    try {
      const gltf = await loader.loadAsync(species.file)
      const geometry = extractGeometry(gltf.scene)
      if (!geometry) {
        console.warn(`[fishAssets] ${species.id}: 메시를 찾을 수 없음, 스킵`)
        return
      }

      normalizeAndAlignGeometry(geometry)

      prototypes.set(species.id, {
        geometry,
        baseScale: species.baseScale,
        swimAmplitude: species.swimAmplitude,
        swimSpeed: species.swimSpeed,
      })
    } catch (err) {
      console.warn(`[fishAssets] ${species.id} 로드 실패, 스킵:`, err)
    }
  })

  await Promise.all(loadPromises)
  return prototypes
}

/**
 * GLTF 씬의 모든 메시/프리미티브 geometry를 병합해 단일 BufferGeometry로 만든다.
 * 각 프리미티브의 머티리얼 색(baseColorFactor → material.color)을 **버텍스 컬러로 베이크**해
 * 종별 고유 색(몸통/줄무늬/눈 등)을 보존한다. SkinnedMesh여도 geometry만 사용(skin/bone 무시).
 *
 * 주의: GLB는 1 메시에 머티리얼별 프리미티브가 여러 개다(예: clownfish 4개). 첫 하나만
 * 가져오면 물고기의 일부만 렌더되고 색도 사라진다(과거 "물고기 안 보임" 사고의 원인).
 */
function extractGeometry(scene: THREE.Group): THREE.BufferGeometry | null {
  const parts: THREE.BufferGeometry[] = []

  // CRITICAL: 노드(scene-graph) 회전을 geometry에 굽는다. 로컬 geometry만 쓰면
  // Quaternius 모델이 누운/수직(머리 아래) 상태로 나온다. world matrix 적용 필수.
  scene.updateMatrixWorld(true)

  scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return // SkinnedMesh도 Mesh의 하위
    const src = child.geometry
    if (!src.attributes.position) return

    // position/normal만 남긴 깨끗한 비인덱스 geometry (병합 호환)
    const g = src.clone().toNonIndexed()
    g.applyMatrix4(child.matrixWorld) // 노드 변환을 정점에 적용
    const clean = new THREE.BufferGeometry()
    clean.setAttribute('position', g.attributes.position)
    if (g.attributes.normal) {
      clean.setAttribute('normal', g.attributes.normal)
    } else {
      clean.computeVertexNormals()
    }

    // 프리미티브 머티리얼 색을 버텍스 컬러로 베이크
    const mat = Array.isArray(child.material) ? child.material[0] : child.material
    const col = new THREE.Color(0xffffff)
    if (mat && 'color' in mat && (mat as THREE.MeshStandardMaterial).color) {
      col.copy((mat as THREE.MeshStandardMaterial).color)
      // glTF baseColorFactor가 어두운 편이라 종 색이 또렷이 읽히도록 약간 밝게(클램프)
      const GAIN = 1.4
      col.setRGB(Math.min(1, col.r * GAIN), Math.min(1, col.g * GAIN), Math.min(1, col.b * GAIN))
    }
    const n = clean.attributes.position.count
    const colors = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      colors[i * 3] = col.r
      colors[i * 3 + 1] = col.g
      colors[i * 3 + 2] = col.b
    }
    clean.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    parts.push(clean)
  })

  if (parts.length === 0) return null
  return parts.length === 1 ? parts[0] : mergeGeometries(parts, false)
}

/**
 * geometry를 원점 중심으로 이동하고, 가장 긴 축 길이가 1이 되도록 스케일링하며,
 * 진행 방향이 +X가 되도록 회전한다.
 * Quaternius 어류 GLB는 기본 정면이 +Z이므로 -90도 Y축 회전을 적용한다.
 */
function normalizeAndAlignGeometry(geometry: THREE.BufferGeometry): void {
  geometry.computeBoundingBox()
  const bbox = geometry.boundingBox!

  const { scale, offset } = computeNormalizeTransform({
    min: { x: bbox.min.x, y: bbox.min.y, z: bbox.min.z },
    max: { x: bbox.max.x, y: bbox.max.y, z: bbox.max.z },
  })

  // 중심 이동
  geometry.translate(offset.x, offset.y, offset.z)

  // 스케일링 (가장 긴 축 = 1)
  geometry.scale(scale, scale, scale)

  // +Z 정면 → +X 정면: Y축 -90도 회전
  geometry.rotateY(-Math.PI / 2)

  // 변환 후 bounding box 재계산
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
}
