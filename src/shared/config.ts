export const WINDOW = {
  height: 220,
  topMargin: 0,
} as const

export const FISH = {
  min: 0,
  max: 60,
  default: 18,
} as const

export const LIGHT = {
  minIntensity: 0.1,
  maxIntensity: 2.0,
  default01: 0.75,
} as const

export const BUBBLE = {
  maxParticles: 80,
} as const

export const CAMERA = {
  fov: 50,
  near: 0.1,
  far: 100,
} as const

export const AQUASCAPE = {
  sandY: -1.8,
} as const

export const COLORS = {
  point: '#4fd1c5',
  panelBg: 'rgba(15, 23, 28, 0.82)',
  buttonBg: 'rgba(15, 23, 28, 0.7)',
  border: 'rgba(255, 255, 255, 0.08)',
  textPrimary: 'rgba(255, 255, 255, 0.92)',
  textSecondary: 'rgba(255, 255, 255, 0.6)',
  textDisabled: 'rgba(255, 255, 255, 0.35)',
  toggleOff: 'rgba(255, 255, 255, 0.2)',
  sliderTrackEmpty: 'rgba(255, 255, 255, 0.15)',
} as const
