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

/**
 * 물고기 지형 회피. 테마 지형(마운드/기복)은 이제 FISH.bounds.minY 위로 융기할 수 있고,
 * 물고기는 위치별 로컬 바닥(지형 표면 + clearance)을 기준으로 ①전방 예측 상승 조향 +
 * 경사 수평 우회(소프트, terrainHelpers), ②통합 후 y 하드 클램프(관통 원천 차단)로 피해
 * 다닌다(Fish.update). 새우(crawler)는 clearance 없이 표면을 타고 기어다닌다.
 * authoring 가드: sandY + terrain.maxHeight + clearance ≤ bounds.maxY − minHeadroom
 * (terrainHelpers.test config 무결성 — 물고기가 끼이는 협곡 방지).
 */
export const TERRAIN_AVOID = {
  /** 지형 표면 위 최소 여유고(로컬 바닥 = 표면 + 이 값). 물고기 몸통 반높이 스케일. */
  clearance: 0.22,
  /** 로컬 바닥 위 이 여유 안으로 들어오면 상승 조향 시작(소프트 회피 대역). */
  approachMargin: 0.55,
  /** 전방 예측 시간(초) — 진행 방향의 경사를 미리 읽고 완만하게 선제 상승. */
  lookAheadSec: 0.6,
  /** 전방 예측 거리 상한(월드 유닛) — 놀래키기 가속 시 과예측 요동 방지. */
  lookAheadMaxDist: 1.8,
  /** 상승 조향 강도(Fish 경계회피 BOUNDARY_TURN_FORCE와 동급 스케일). */
  climbForce: 2.5,
  /** 상승력 상한 배율(바닥 아래로 파고든 예외 상황의 폭주 방지: 최대 climbForce×이 값). */
  climbForceCap: 2.0,
  /** 경사 수평 우회 강도 — 마운드를 타넘는 대신 옆으로 돌아가는 성분(wander 0.5와 동급). */
  deflectStrength: 1.4,
  /** 경사(기울기) 중심차분 샘플 간격(월드 유닛). */
  gradientEps: 0.4,
  /** 수면 쪽 최소 유영 여유: sandY+maxHeight+clearance ≤ maxY−이 값 (authoring 가드). */
  minHeadroom: 0.8,
  /** 런타임 관통 감시 허용 오차(health.terrainClips 판정, smoke가 0 검증). */
  clipEpsilon: 0.02,
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
  /**
   * 검사용 궤도 카메라(__AQUA_SET_CAMERA__/AQUA_SMOKE_CAM)의 기준. 프로덕트 카메라는
   * 정면 고정이며, target(z−3)+defaultDist(8)는 yaw0·pitch0에서 기존 위치 (0,0,5)와
   * 정확히 일치하도록 정한 값(cameraHelpers.test 하위호환 앵커).
   */
  orbit: {
    target: { x: 0, y: 0, z: -3 },
    defaultDist: 8,
    /**
     * 프로덕트 캔버스 드래그 궤도(카메라 회전). 각도는 무대 세트가 성립하는 범위로 클램프한다
     * (2026-07-18 각도 스윕: yaw ±25°·pitch 30° 밖은 모래 슬랩 경계·근접 왜곡 노출 — EVAL.md).
     * 드래그 중 각도는 즉응, 더블클릭 복귀는 returnRate 지수 수렴(무드 전환과 같은 패턴).
     */
    drag: {
      /** 수평 감도(도/px). 부호는 OrbitControls 관례 — 오른쪽 드래그 = 씬이 오른쪽으로 도는 느낌. */
      yawPerPx: 0.12,
      /** 수직 감도(도/px). 아래로 끌면 위에서 내려보는 각. */
      pitchPerPx: 0.15,
      minYaw: -25,
      maxYaw: 25,
      minPitch: -5,
      maxPitch: 30,
      /** 더블클릭 정면 복귀의 지수 수렴 속도(1/s). */
      returnRate: 6,
    },
  },
} as const

export const ZOOM = {
  min: 1.0, // 기본(축소 없음)
  max: 2.0, // 최대 2배 확대
  default: 1.0,
  wheelStep: 0.1, // 휠 한 칸당 줌 증감
} as const

export const AQUASCAPE = {
  sandY: -1.8,
  /**
   * 모래 평면 메시의 월드 z 오프셋. 평면 로컬 z(PlaneGeometry.getZ)를 월드 z로 변환할 때 쓴다
   * (worldZ = localZ + sandZ). terrainHelpers.sandHeightAt는 월드 좌표를 받으므로, 산호 클러스터·
   * 하드스케이프(월드 좌표 배치)와 지형 높이가 한 좌표계로 맞물리게 한다.
   */
  sandZ: -4,
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
  /**
   * 원근 레이어(spec §2): 뒤쪽 z일수록 이 밝은 청록(물빛)으로 색을 lerp해 "먼 열은 흐릿한
   * 헤이즈로 가라앉음"을 만든다. 알파/블렌딩은 건드리지 않고 색만 lerp한다 — 무정렬 투명 겹침
   * 아티팩트(CLAUDE.md 투명 오버레이 함정)를 피하기 위함(spec 금지사항: 색 lerp/디더로).
   */
  depthFadeColor: [0.42, 0.72, 0.72] as [number, number, number],
  /** 가장 뒤(depth01=1)에서의 최대 lerp 비율(0=원근 없음). 앞 열(depth01=0)은 선명·진함.
   *  0.68: 근경(황금-올리브) 우세는 유지하되 원경 열은 청록 헤이즈로 뚜렷이 가라앉혀 깊이감↑. */
  depthFadeStrength: 0.68,
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
    /**
     * 줄기 옆 leaflet(작은 잎) 돌기(spec §3) — "맨 리본"을 "잎 달린 줄기"로. 좌우 가장자리 반폭에
     * 정류(rectified) 사인 로브를 가산해 잎이 교대로 뾰족하게 돌출한다(edgeWave의 매끈한 물결과
     * 달리 사이가 벌어진 이산 잎). 좌우 위상을 어긋내(π) 잎이 지그재그로 달린다.
     */
    leaflet: {
      /** 한 변(좌/우)당 잎 돌기 반복 수. */
      count: 9,
      /** 돌기 최대 진폭(반폭 대비 비율, 반폭에 가산). */
      amp: 0.55,
      /** 돌기 시작 t(뿌리 근처는 매끈한 줄기로 남김). */
      startT: 0.12,
      /** 로브 첨예도 지수(클수록 뾰족한 잎 + 사이 간격 넓음). */
      sharpness: 1.5,
    },
  },
} as const

/**
 * 산호(coral) — 산호초 테마 전용 절차 요소 3종. 여기는 종 공통의 형태·색·움직임 파라미터만 두고,
 * 배치(seed/count/area)는 테마별로 THEME.coral-reef.coral에 둔다(KELP↔THEME.kelp와 동일한 분리).
 * 무드 틴트와 곱연산되므로(가지·뇌=광원 무드, 부채=uMoodColor) 심야 캡처로 탁함을 확인한다.
 */
export const CORAL = {
  /**
   * 팔레트(레퍼런스 Palmyra): 분홍/마젠타 다수 + 크림·골드 + 라벤더 소수. paletteWeights(CORAL.reef)로
   * 분홍/마젠타에 큰 가중을 줘 뭉게 마운드 주역이 분홍계가 되게 한다. 인덱스 순서:
   * 0 핫핑크 · 1 마젠타-로즈 · 2 소프트핑크 · 3 크림골드(가지 산호의 황금-크림) · 4 라벤더.
   * (generateCoralClusters의 라운드로빈 3색 보장 테스트는 앞 3색이 분홍계라 그대로 통과.)
   */
  palette: [0xff5f8f, 0xe0559a, 0xff88ac, 0xf3ceb0, 0xc9a8e0] as readonly number[],
  /**
   * 자기 색 emissive 배율(가지·뇌·마운드 MeshStandard). 산호는 뷰 깊이 7~9에서 물 틴트/깊이 페이드에
   * 채도가 죽는다 — 은은한 자발광으로 "생기"를 보존한다(과하면 야광 — 캡처 루프로 조정).
   */
  emissiveIntensity: 0.3,
  /**
   * 뭉게 마운드 산호(cauliflower nub) — step2 리프 피복의 주역. 반구 여러 개를 클램프(y≥0) 병합해
   * 울퉁불퉁한 뭉게 실루엣을 만들고, 뇌 산호보다 굵고 깊은 nub 변위(displaceRockPositions 고빈도)로
   * 오돌토돌한 폴립 표면을 낸다. 콜로니는 타입·팔레트별로 mergeGeometries 병합(드로우콜 절약).
   */
  mound: {
    /** 메인 반구 반경(월드 유닛, cluster.scale과 곱). 0.5→0.54: 뭉게 주역 존재감·피복감 강화. */
    radius: 0.54,
    /** 경위도 세그먼트(고빈도 nub 변위를 받을 표면 밀도 — 로우폴리 유지 위해 과하지 않게). */
    widthSegments: 18,
    heightSegments: 11,
    /** 뭉게 실루엣: 메인 반구 + 서브돔 수(작은 반구를 얹어 cauliflower 덩어리감). */
    domeCount: 3,
    /** 서브돔이 중심에서 흩어지는 최대 수평 거리(반경 대비). */
    domeSpread: 0.5,
    /** 서브돔 반경 배율 범위(메인 대비). */
    domeScaleMin: 0.5,
    domeScaleMax: 0.78,
    /** 서브돔을 얹는 높이(반경 대비) — 위로 쌓여 울퉁불퉁한 상단 실루엣. */
    domeLift: 0.3,
    /** nub 변위 강도(반경 방향, 뇌 산호 0.06보다 굵고 깊게). 굵은 폴립 오돌토돌. */
    nubStrength: 0.13,
    roughness: 0.78,
    /** 밑동을 지형 표면에 묻는 깊이(월드 유닛) — nub 요철로 가장자리가 떠 보이는 것 방지. */
    sinkDepth: 0.06,
  },
  /** 가지 산호(재귀 분기 튜브) — coralHelpers.generateBranchCoral 입력 + 렌더 파라미터. */
  branch: {
    /**
     * step2 전용색(골드-탄 staghorn). 팔레트(분홍/마젠타/크림/라벤더)와 달리 가지는 레퍼런스처럼
     * 골드-탄 사슴뿔 톤으로 통일한다 — 크림팔레트를 쓰면 물속에서 창백한 흰 나뭇가지로 뜬다(캡처 확인).
     */
    color: 0xcaa46a,
    /** 실린더 방사 세그먼트(명세: 5). 클러스터당 병합 지오메트리 = 드로우콜 1. */
    radialSegments: 5,
    depth: 3,
    // step2 미학 조율: 초광각 바에서 앙상한 흰 나뭇가지로 튀던 것을 완화 — 분기를 더 촘촘히([3,4]),
    // 옆으로 더 벌리고(spreadAngle↑ = 사슴뿔), 두께 유지(radiusDecay↑), 크기 축소(scale↓)로 낮은 덤불화.
    childCount: [3, 4] as [number, number],
    /** 부모 방향에서 벌어지는 최대 극각(라디안). 0.72→0.85로 옆 퍼짐↑(세로 나무 인상 완화). */
    spreadAngle: 0.85,
    lengthDecay: 0.72,
    // 0.74→0.78: 레벨별 두께 감쇠를 더 완화해 팁까지 toothpick처럼 얇아지지 않게(뼈대 인상 완화).
    radiusDecay: 0.78,
    /** 단위공간(트렁크 길이 1) → 월드 배율. cluster.scale과 곱해 최종 크기 결정. 0.9→0.62(세로 나무 인상 완화). */
    scale: 0.62,
    roughness: 0.82,
    /** 밑동을 모래에 묻는 깊이(월드 유닛) — 뿌리가 떠 보이는 것 방지. */
    sinkDepth: 0.05,
    /** 군집감: 메인 트리 옆의 사이드 트리(같은 병합 지오메트리 = 드로우콜 1 유지). */
    sideScale: 0.62,
    /** 사이드 트리 밑동 오프셋(단위공간 — worldScale 곱 전). */
    sideOffsetX: 0.52,
    sideOffsetZ: 0.2,
  },
  /** 뇌 산호(노이즈 변위 반구) — smooth 셰이딩으로 둥글게. */
  brain: {
    /** 반구 반경(월드 유닛, cluster.scale과 곱). */
    radius: 0.55,
    widthSegments: 20,
    heightSegments: 12,
    /** step3 변위 헬퍼(rockHelpers) 재사용 — 작은 strength·(세그먼트 밀도로) 고빈도 요철. */
    displaceStrength: 0.06,
    roughness: 0.85,
    /** 반구 밑면을 모래에 묻는 깊이(월드 유닛) — 변위 요철로 가장자리가 떠 보이는 것 방지. */
    sinkDepth: 0.04,
    /** 군집감: 메인 돔 옆의 사이드 돔(병합 = 드로우콜 1). 반경 배율·중심 거리(메인 반경 배). */
    sideScale: 0.58,
    sideOffsetFactor: 1.25,
    /** 미로(groove) 무늬 캔버스 텍스처 — 민무늬 돔은 "뇌 산호"로 안 읽힌다(캡처 루프 확인). */
    groove: {
      texSize: 128,
      /** 줄무늬 주파수(텍스처 전체의 능선 수 스케일). */
      scale: 11,
      /** 줄무늬를 굽이치게 하는 워프 강도. */
      warp: 2.4,
      /** 골의 어둡기(0~1) — 능선 밝기 대비 골이 이만큼 어둡다. material.color와 곱연산. */
      depth: 0.5,
      /** 무늬 uv 반복(가로, 세로). */
      repeatX: 2,
      repeatY: 1,
    },
  },
  /** 부채 산호(alpha-discard 카드 + 잎맥 컷 텍스처) — 그래스 카드 셰이더 재사용, 스웨이 미세. */
  fan: {
    /** 클러스터당 부채꼴 카드 수. */
    perCluster: 4,
    /** 부채 카드 높이·반폭(월드 유닛, cluster.scale과 곱). */
    height: 0.95,
    cardHalfWidth: 0.6,
    /** 카드가 클러스터 중심에서 흩어지는 반경. */
    spreadRadius: 0.42,
    // step6: yawJitter 1.2→0.55 — 카드 4장이 사방으로 흩뿌려져 방사형 성게 실루엣이 되던 것을,
    // 한 방향으로 겹쳐 보이는 하나의 부채 실루엣에 가깝게(카드별 변주는 남겨 완전 평면은 아님).
    /** 카드별 yaw 지터(라디안) — 클러스터 yaw 주변에서 부채 방향 변주. */
    yawJitter: 0.55,
    /** 카드별 크기 변주 범위(클러스터 scale에 추가 곱). */
    cardScaleMin: 0.8,
    cardScaleMax: 1.2,
    /** 팔레트 색 대비 밑동/팁 명도 배율(base→tip 그라디언트 — 그래스 셰이더 규약). */
    baseShade: 0.8,
    tipShade: 1.25,
    /** 스웨이(그래스 셰이더 재사용) — 산호는 수초보다 뻣뻣하므로 아주 작게. */
    swaySpeed: 0.9,
    swayAmplitude: 0.022,
    swaySpeed2: 0.5,
    swayAmplitude2: 0.01,
    alphaTest: 0.5,
    /** 부채 알파 텍스처(캔버스) 해상도. */
    texWidth: 256,
    texHeight: 256,
    // step6 미학 조율: 성게(urchin) 인상 완화 — 갈래를 더 넓고 적게, 부채꼴 각을 좁혀
    // "가늘게 방사하는 가시" 대신 "성긴 부채잎"으로 읽히게 했다(캡처 비교로 확정).
    /** 부채꼴 반각(라디안) — 좌우로 펼쳐지는 각(전체 각 = 2×). 1.35→1.05로 축소. */
    fanHalfAngle: 1.05,
    /** 방사 갈래(잎맥) 개수. 11→8로 축소(갈래당 폭 확보). */
    veinCount: 8,
    /** 갈래 사이 투명 컷 비율(0~1, 클수록 성긴 그물). 0.5→0.36로 축소(갈래를 더 두껍게). */
    veinGapRatio: 0.36,
    // 0.1→0.18: 밑동 솔리드 영역을 넓혀 "한 점에서 가시가 방사"하는 성게 인상을 완화.
    /** 갈래가 갈라지기 시작하는 밑동 반경(텍스처 높이 대비 비율) — 밑동은 이어 붙는다. */
    baseSolidRatio: 0.18,
  },
  /**
   * 리프 피복 배분 비율(generateReefColonies). 배치(seed/mounds/scatter)는 THEME.coral-reef.coral,
   * 여기는 "무엇을 얼마나" — 타입/크기/색 비율. 소표본에서도 정확 배분(allocateCounts)이라 캡처마다
   * 같은 균형(뭉게 주역·크기 다양·분홍 다수)이 나온다.
   */
  reef: {
    /**
     * 타입 배분 [mound, branch, brain, fan]. step2 조율: 부채(fan)는 평면 카드라 카메라와 평행하면
     * 얇은 빨간 세로선 아티팩트로 뜨고, 레퍼런스(Palmyra)에도 부채산호가 거의 없어 0으로 뺐다.
     * 뭉게 마운드가 60%대 주역, 가지·뇌가 조연(레퍼런스 인상).
     */
    typeWeights: [5.5, 1.5, 1.5, 0] as readonly [number, number, number, number],
    /** 크기 배분 [large, medium, small] — 대20/중40/소40(겹치듯 인접한 크기 다양성). */
    sizeWeights: [2, 4, 4] as readonly [number, number, number],
    /** 크기 버킷별 cluster.scale 범위(비겹침 — 대형 몇 개 + 중소형 다수). step2: 존재감·피복감 위해 확대. */
    sizeScales: {
      large: [1.35, 1.75] as readonly [number, number],
      medium: [0.95, 1.25] as readonly [number, number],
      small: [0.62, 0.9] as readonly [number, number],
    },
    /** 팔레트 인덱스별 가중치(CORAL.palette 순서). 분홍/마젠타(0~2) 다수 + 크림-피치(3) + 라벤더(4) 소수.
     *  step2 조율: 크림이 흰색으로 뜨는 것을 억제하려 크림(3)을 낮추고 핫핑크/마젠타(0·1)를 올렸다. */
    paletteWeights: [3.4, 2.8, 2.4, 1.6, 0.8] as readonly number[],
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
        // spec §1: 낱장 26개 → 포기(홀드패스트) 18개 × 4~6가닥 = 총 ~90가닥(다발 밀도·부피감↑).
        clusterCount: 18,
        bladesPerCluster: [4, 6] as [number, number],
        // 가닥이 홀드패스트 중심에서 흩어지는 반경(월드 유닛). 작을수록 촘촘한 다발.
        clusterRadius: 0.3,
        // spec §2 세로 충전: 얇은 바 상단까지 채우도록 키를 크게(3.0~5.0). 팁 y≈1.2~3.2로 프레임 위쪽을 메운다.
        minHeight: 3.0,
        maxHeight: 5.0,
        minScale: 0.95,
        maxScale: 1.35,
        // spec §4: 황금-올리브/앰버 톤(짙은 갈록 대신 노란기). base=짙은 앰버-올리브 밑동, tip=황금-올리브.
        baseColor: [0.22, 0.2, 0.07] as [number, number, number],
        tipColor: [0.55, 0.48, 0.16] as [number, number, number],
        colorVariation: 0.07,
        // spec §2: area 좌우 폭(±20)으로 18개 다발을 촘촘히 — 초광각 바(aspect≈8.7)의 좌우 충전.
        // seed 707: 좌/우 43:43 균형 + 중앙 통로(|x|<centerGap)에 가닥 0(오프라인 배치 분석) →
        // 물고기 시야가 완전히 트이고 좌우가 대칭으로 채워진다.
        area: { minX: -20, maxX: 20, minZ: -5.4, maxZ: -2.6 },
        seed: 707,
        // centerGap 5.5→6.5: 물고기 시야(중앙 통로)를 더 넓게 확보 — 다발은 좌우로 밀린다.
        centerGap: 6.5,
        centerProbability: 0.05,
        // backBias 1.6→1.3: 앞 열(황금-올리브)이 더 많아지고 앞/뒤가 고루 섞여 원근이 읽히되
        // 톤은 황금 우세(레퍼런스 인상). 뒤 열은 헤이즈로 가라앉음.
        backBias: 1.3,
      },
      hardscape: {
        seed: 505,
        // 큰 바위 8~10개(phase9 step0: 다시마는 바위에 붙어 자람 — 암반 무더기 밀도↑).
        // 크기 분산 확대(minScale↓·maxScale↑)로 큰 바위/작은 바위가 섞인 무더기 실루엣.
        rockCount: 9,
        pebbleCount: 14,
        driftwoodCount: HARDSCAPE.driftwoodCount,
        clusterCount: 4,
        clusterSpread: 4.5,
        // 뒤쪽·군락 예정지(가장자리·후방) 주변에 바위가 모이도록 z를 뒤로, x를 넓게.
        area: { minX: -14, maxX: 16, minZ: -5.4, maxZ: -2.8 },
        rock: {
          // 크기 분산 확대(0.28~0.9): 기존(0.3~0.75)보다 큰 바위/작은 바위 편차↑. maxScale를
          // 과도(1.05)로 올리면 깊이 페이드로 유리질처럼 창백해져(waterDepth) 0.9로 절제.
          minScale: 0.28,
          maxScale: 0.9,
          maxHeightAboveSand: 0.95,
          colors: [0x4a463f, 0x3d3a34, 0x565248, 0x2f2c27] as readonly number[],
          // 노이즈 변위 로우폴리(step3) — 어두운 회갈 큰 바위의 자연스러운 울퉁불퉁 실루엣.
          rockStyle: 'displaced',
          displaceSeed: 811,
          displaceStrength: 0.28,
        },
        pebble: HARDSCAPE.pebble,
        driftwood: HARDSCAPE.driftwood,
      },
      /**
       * 지형(phase9 step0): 다시마 숲 = 어둡고 울퉁불퉁한 암반 바닥. feature 마운드 없이
       * 저주파 기복(rollAmplitude·rollScale)만 — "바위 무더기"는 위 hardscape 큰 바위가 담당.
       * frontFlatZ 앞은 평탄(전면 모래 평면 보존), |x|>edgeTaperStart는 0으로 페이드(가장자리 보존).
       * 기복 진폭 상향(0.26→0.38, 물고기 지형 회피 도입으로 클리핑 상한 해제): 암반 바닥의
       * 융기·꺼짐이 물고기 하단 유영 대역까지 올라와 바닥이 "지형"으로 읽힌다.
       */
      terrain: {
        rollAmplitude: 0.38,
        rollScale: 0.46,
        mounds: [],
        edgeTaperStart: 13,
        edgeTaperEnd: 17,
        frontFlatZ: -1.5,
        frontTaperWidth: 2.0,
        maxHeight: 0.85,
        // 기복 정점을 어두운 암반색으로 살짝 변조해 지형이 읽히게(모래색보다 짙은 회갈).
        crestColor: 0x4a463f,
        crestColorStrength: 0.55,
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
        // 암반 슬랩을 리프 마운드 대역(아래 terrain.mounds 주변)에 집중 배치(phase9 step0).
        // 슬랩은 렌더 시 지형 높이만큼 들어 올려 마운드 표면에 얹힌다(Aquascape._terrainLift).
        rockCount: 8,
        pebbleCount: 14,
        driftwoodCount: 0, // 산호초에 유목은 어울리지 않음(산호 클러스터가 이후 step 4에서 대체)
        clusterCount: HARDSCAPE.clusterCount,
        clusterSpread: 3.6,
        // 마운드(x≈−6·+7, z≈−3.5) 주변으로 좁혀 슬랩이 마운드 위/주변에 모이게 한다.
        area: { minX: -9.5, maxX: 11.5, minZ: -4.6, maxZ: -2.8 },
        rock: {
          minScale: 0.2,
          maxScale: 0.5,
          maxHeightAboveSand: 0.45, // 낮은 암반(산호가 어우러지는 밝은 석회색 슬랩)
          colors: [0xcfc4ab, 0xd8cdb4, 0xc2b79c, 0xe0d6c0] as readonly number[],
          // 노이즈 변위 로우폴리(step3) + flattenY로 세로를 눌러 "낮고 넓은 암반" 실루엣을 만든다.
          rockStyle: 'displaced',
          displaceSeed: 613,
          displaceStrength: 0.14,
          flattenY: 0.42,
        },
        pebble: HARDSCAPE.pebble,
        driftwood: HARDSCAPE.driftwood,
      },
      /**
       * 지형(phase9 step0): 산호초 = 모래에서 솟아오른 리프 마운드 2개가 주인공(다음 step에서
       * 산호가 그 표면을 뒤덮는다). 중앙 x∈[−2,+2]는 비워 물고기 스테이지를 유지하고, 마운드는
       * 좌중(−6)·우중(+7)에 둔다. z는 −3.4/−3.6(뷰 깊이 <9). 완만 기복(rollAmplitude)을 더해
       * 마운드 사이 모래가 채널처럼 읽히게 한다.
       * 마운드 높이 상향(0.51/0.44→1.5/1.2, phase9 미결 "융기감 약함·비전 hardscape 45" 해소):
       * 리프가 물고기 유영 대역(minY −1.2) 위로 실제 융기한다 — 물고기는 지형 회피(TERRAIN_AVOID,
       * Fish.update)로 표면을 타넘거나 옆으로 돌아가고, 관통은 하드 클램프로 원천 차단된다.
       * 높이 산정 근거: 카메라(y0,z5)에서 모래 평면 먼 가장자리(z−11)의 지평선각은 −6.4°.
       * 마운드 정점이 이 지평선을 뚜렷이 돌파해야 "융기"로 읽힌다 — 정점 y=−0.3(h1.5)이면
       * −2.05°로 지평선 위 ~4.4°(기본 바에서 ~34px). 1.15(−0.6, +2.3°≈18px)는 부족했다(실측).
       * 수면 여유 가드(maxY−minHeadroom−clearance) 안이며 지형 회피 통합 테스트는 유효고도
       * 1.6(Fish.terrain.test 스트레스 지형)까지 검증한다.
       */
      terrain: {
        rollAmplitude: 0.09,
        rollScale: 0.3,
        // radius 4.5/3.6→5.6/4.6: 낮은 바에서는 높이 못지않게 "폭"이 융기 인지를 좌우한다 —
        // 마운드 기슭이 좌우(x≈±11.6)까지 뻗어 빈 모래대를 줄이고 완만한 리프 뱅크로 읽히게.
        // 중앙 스테이지(x[−2,2])는 기슭 끝자락만 스치므로 유지(테스트 가드).
        mounds: [
          { x: -6, z: -3.4, radius: 5.6, height: 1.5 }, // 좌중 큰 마운드
          { x: 7, z: -3.6, radius: 4.6, height: 1.2 }, // 우중 작은 마운드
        ],
        edgeTaperStart: 13,
        edgeTaperEnd: 17,
        frontFlatZ: -1.5,
        frontTaperWidth: 2.0,
        maxHeight: 1.6,
        // 마운드 정점을 밝은 모래보다 확연히 어둡고 차가운 암반색으로 변조 — "리프 rock platform"이
        // 밝은 모래 채널과 대비되어 읽히게. (기존 0xcfc4ab는 모래색과 거의 같아 무변화였음.)
        // strength 0.65→0.8: 융기 상향과 함께 정면 비탈이 암반 밴드로 더 진하게 읽히도록.
        crestColor: 0x8f8478,
        crestColorStrength: 0.8,
      },
      /**
       * 산호 리프 피복 배치(step2 coral-density). 형태·색·비율은 config.CORAL(+CORAL.reef), 여기는
       * 배치(seed/mounds/scatter)만. mounds는 terrain.mounds(x−6/+7, z−3.4/−3.6)와 좌표를 맞추되
       * 산호 반경은 지형 마운드보다 살짝 작게(표면만 덮음) + colonyCount로 피복 밀도를 준다. 렌더가
       * sandHeightAt으로 y를 마운드 표면에 스냅한다. scatter는 마운드 밖 채널 가장자리 소수(중앙
       * 물고기 스테이지 |x|<2.2 회피). 총 콜로니 = 26+20+12 = 58(피복감·크기 다양성 목표 — 초광각
       * 바에서 30+ 콜로니가 읽히려면 넉넉히). scatter area를 좌우 끝(±13.5/15.5)까지 넓혀 빈 모래대를 줄인다.
       * minZ −4.0: 카메라(z=5) 기준 뷰 깊이를 9 이내로 유지 — 더 뒤는 물 깊이 페이드로 채도가 급감.
       */
      coral: {
        seed: 344,
        mounds: [
          { x: -6, z: -3.4, radius: 4.4, colonyCount: 26 }, // 좌중 큰 마운드(terrain r4.5)
          { x: 7, z: -3.6, radius: 3.7, colonyCount: 20 }, // 우중 작은 마운드(terrain r3.6)
        ],
        scatter: {
          count: 12,
          area: { minX: -13.5, maxX: 15.5, minZ: -4.0, maxZ: -2.4 },
          stageHalfWidth: 2.2,
        },
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

/**
 * 토큰 사용량 게이지. Anthropic 공식 OAuth 사용률 API(계정 전체 %·리셋 시각)를 정본으로
 * 읽어 상단 바에 밴드(ok/warn/critical)로 표시한다. 자격증명/토큰 값은 이 상수·타입 어디에도
 * 저장하지 않는다(읽기 전용, main 프로세스에서만 취급). 폴링/캐시/타임아웃·밴드 임계값은 tunable.
 */
export const TOKEN = {
  /** 공식 사용률 엔드포인트 (Claude Code의 /usage가 쓰는 OAuth API). */
  apiUrl: 'https://api.anthropic.com/api/oauth/usage',
  /** anthropic-beta 헤더 값 (OAuth 사용률 API 요구). */
  betaHeader: 'oauth-2025-04-20',
  /** 폴링 주기(ms) — 10분. */
  pollIntervalMs: 600_000,
  /** 캐시 TTL(ms) — 1분. 중복 조회 억제. */
  cacheTtlMs: 60_000,
  /** 요청 타임아웃(ms). */
  requestTimeoutMs: 8_000,
  /** 밴드 임계값: ok→warn (사용률 0..1). */
  warnPct: 0.8,
  /** 밴드 임계값: warn→critical (사용률 0..1). */
  criticalPct: 0.95,
  /** 429 백오프 상한(ms) — 60분(레퍼런스 3600s). */
  backoffMaxMs: 3_600_000,
  /** 429 백오프 지수 배율(레퍼런스 ×2). */
  backoffFactor: 2,
  /** 밴드별 게이지 색. */
  colors: { ok: '#3fd0c9', warn: '#fb8500', critical: '#e5484d' },
} as const
