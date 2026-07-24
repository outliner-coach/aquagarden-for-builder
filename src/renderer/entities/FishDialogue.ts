import * as THREE from 'three'
import { DIALOGUE, COLORS, TOKEN } from '../../shared/config'
import { getSpecies } from './speciesRegistry'
import type { SpeciesId } from './speciesRegistry'
import { pickDialogue } from './dialogueHelpers'
import type { FishSchool } from './FishSchool'
import { windowBand, formatReset } from '../../shared/tokenHelpers'
import type { UsageLevel } from '../../shared/tokenHelpers'
import { usageLineForSpecies } from './tokenLines'
import type { UsageLineContext } from './tokenLines'
import type { TokenUsage } from '../../shared/types'

/** setTokenUsageProvider에 주입하는 콜백 — 탭 시점의 최신 표시 여부·사용량 스냅샷을 읽는다. */
export type TokenUsageProvider = () => { show: boolean; usage: TokenUsage | null }

/** resolveTapLineSource의 판정 결과. usage면 대사 생성에 필요한 band·ctx까지 함께 담는다. */
export type TapLineSource = { kind: 'usage'; band: UsageLevel; ctx: UsageLineContext } | { kind: 'flavor' }

/**
 * 탭 시 (a) 평소 어종 flavor 대사 vs (b) 토큰 사용량 통계 대사 중 무엇을 말할지, 그리고 (b)일 때
 * 어느 창(주간/5시간)을 인용할지 결정하는 순수 함수. roll∈[0,1)은 호출자(handleTap)가
 * Math.random()으로 주입 — 순수·결정적(내부에서 시계·난수 미접근, now도 주입).
 *
 * 가드: show===false·usage null·state≠'ok'·fiveHour|weekly 창 일부 누락이면 항상 flavor로 폴백
 * (TokenUsage.fiveHour/weekly는 state==='ok'여도 파싱 결과에 따라 한쪽만 채워질 수 있어 optional
 * 이다 — 창이 하나라도 없으면 band/ctx를 안전하게 못 만든다).
 *
 * 선택: roll >= usageTapChance(기본 0.4) → 평소 flavor(다수 ~60%, 어종 개성 대사 복원). 그 미만
 * → 사용량 통계, 이때 하위 구간을 반으로 갈라 roll < usageTapChance/2면 주간, 아니면 5시간(사용량
 * 탭 안에서 ~50/50). 고른 창으로 band·ctx를 만든다 — 주간은 페이스 인지(windowBand isWeekly=true)
 * +리셋 절대표기("금 18시"), 5시간은 절대치+리셋 상대표기("2시간 11분 후"). 이렇게 사용자가 두
 * 데이터셋과 두 톤을 번갈아 본다. 패널 링 게이지는 이 톤과 무관하게 절대치 색을 쓴다.
 */
export function resolveTapLineSource(
  show: boolean,
  usage: TokenUsage | null,
  now: number,
  roll: number,
): TapLineSource {
  if (!show || usage === null || usage.state !== 'ok') return { kind: 'flavor' }
  const { fiveHour, weekly } = usage
  if (fiveHour === undefined || weekly === undefined) return { kind: 'flavor' }
  if (roll >= TOKEN.usageTapChance) return { kind: 'flavor' } // 다수(~1−usageTapChance)는 평소 대사
  const isWeekly = roll < TOKEN.usageTapChance / 2 // 사용량 구간을 반으로 갈라 주간/5시간 ~50/50
  const win = isWeekly ? weekly : fiveHour
  const band = windowBand(win, isWeekly, now)
  const ctx: UsageLineContext = {
    label: isWeekly ? '주간' : '5시간',
    pct: win.pct,
    resetText: formatReset(win.resetsAt, now, isWeekly ? 'absolute' : 'relative'),
  }
  return { kind: 'usage', band, ctx }
}

/**
 * 물고기 클릭 → 대사 말풍선(DOM).
 * clickThrough===false && hidden===false 일 때만 동작.
 * `setTokenUsageProvider`로 provider를 등록하면(선택), 표시 on + 사용량 데이터 준비 시 탭의 약
 * TOKEN.usageTapChance 확률로 토큰 사용량 통계를 말하고(주간/5시간 ~50/50), 나머지 다수는 어종
 * flavor 대사를 말한다(resolveTapLineSource가 roll로 판정). provider 미등록(기본값)이면 이전과
 * 동일하게 flavor 대사만 사용한다(하위호환).
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
  private _tokenUsageProvider: TokenUsageProvider | null = null
  private _usageLineIdx = 0

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
  }

  dispose(): void {
    this._removeBubble()
  }

  /**
   * 토큰 사용량 provider 등록(선택). null로 호출하면 해제 — 이전 flavor-only 동작으로 복귀.
   * main.ts가 아직 이 setter를 호출하지 않아도(provider 미등록) 기존 동작은 그대로다.
   */
  setTokenUsageProvider(provider: TokenUsageProvider | null): void {
    this._tokenUsageProvider = provider
  }

  /**
   * 캔버스 탭(누르고 임계 이내에서 뗌) 처리 — main.ts의 탭/드래그 중재가 호출한다.
   * (기존에는 자체 pointerdown 즉발이었으나, 드래그=카메라 궤도와 공존하도록 탭으로 이전.
   * 발동 조건·레이캐스트·대사 선택 로직은 동일.)
   */
  handleTap(clientX: number, clientY: number): void {
    if (!this._isInteractive()) return

    const rect = this._canvas.getBoundingClientRect()
    this._pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
    this._pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1

    this._raycaster.setFromCamera(this._pointer, this._camera)
    const fish = this._fishSchool.raycast(this._raycaster)
    if (!fish) return

    const speciesId = fish.speciesId
    if (!speciesId) return

    const line = this._resolveLine(speciesId)
    if (!line) return

    this._showBubble(line, clientX, clientY)
  }

  /**
   * 탭한 물고기가 할 말을 고른다 — provider가 등록돼 있고 resolveTapLineSource가 'usage'를
   * 판정하면 사용량 대사, 그 외(provider 미등록·flavor 판정 포함)는 기존 어종 flavor 대사.
   * now(Date.now()/1000)와 roll(Math.random())은 여기(라이브 UI 경계)에서만 읽어 순수 헬퍼엔
   * 주입만 한다(순수성 유지 — 헬퍼 내부에서 시계·난수 미접근).
   */
  private _resolveLine(speciesId: SpeciesId): string | null {
    if (this._tokenUsageProvider) {
      const { show, usage } = this._tokenUsageProvider()
      const source = resolveTapLineSource(show, usage, Date.now() / 1000, Math.random())
      if (source.kind === 'usage') {
        return usageLineForSpecies(speciesId, source.band, source.ctx, this._nextUsageLineIdx())
      }
    }
    return this._pickLine(speciesId)
  }

  private _pickLine(speciesId: SpeciesId): string | null {
    const species = getSpecies(speciesId)
    if (species.dialogue.length === 0) return null
    const idx = pickDialogue(species.dialogue.length, Math.random())
    return species.dialogue[idx]
  }

  /** 사용량 대사 idx용 내부 증가 카운터(라이브 UI라 Math.random도 무방하나, 순회로 다양성 보장). */
  private _nextUsageLineIdx(): number {
    const idx = this._usageLineIdx
    this._usageLineIdx += 1
    return idx
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

    // 화자 연결 꼬리 — 말풍선 하단에서 클릭한 물고기 쪽을 가리키는 45° 회전 사각형.
    // 배경·테두리를 말풍선과 맞춰 이어져 보이게 한다(어느 물고기의 대사인지 시각 연결).
    const tail = document.createElement('div')
    const ts = DIALOGUE.tailSize
    tail.style.cssText = [
      'position:absolute',
      `width:${ts}px`,
      `height:${ts}px`,
      `bottom:${-ts / 2 - 1}px`,
      `background:${COLORS.panelBg}`,
      `border-right:1px solid ${COLORS.border}`,
      `border-bottom:1px solid ${COLORS.border}`,
      'transform:rotate(45deg)',
      'pointer-events:none',
    ].join(';')
    bubble.appendChild(tail)

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
      // 꼬리를 클릭 x에 맞춰 말풍선 내에서 좌우 이동(모서리 라운드 안쪽으로 클램프)
      const tailLeft = Math.max(10, Math.min(clickX - left - ts / 2, bw - ts - 10))
      tail.style.left = `${tailLeft}px`
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
