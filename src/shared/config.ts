export const WINDOW = {
  height: 220,
  topMargin: 0,
  // 패널 펼침 시 추가 높이의 fallback(측정 실패/초기 1프레임용). 평소엔 패널 실제 높이를 측정해 대체.
  panelExtra: 400,
  // 측정한 패널 높이에 더하는 여백(px) — 패널 상단 오프셋(top:48)+하단 숨쉬기.
  panelGap: 60,
  // 캔버스 하단 페이드(px). 수조 바 아래 가장자리에서 불투명한 모래가 하드 컷되어 (특히 패널
  // 펼침 시) 투명 영역 위에 가로선으로 보이던 것을 마스크 그라디언트로 부드럽게 용해한다.
  canvasBottomFadePx: 26,
  // 캔버스 좌우 페이드(px). 창 경계에서 모래·수초가 세로선으로 뚝 끊기던 것을 하단과 동일하게 용해.
  canvasEdgeFadePx: 26,
  // 모서리 드래그 리사이즈 범위 (clampSize)
  minWidth: 400,
  minHeight: 80,
  maxHeight: 350,
  // 창 이동 시 어떤 모니터든 최소 이만큼(px) 보이면 이동을 허용한다(모니터 간 자유 이동).
  // 어디에도 이만큼 안 보이면 가장 가까운 모니터로 끌어당겨 완전 이탈(버튼째 사라짐)을 막는다.
  minVisibleOnMove: 80,
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
  /**
   * z축(카메라 방향) 유영 속도 상한. 얇은 바 수조에서 정면 유영이 잦으면 로우폴리 정면
   * 실루엣("반투명 상자")이 자주 노출된다 — 측면 유영 위주가 되도록 z만 상한한다.
   * (crawler 새우는 제외 — 바닥 거동 불변 가드)
   */
  maxZSpeed: 0.35,
} as const

/** 새우(바닥 기는 청소부) 전용 거동 상수. 일반 어종 유영과 차별화. */
export const SHRIMP = {
  /** 모래바닥(FISH.bounds.minY) 위로 띄울 목표 높이(머무는 띠의 중심). */
  floorOffset: 0.45,
  /** 바닥 띠로 끌어당기는 수직 부착력(스프링 상수). */
  floorPull: 4.0,
  /** 종종거림(scuttle) 한 주기 초. 멈칫→전진→멈칫. */
  scuttlePeriod: 1.7,
  /** 종종거림 멈칫 구간의 최저 속도 비율(0=완전정지). */
  scuttleMinFactor: 0.12,
} as const

export const LIGHT = {
  minIntensity: 0.1,
  maxIntensity: 2.0,
  minAmbient: 0.05,
  maxAmbient: 0.4,
  minEnvIntensity: 0.15,
  maxEnvIntensity: 0.8,
  default01: 0.75,
  /**
   * PMREM 환경맵 생성 시 블러 시그마(라디안). RoomEnvironment의 직사각 패널을 부드럽게 편다.
   * three의 blur는 패스당 최대 20샘플이라 이보다 크면 20으로 클립되며 콘솔 경고를 낸다.
   * 0.04는 클립 없이 최대 블러에 도달하는 지점(three.js 예제 관례값)으로, 시각 결과는 동일하다.
   */
  envBlurSigma: 0.04,
} as const

/**
 * 시간대(무드) 반응 조명. 시스템 시계 시각(0~24)을 밝기 배율 + 광원 색 틴트로 매핑한다.
 * OFF(기본)일 때는 적용하지 않는다(배율 1·흰색 = 현행과 동일). 인접 키프레임 사이는 24h 원형 보간.
 * 밤은 어둑·차가운 청색, 낮은 밝고 중립, 저녁은 따뜻한 앰버 톤 — 항상 떠 있는 힐링 위젯이라 은은하게.
 */
export const MOOD = {
  /** 무드 재계산 주기(ms). 시각은 천천히 변하므로 60초면 충분(렌더 루프와 무관). */
  updateIntervalMs: 60_000,
  /** 무드 변경 시 조명이 목표로 수렴하는 전환 시간(초). 토글 순간의 급변 방지 + 변화 인지. */
  transitionSeconds: 1.5,
  /**
   * 시각별 키프레임 { hour, scale(밝기 배율 0~1), tint(RGB 0~1) }. hour 오름차순.
   * 2026-07 강화: 라이브 QA에서 "심야에 켜도 차이를 못 느낌" 피드백 → 밤 배율을 크게 낮추고
   * 틴트 채도를 올렸다. 심야는 한낮의 절반 이하(테스트 가드).
   */
  keyframes: [
    { hour: 2, scale: 0.42, tint: [0.55, 0.72, 1.0] }, // 심야 — 확연히 어둑, 문라이트 블루
    { hour: 7, scale: 0.85, tint: [0.9, 0.96, 1.0] }, // 아침 — 서늘하고 맑음
    { hour: 13, scale: 1.0, tint: [1.0, 1.0, 1.0] }, // 한낮 — 가장 밝고 중립
    { hour: 18, scale: 0.8, tint: [1.0, 0.82, 0.6] }, // 저녁 — 진한 골든아워
    { hour: 21, scale: 0.6, tint: [1.0, 0.72, 0.52] }, // 밤 — 깊은 앰버
  ],
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

/**
 * 다시마(kelp) — 그래스 카드의 "키 큰 형제". 리본 지오메트리 + 버텍스 셰이더 벤딩.
 * 배치 파라미터(count/height/색/area/폴오프)는 테마별로 THEME.themes[].kelp에 두고,
 * 여기는 종 공통의 형태·움직임·텍스처 파라미터만 둔다.
 */
export const KELP = {
  /** alpha-discard 임계값(그래스와 동일 규약 — additive/반투명 평면 금지) */
  alphaTest: 0.5,
  /** 리본 세로 세그먼트 수(스펙 6~10). 링당 2버텍스 연속 스트립 */
  segments: 10,
  /** 뿌리 반폭(월드 유닛, instanceScale 곱 전) */
  baseHalfWidth: 0.22,
  /** 팁 반폭 비율(뿌리 대비) — kelpTaperHalfWidth로 단조 감소 */
  tipRatio: 0.35,
  /** 주 흔들림 — 저주파·대진폭(그래스 스웨이보다 느리고 크다). 뿌리 고정·팁 최대 */
  swaySpeed: 0.55,
  swayAmplitude: 0.34,
  /** 주 흔들림 위상의 월드 X 계수 — 숲을 가로지르는 파도감 */
  worldFreq: 0.55,
  /** 2차 미세 웨이브 — 위상이 h01을 따라 진행해 리본이 굽이치는 S자 곡률을 만든다 */
  swaySpeed2: 1.3,
  swayAmplitude2: 0.09,
  /** 2차 웨이브의 블레이드 방향 위상 진행량(라디안) */
  waveAlongBlade: 6.8,
  /** X 대비 Z 흔들림 비율(주·2차 공통) */
  zSwayRatio: 0.45,
  /** 프래그먼트 가장자리 음영(0=없음). 중앙 1+e, 가장자리 1-e 배율로 원통감 힌트 */
  edgeShade: 0.14,
  /** blade 알파 텍스처(캔버스) — 길쭉하고 가장자리가 물결치는 잎 실루엣 */
  blade: {
    texWidth: 64,
    texHeight: 512,
    /** 실루엣 샘플 수(위/아래 왕복 경로의 세로 분해능) */
    silhouetteSamples: 64,
    /** 뿌리/팁 반폭(캔버스 폭 대비 비율) — 지오메트리 테이퍼와 곱으로 적용됨 */
    rootHalf: 0.42,
    tipHalf: 0.3,
    /** 가장자리 물결 반복 수·진폭(반폭 대비 비율) */
    edgeWaveCount: 5.0,
    edgeWaveAmp: 0.18,
    /** 좌우 가장자리 물결 위상차(라디안) — 비대칭 유기감 */
    edgePhaseOffset: 2.1,
    /** 중심선 좌우 미앤더 진폭(폭 대비 비율)·반복 수. 뿌리는 고정(t^meanderRootLock 가중) */
    meanderAmp: 0.06,
    meanderCount: 1.6,
    meanderRootLock: 0.7,
    /** 팁 라운딩 구간(t 비율) — 마지막 구간에서 반폭을 0으로 수렴 */
    tipRoundSpan: 0.06,
  },
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

/**
 * 배경 테마(교체형). 테마별로 모래색·수초 종 배열(PLANT.species 항목 형식)·하드스케이프
 * 구성을 결정한다. 미니멀은 기존 상수를 그대로 참조해(복붙 중복 없음) 기존 사용자에게
 * 무변화(하위호환)다. kelp(다시마)·coral(산호) 시각 요소 config 필드는 이후 phase에서
 * 추가된다 — themeRegistry.ts의 BackgroundTheme는 인터페이스라 확장 가능.
 */
export const THEME = {
  defaultId: 'minimal',
  themes: [
    {
      id: 'minimal',
      displayName: '미니멀',
      // 과거 Aquascape.ts 로컬 상수 SAND_COLOR(0x9c8a6e)를 이곳으로 이동(하드코딩 제거).
      sandColor: 0x9c8a6e,
      plants: PLANT.species,
      hardscape: {
        seed: HARDSCAPE.seed,
        rockCount: HARDSCAPE.rockCount,
        pebbleCount: HARDSCAPE.pebbleCount,
        driftwoodCount: HARDSCAPE.driftwoodCount,
        clusterCount: HARDSCAPE.clusterCount,
        clusterSpread: HARDSCAPE.clusterSpread,
        area: HARDSCAPE.area,
        rock: HARDSCAPE.rock,
        pebble: HARDSCAPE.pebble,
        driftwood: HARDSCAPE.driftwood,
      },
    },
    {
      id: 'kelp-forest',
      displayName: '다시마 숲',
      // 미니멀보다 약간 어둡게 — 초록-갈색 분위기 예고.
      sandColor: 0x7d6e58,
      // 카펫은 유지(다시마는 카펫 위에 서는 별도 요소).
      plants: PLANT.species,
      /**
       * 다시마 배치·색. 좌우 가장자리·뒤쪽 z 집중, 중앙(|x|<centerGap)은 폴오프로 트여
       * 물고기(FISH.bounds x±10) 시야를 확보한다. sandY(-1.8)+높이 2.2~3.0 → 팁 y≈0.4~1.2.
       * 수치는 비전 eval 루프에서 조정하는 출발점.
       */
      kelp: {
        count: 26,
        minHeight: 2.5,
        maxHeight: 3.3,
        minScale: 0.95,
        maxScale: 1.3,
        baseColor: [0.13, 0.23, 0.09] as [number, number, number], // 짙은 갈록
        tipColor: [0.38, 0.45, 0.17] as [number, number, number], // 올리브
        colorVariation: 0.06,
        area: { minX: -16.5, maxX: 16.5, minZ: -5.4, maxZ: -2.6 },
        // seed 708: 좌/우 클러스터 균형(14:12) + 중앙 침범이 정중앙을 비껴감(오프라인 배치 분석)
        seed: 708,
        centerGap: 5.5,
        centerProbability: 0.05,
        backBias: 1.6,
      },
      hardscape: {
        seed: 505,
        // 큰 바위 강조 초기값: 개수는 줄이고 스케일을 키워 존재감을 높인다
        // (노이즈 변위 지오메트리로의 업그레이드는 step 3 범위 — 여기선 배치/색만).
        rockCount: 8,
        pebbleCount: 10,
        driftwoodCount: HARDSCAPE.driftwoodCount,
        clusterCount: HARDSCAPE.clusterCount,
        clusterSpread: HARDSCAPE.clusterSpread,
        area: HARDSCAPE.area,
        rock: {
          minScale: 0.3,
          maxScale: 0.75,
          maxHeightAboveSand: 0.95,
          colors: [0x4a463f, 0x3d3a34, 0x565248, 0x2f2c27] as readonly number[],
        },
        pebble: HARDSCAPE.pebble,
        driftwood: HARDSCAPE.driftwood,
      },
    },
    {
      id: 'coral-reef',
      displayName: '산호초',
      // 밝은 산호모래(산호 시각 요소 자체는 step 4 범위 — 여기선 낮은 암반 준비만).
      sandColor: 0xe0cbb0,
      // 카펫 축소: 산호초는 바닥 수초보다 개방된 모래·암반이 특징. 기존 종 배열을 참조해
      // count만 낮춘다(색·영역·시드 등 나머지 값은 복붙하지 않고 그대로 참조).
      plants: [
        { ...PLANT.species[0], count: 60 },
        { ...PLANT.species[1], count: 65 },
        { ...PLANT.species[2], count: 35 },
        { ...PLANT.species[3], count: 25 },
        { ...PLANT.species[4], count: 20 },
      ],
      hardscape: {
        seed: 606,
        rockCount: 6,
        pebbleCount: 14,
        driftwoodCount: 0, // 산호초에 유목은 어울리지 않음(산호 클러스터가 이후 step 4에서 대체)
        clusterCount: HARDSCAPE.clusterCount,
        clusterSpread: 4.2,
        area: HARDSCAPE.area,
        rock: {
          minScale: 0.2,
          maxScale: 0.5,
          maxHeightAboveSand: 0.45, // 낮은 암반(다음 step에서 산호와 어우러질 준비)
          colors: [0xcfc4ab, 0xd8cdb4, 0xc2b79c, 0xe0d6c0] as readonly number[],
        },
        pebble: HARDSCAPE.pebble,
        driftwood: HARDSCAPE.driftwood,
      },
    },
  ],
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
  /** 알파 페이드 시작 깊이(이 앞은 완전 불투명=바닥). 화면상 바 하단부. */
  alphaDepthNear: 5.0,
  /**
   * 알파 페이드 포화 깊이. 모래 평면 먼 가장자리(뷰 깊이=16)에 맞춰 가장자리에서
   * 알파가 0에 도달 → 하드 컷(수평선) 대신 수중 헤이즈로 용해.
   * 변경 시 waterDepthHelpers.test.ts의 "먼 가장자리 알파 0" 가드 확인.
   */
  alphaDepthFar: 16.0,
  /**
   * 페이드 곡선 지수(ease-out, 1-(1-t)^p). >1이면 페이드를 **가까운 깊이쪽으로 전진**시켜
   * 먼 모래가 일찍부터 헤이즈로 옅어지게 한다. 원근 압축으로 먼 가장자리(깊이 10~16)가
   * 화면 17px에 몰리므로, smoothstep(끝에서 급강하)은 그 좁은 띠에 어두운 '가로선'을 만든다.
   * ease-out은 페이드를 깊이 6~11(화면 35px+)로 펼쳐 선이 아닌 부드러운 그라디언트로 만든다.
   */
  alphaFadePower: 2.2,
  /** alphaDepthFar에서의 페이드량. 1.0=완전 투명(가장자리 용해) */
  maxAlphaFade: 1.0,
  // 수중 분위기 베일(DOM 그라디언트)은 제거했다. 투명 오버레이 위에서 저알파 CSS 그라디언트가
  // 8비트로 양자화되며 균일한 가로 밴딩(여러 수평선)을 만들어, 밝기/투명도 변경 시 선이 움직였다.
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
  /** 화자 연결 꼬리(◆ 회전 사각형) 한 변 px. 누가 말했는지 클릭 지점을 가리킨다. */
  tailSize: 10,
} as const

/** 렌더 성능. 힐링 위젯이므로 표시 중에도 CPU/GPU를 아낀다. */
export const RENDER = {
  /**
   * 렌더 FPS 상한(0=무제한, 디스플레이 주사율). 30이면 표시 중 CPU가 대략 절반이 된다.
   * 물고기 유영은 저속이라 30fps로도 부드럽다(dt 보정이라 이동 속도는 불변).
   */
  maxFps: 30,
} as const

/** 전역 단축키. 트레이 아이콘이 노치/메뉴바 혼잡으로 안 보일 때의 복구 경로. */
export const SHORTCUTS = {
  /** 창 위치 초기화(화면 상단 전폭) + 표시. Electron accelerator 형식. */
  recovery: 'CommandOrControl+Alt+A',
} as const

export const LURE = {
  /**
   * armed 상태 무활동 자동 해제(ms). 모드를 켜 둔 채 잊으면 물고기 클릭 대사가 계속 억제되므로
   * (lure가 대사보다 우선) 한동안 클릭이 없으면 스스로 풀린다. 클릭할 때마다 타이머 리셋.
   */
  armedIdleTimeoutMs: 20_000,
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
  buttonBgHover: 'rgba(15, 23, 28, 0.76)',
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
