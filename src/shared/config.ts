export const WINDOW = {
  height: 220,
  topMargin: 0,
  // 패널 확장 시 창 높이. 패널이 바(height)보다 길어 잘리는 것을 막기 위해
  // 펼칠 때만 이 높이로 키우고, 접으면 height로 되돌린다. (캔버스는 height에 고정)
  expandedHeight: 360,
} as const

export const FISH = {
  min: 0,
  max: 60,
  default: 18,
  spawnPerTick: 3,
  bounds: {
    minX: -10,
    maxX: 10,
    minY: -1.2,
    maxY: 1.8,
    minZ: -2.5,
    maxZ: 0.5,
  },
} as const

export const LIGHT = {
  minIntensity: 0.1,
  maxIntensity: 2.0,
  minAmbient: 0.05,
  maxAmbient: 0.4,
  default01: 0.75,
} as const

export const BUBBLE = {
  maxParticles: 80,
  surfaceY: 2.0,
  floorY: -1.8,
  riseSpeed: 0.6,
  wobbleAmplitude: 0.15,
  wobbleSpeed: 2.0,
  size: 0.08,
  spreadX: 20,
} as const

export const CAMERA = {
  fov: 50,
  near: 0.1,
  far: 100,
} as const

export const AQUASCAPE = {
  sandY: -1.8,
} as const

export const BOIDS = {
  separationRadius: 1.5,
  alignmentRadius: 3.0,
  cohesionRadius: 3.0,
  separationWeight: 2.0,
  alignmentWeight: 1.0,
  cohesionWeight: 1.0,
  maxSpeed: 2.0,
  maxSteer: 3.0,
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
