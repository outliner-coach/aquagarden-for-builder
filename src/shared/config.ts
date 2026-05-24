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
  minEnvIntensity: 0.15,
  maxEnvIntensity: 0.8,
  default01: 0.75,
  /** PMREM 환경맵 생성 시 블러 시그마. 높을수록 RoomEnvironment의 직사각 패널이 부드럽게 퍼짐. */
  envBlurSigma: 0.5,
} as const

export const BUBBLE = {
  maxParticles: 80,
  surfaceY: 2.0,
  floorY: -1.8,
  riseSpeed: 0.6,
  wobbleAmplitude: 0.15,
  wobbleSpeed: 2.0,
  size: 0.08,
  sizeMin: 0.04,
  sizeMax: 0.12,
  surfaceFadeRange: 0.5,
  softSpriteRes: 64,
  spreadX: 20,
} as const

export const CAMERA = {
  fov: 50,
  near: 0.1,
  far: 100,
} as const

export const AQUASCAPE = {
  sandY: -1.8,
  glassEdgeOpacity: 0.05,
} as const

export const PLANT = {
  alphaTest: 0.5,
  swaySpeed: 1.2,
  swayAmplitude: 0.08,
  /** 2차 저주파 흔들림 — 유기적 움직임 연출 */
  swaySpeed2: 0.7,
  swayAmplitude2: 0.03,
  species: [
    {
      name: 'fine-carpet',
      count: 140,
      minHeight: 0.05,
      maxHeight: 0.12,
      minScale: 0.6,
      maxScale: 0.9,
      baseColor: [0.24, 0.56, 0.18] as [number, number, number],
      tipColor: [0.38, 0.72, 0.28] as [number, number, number],
      colorVariation: 0.08,
      area: { minX: -13, maxX: 15, minZ: -4.5, maxZ: -1.8 },
      seed: 100,
      quadCount: 2,
      cardHalfWidth: 0.10,
    },
    {
      name: 'carpet',
      count: 150,
      minHeight: 0.10,
      maxHeight: 0.22,
      minScale: 0.7,
      maxScale: 1.1,
      baseColor: [0.2, 0.52, 0.15] as [number, number, number],
      tipColor: [0.32, 0.68, 0.24] as [number, number, number],
      colorVariation: 0.08,
      area: { minX: -12, maxX: 14, minZ: -4.5, maxZ: -2.0 },
      seed: 101,
      quadCount: 2,
      cardHalfWidth: 0.12,
    },
    {
      name: 'bush',
      count: 90,
      minHeight: 0.22,
      maxHeight: 0.42,
      minScale: 0.85,
      maxScale: 1.35,
      baseColor: [0.18, 0.44, 0.14] as [number, number, number],
      tipColor: [0.3, 0.62, 0.22] as [number, number, number],
      colorVariation: 0.10,
      area: { minX: -10, maxX: 12, minZ: -4.2, maxZ: -2.3 },
      seed: 202,
      quadCount: 3,
      cardHalfWidth: 0.14,
    },
    {
      name: 'mid-green',
      count: 55,
      minHeight: 0.18,
      maxHeight: 0.35,
      minScale: 0.8,
      maxScale: 1.2,
      baseColor: [0.16, 0.48, 0.2] as [number, number, number],
      tipColor: [0.26, 0.65, 0.3] as [number, number, number],
      colorVariation: 0.10,
      area: { minX: -11, maxX: 13, minZ: -4.0, maxZ: -2.5 },
      seed: 150,
      quadCount: 2,
      cardHalfWidth: 0.13,
    },
    {
      name: 'tall',
      count: 45,
      minHeight: 0.38,
      maxHeight: 0.62,
      minScale: 0.9,
      maxScale: 1.4,
      baseColor: [0.15, 0.4, 0.12] as [number, number, number],
      tipColor: [0.28, 0.58, 0.2] as [number, number, number],
      colorVariation: 0.12,
      area: { minX: -11, maxX: 13, minZ: -5.0, maxZ: -3.2 },
      seed: 303,
      quadCount: 3,
      cardHalfWidth: 0.15,
    },
  ],
} as const

export const HARDSCAPE = {
  seed: 404,
  rockCount: 12,
  pebbleCount: 16,
  driftwoodCount: 4,
  clusterCount: 3,
  clusterSpread: 3.5,
  area: { minX: -12, maxX: 14, minZ: -5, maxZ: -2 },
  rock: {
    minScale: 0.18,
    maxScale: 0.55,
    maxHeightAboveSand: 0.7,
    colors: [0x5a5550, 0x4b4540, 0x6e6860, 0x3e3832, 0x7a7068] as readonly number[],
  },
  pebble: {
    minScale: 0.04,
    maxScale: 0.12,
  },
  driftwood: {
    minLength: 1.8,
    maxLength: 3.5,
    minRadius: 0.07,
    maxRadius: 0.13,
    maxHeightAboveSand: 0.9,
    color: 0x4a2e1e,
    colorAlt: 0x3d2518,
  },
  sand: {
    normalStrength: 0.3,
    colorVariation: 0.06,
  },
} as const

export const CAUSTIC = {
  intensity: 0.55,
  contrast: 0.75,
  scale: 0.18,
  scroll1: { speed: 0.08, angle: 0.3 },
  scroll2: { speed: 0.06, angle: 2.1 },
  textureSize: 256,
  gridCells: 6,
} as const

export const WATER = {
  tintColor: [0.15, 0.55, 0.52] as readonly [number, number, number],
  depthNear: 4.0,
  depthFar: 10.0,
  maxTintStrength: 0.3,
  maxAlphaFade: 0.45,
  veil: {
    topColor: [35, 105, 118] as readonly [number, number, number],
    midColor: [30, 110, 108] as readonly [number, number, number],
    bottomColor: [24, 98, 88] as readonly [number, number, number],
    maxAlpha: 0.14,
    brightnessScale: 0.06,
    midAlphaRatio: 0.50,
    bottomAlphaRatio: 0.22,
    midStop: 55,
  },
  shaft: {
    baseOpacity: 0.30,
    driftSpeed: 0.18,
    height: 5.5,
    topY: 2.6,
    color: [0.75, 0.9, 1.0] as readonly [number, number, number],
    zPos: -1.5,
    xPositions: [-7, -2.5, 3, 8] as readonly number[],
    widths: [2.4, 3.0, 2.2, 2.7] as readonly number[],
    angles: [0.12, -0.08, 0.15, -0.05] as readonly number[],
  },
} as const

export const GLOW = {
  count: 8,
  size: 0.2,
  color: [0.4, 0.85, 0.8] as readonly [number, number, number],
  minOpacity: 0.04,
  maxOpacity: 0.12,
  pulseSpeed: 1.5,
  spriteRes: 64,
  spreadX: 16,
  yMin: -1.0,
  yMax: 1.6,
  zMin: -2.0,
  zMax: 0.0,
  driftSpeed: 0.1,
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
