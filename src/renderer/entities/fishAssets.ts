import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { applyCausticToStandardMaterial } from './caustics'
import { applyWaterDepthToMaterial } from './waterDepth'

/* ── Re-exports from speciesRegistry (기존 import 경로 보존) ── */

export { FISH_SPECIES, pickSpecies } from './speciesRegistry'
export type { SpeciesId, FishSpecies } from './speciesRegistry'
import { FISH_SPECIES } from './speciesRegistry'
import type { SpeciesId } from './speciesRegistry'

/* ── Types ── */

export interface FishPrototype {
  /** 원본 GLB 씬(스킨 메시 + 본). Fish가 SkeletonUtils.clone 한다. */
  scene: THREE.Group
  /** 헤엄 애니메이션 클립(없으면 null). */
  clip: THREE.AnimationClip | null
  baseScale: number
  swimSpeed: number
  /** 가장 긴 축을 1로 만드는 스케일(1/maxDim). */
  normScale: number
  /** 모델 로컬 bbox 중심(원점 정렬용). */
  center: THREE.Vector3
}

/** bbox로부터 원점 중심 정렬 scale(1/maxDim)·offset 계산 (순수). */
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

/** 헤엄 클립 선택: 'Swimming_Normal' 우선, 없으면 'Swim' 포함, 없으면 첫 클립. */
function pickSwimClip(clips: THREE.AnimationClip[]): THREE.AnimationClip | null {
  if (clips.length === 0) return null
  return (
    clips.find((c) => /swimming_normal/i.test(c.name)) ??
    clips.find((c) => /swim/i.test(c.name)) ??
    clips[0]
  )
}

/* ── Rim light (onBeforeCompile 체이닝) ── */
function applyRimLight(mat: THREE.MeshStandardMaterial): void {
  const prev = mat.onBeforeCompile
  const prevKey = mat.customProgramCacheKey
  const uRimColor = { value: new THREE.Vector3(0.4, 0.6, 0.7) }
  const uRimPower = { value: 2.5 }
  mat.onBeforeCompile = (shader, renderer) => {
    prev.call(mat, shader, renderer)
    shader.uniforms.uRimColor = uRimColor
    shader.uniforms.uRimPower = uRimPower
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      `uniform vec3 uRimColor;\nuniform float uRimPower;\nvoid main() {`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
vec3 rimViewDir = normalize(vViewPosition);
float rimNdotV = abs(dot(normal, rimViewDir));
totalEmissiveRadiance += uRimColor * pow(1.0 - rimNdotV, uRimPower) * 0.5;`,
    )
  }
  mat.customProgramCacheKey = () => (prevKey ? prevKey.call(mat) : '') + '-rim'
}

/** 프로토타입 씬의 모든 MeshStandardMaterial에 커스틱+물깊이+림 적용(공유). */
function prepareMaterials(scene: THREE.Group): void {
  const seen = new Set<THREE.Material>()
  scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const mats = Array.isArray(child.material) ? child.material : [child.material]
    for (const m of mats) {
      if (!(m instanceof THREE.MeshStandardMaterial) || seen.has(m)) continue
      seen.add(m)
      applyCausticToStandardMaterial(m, 'fish-caustic')
      applyWaterDepthToMaterial(m)
      applyRimLight(m)
    }
  })
}

/* ── Loading util (side-effect) ── */

/**
 * 모든 종의 GLB를 로드해 프로토타입(scene + swim 클립 + 정규화 정보)을 만든다.
 * geometry를 추출/병합하지 않고 원본 스킨 씬·머티리얼·리그를 유지한다 → 원본 색 + 본 애니메이션.
 */
export async function loadFishPrototypes(): Promise<Map<SpeciesId, FishPrototype>> {
  const loader = new GLTFLoader()
  const prototypes = new Map<SpeciesId, FishPrototype>()

  await Promise.all(
    FISH_SPECIES.map(async (species) => {
      try {
        const gltf = await loader.loadAsync(species.file)
        const scene = gltf.scene
        scene.updateMatrixWorld(true)

        prepareMaterials(scene)

        const box = new THREE.Box3().setFromObject(scene)
        const size = new THREE.Vector3()
        box.getSize(size)
        const center = new THREE.Vector3()
        box.getCenter(center)
        const maxDim = Math.max(size.x, size.y, size.z) || 1

        prototypes.set(species.id, {
          scene,
          clip: pickSwimClip(gltf.animations),
          baseScale: species.baseScale,
          swimSpeed: species.swimSpeed,
          normScale: 1 / maxDim,
          center,
        })
      } catch (err) {
        console.warn(`[fishAssets] ${species.id} 로드 실패, 스킵:`, err)
      }
    }),
  )

  return prototypes
}
