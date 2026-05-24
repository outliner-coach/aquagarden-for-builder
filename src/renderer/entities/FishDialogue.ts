import * as THREE from 'three'
import { DIALOGUE, COLORS } from '../../shared/config'
import { getSpecies } from './speciesRegistry'
import type { SpeciesId } from './speciesRegistry'
import { pickDialogue } from './dialogueHelpers'
import type { FishSchool } from './FishSchool'

/**
 * 물고기 클릭 → 어종별 랜덤 대사 말풍선(DOM).
 * clickThrough===false && hidden===false 일 때만 동작.
 */
export class FishDialogue {
  private readonly _container: HTMLElement
  private readonly _camera: THREE.PerspectiveCamera
  private readonly _canvas: HTMLCanvasElement
  private readonly _fishSchool: FishSchool
  private readonly _isInteractive: () => boolean
  private readonly _raycaster = new THREE.Raycaster()
  private readonly _pointer = new THREE.Vector2()

  private _bubble: HTMLDivElement | null = null
  private _hideTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    container: HTMLElement,
    camera: THREE.PerspectiveCamera,
    canvas: HTMLCanvasElement,
    fishSchool: FishSchool,
    isInteractive: () => boolean,
  ) {
    this._container = container
    this._camera = camera
    this._canvas = canvas
    this._fishSchool = fishSchool
    this._isInteractive = isInteractive

    this._canvas.addEventListener('pointerdown', this._onPointerDown)
  }

  dispose(): void {
    this._canvas.removeEventListener('pointerdown', this._onPointerDown)
    this._removeBubble()
  }

  private _onPointerDown = (e: PointerEvent): void => {
    if (!this._isInteractive()) return

    const rect = this._canvas.getBoundingClientRect()
    this._pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this._pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

    this._raycaster.setFromCamera(this._pointer, this._camera)
    const fish = this._fishSchool.raycast(this._raycaster)
    if (!fish) return

    const speciesId = fish.speciesId
    if (!speciesId) return

    const line = this._pickLine(speciesId)
    if (!line) return

    this._showBubble(line, e.clientX, e.clientY)
  }

  private _pickLine(speciesId: SpeciesId): string | null {
    const species = getSpecies(speciesId)
    if (species.dialogue.length === 0) return null
    const idx = pickDialogue(species.dialogue.length, Math.random())
    return species.dialogue[idx]
  }

  private _showBubble(text: string, clickX: number, clickY: number): void {
    this._removeBubble()

    const bubble = document.createElement('div')
    bubble.textContent = text
    bubble.style.cssText = [
      'position:fixed',
      'z-index:100',
      `max-width:${DIALOGUE.maxWidth}px`,
      `padding:8px 12px`,
      `border-radius:8px`,
      `background:${COLORS.panelBg}`,
      `border:1px solid ${COLORS.border}`,
      `color:${COLORS.textPrimary}`,
      'font-size:13px',
      'line-height:1.4',
      'pointer-events:none',
      'opacity:0',
      `transition:opacity ${DIALOGUE.fadeMs}ms ease-out`,
      'white-space:pre-wrap',
      'word-break:keep-all',
    ].join(';')

    this._container.appendChild(bubble)
    this._bubble = bubble

    // 위치 계산 — 클릭 지점 위쪽, 화면 경계 클램프
    requestAnimationFrame(() => {
      const bw = bubble.offsetWidth
      const bh = bubble.offsetHeight
      const pad = DIALOGUE.edgePadding

      let left = clickX - bw / 2
      let top = clickY + DIALOGUE.offsetY - bh

      left = Math.max(pad, Math.min(left, window.innerWidth - bw - pad))
      top = Math.max(pad, Math.min(top, window.innerHeight - bh - pad))

      bubble.style.left = `${left}px`
      bubble.style.top = `${top}px`
      bubble.style.opacity = '1'
    })

    this._hideTimer = setTimeout(() => {
      if (this._bubble === bubble) {
        bubble.style.opacity = '0'
        setTimeout(() => {
          if (this._bubble === bubble) {
            this._removeBubble()
          }
        }, DIALOGUE.fadeMs)
      }
    }, DIALOGUE.holdMs)
  }

  private _removeBubble(): void {
    if (this._hideTimer !== null) {
      clearTimeout(this._hideTimer)
      this._hideTimer = null
    }
    if (this._bubble) {
      this._bubble.remove()
      this._bubble = null
    }
  }
}
