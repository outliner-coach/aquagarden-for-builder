import { FISH } from './config'

export function clampFishCount(n: number): number {
  return Math.min(FISH.max, Math.max(FISH.min, Math.floor(n)))
}

export function clampBrightness01(n: number): number {
  return Math.min(1, Math.max(0, n))
}
