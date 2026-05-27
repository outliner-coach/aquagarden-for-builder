export const WINDOW = {
  height: 220,
  topMargin: 0,
  // 패널 펼침 시 바 위/아래에 추가하는 여백(px). 확장 창 높이 = 바 높이 + panelExtra.
  // 패널(헤더+슬라이더+토글+먹이/놀래키기+힌트+종료) 전체(~406px)가 위·아래 어느 방향으로
  // 펼쳐도 잘리지 않도록 충분히 크게(위로 펼칠 때 top-right 버튼 위로 패널이 다 들어가야 함).
  panelExtra: 400,
  // 캔버스 하단 페이드(px). 수조 바 아래 가장자리에서 불투명한 모래가 하드 컷되어 (특히 패널
  // 펼침 시) 투명 영역 위에 가로선으로 보이던 것을 마스크 그라디언트로 부드럽게 용해한다.
  canvasBottomFadePx: 26,
  // 모서리 드래그 리사이즈 범위 (clampSize)
  minWidth: 400,
  minHeight: 80,
  maxHeight: 350,
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

export const ZOOM = {
  min: 1.0, // 기본(축소 없음)
  max: 2.0, // 최대 2배 확대
  default: 1.0,
  wheelStep: 0.1, // 휠 한 칸당 줌 증감
} as const

export const AQUASCAPE = {
  sandY: -1.8,
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
  /** 틴트(색 헤이즈) 포화 깊이 — 알파 페이드와 분리해 수중 무드 유지 */
  depthFar: 10.0,
  maxTintStrength: 0.3,
  /**
   * 알파 페이드 포화 깊이. 모래 평면 먼 가장자리(뷰 깊이≈16)보다 앞에 두어
   * 가장자리에서 알파가 0에 도달 → 하드 컷(수평선) 대신 수중 헤이즈로 용해.
   * 변경 시 waterDepthHelpers.test.ts의 "먼 가장자리 알파 0" 가드 확인.
   */
  alphaDepthFar: 15.0,
  /** alphaDepthFar에서의 페이드량. 1.0=완전 투명(가장자리 용해) */
  maxAlphaFade: 1.0,
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
} as const

export const SCENE = {
  /** factor가 이 값 이하이면 Aquascape를 visible=false로 전환해 드로우 비용 제거 */
  invisibleThreshold: 0.01,
  defaultTransparency01: 0,
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

export const DIALOGUE = {
  /** 말풍선 표시 유지 시간 (ms) */
  holdMs: 3000,
  /** 말풍선 페이드아웃 시간 (ms) */
  fadeMs: 150,
  /** 클릭 지점으로부터 말풍선 Y 오프셋 (px, 위로) */
  offsetY: -40,
  /** 말풍선 최대 폭 (px) */
  maxWidth: 220,
  /** 화면 경계 여백 (px) */
  edgePadding: 12,
} as const

export const LURE = {
  /** attract 조향 가중치 (부드럽게 모임) */
  attractWeight: 0.8,
  /** attract 유효 반경 */
  attractRadius: 8,
  /** flee 조향 가중치 (잽싸게 도망) */
  fleeWeight: 5.0,
  /** flee 유효 반경 */
  fleeRadius: 6,
  /** 놀래키기 지속 시간 (ms) */
  scareDurationMs: 1200,
  /** 놀래키기 동안 최대 속도 배율 */
  scareSpeedMultiplier: 2.5,
} as const

export const FOOD = {
  /** 한 번 클릭 시 생성되는 먹이 수 */
  spawnCount: 5,
  /** 먹이 낙하 속도 (units/s) */
  fallSpeed: 1.2,
  /** 먹이 입자 최대 풀 크기 */
  maxParticles: 20,
  /** 먹이 입자 수명 (초) */
  lifetime: 6,
  /** 먹이 입자 크기 */
  size: 0.06,
  /** 섭취 판정 반경 */
  eatRadius: 0.5,
  /** 스폰 위치 Y 오프셋 (수면 근처에서 떨어짐) */
  spawnYOffset: 1.5,
  /** 스폰 XZ 산포 */
  spawnSpread: 0.4,
  /** 먹이 색상 */
  color: [0.9, 0.6, 0.2] as readonly [number, number, number],
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
  // 파괴적 액션(종료) — 평상시 옅은 빨강 테두리, 무장 시 채움.
  danger: '#f87171',
  dangerFill: 'rgba(248, 113, 113, 0.92)',
} as const

export const FEATURE = {
  /** 특별 개체 스폰 가시 영역 (FISH.bounds의 중앙·전면 부분집합) */
  spawnArea: { minX: -5, maxX: 5, minY: -0.4, maxY: 1.2, minZ: -1.2, maxZ: 0.2 },
} as const

export const DRAG = {
  // 플로팅 버튼: 이 거리(px) 이내 이동은 '클릭'(패널 토글)으로 간주. 미세 지터로 토글이
  // 스킵되던 문제(#4) 방지. 화면 좌표(screenX/Y) 기준.
  clickThresholdPx: 4,
} as const
