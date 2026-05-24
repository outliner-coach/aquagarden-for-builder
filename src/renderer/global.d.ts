import type { AquaBridge } from '../shared/types'

declare global {
  interface Window {
    aqua: AquaBridge
  }
}
