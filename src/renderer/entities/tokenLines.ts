/**
 * 물고기 클릭 → 토큰 사용량 대사 선택 (어종별 페르소나 × 3단계 밴드).
 *
 * `usageLineForSpecies`는 speciesId·band(ok/warn/critical)·수치 컨텍스트·idx로 대사 문자열
 * 하나를 결정적으로 고른다. 밴드 판정(usageLevel/bandForUsage)은 이 파일의 책임이 아니다 —
 * 이미 계산된 band를 인자로 받는다(shared/tokenHelpers의 로직을 재구현하지 않는다).
 *
 * bespoke 어종(speciesRegistry의 10종 전부)은 각자 dialogue 톤에 맞춘 목소리를 갖고,
 * 레지스트리에 없는(미래/미등록) id는 공용 fallback으로 처리해 어떤 id·band 조합도
 * 빈 문자열을 반환하지 않는다(커버리지 불변식 — SPECIES_LINES를 Record<SpeciesId,...>로
 * 선언해 TS 컴파일 타임에도 10종 전부 채워졌는지 가드한다).
 *
 * 대사는 '관건(focus) 창' 하나만 인용한다 — 어느 창이 톤을 정했는지는 호출자(fishTone)가
 * 판정해 ctx.label('5시간'|'주간')·ctx.pct·ctx.resetText로 넘긴다. 이 파일은 밴드/포커스를
 * 재계산하지 않는다.
 *
 * 톤 설계: ok는 여유로워 리셋 시각을 언급할 필요가 없고, warn/critical은 아껴야 하는 시점이라
 * 항상 ctx.resetText를 포함한다(수치는 모든 밴드가 최소 하나씩 포함). warn은 '페이스 주의'라
 * 낮은 %에서도 뜰 수 있어 "거의 다 찼다"고 단정하지 않는다. reset 문구는 창-무관(relative
 * "2시간 11분 후" / absolute "금 18시" 모두 자연스럽게) 하도록 "…까지"/"…에 초기화돼요" 형태만 쓴다.
 */

import type { UsageLevel } from '../../shared/tokenHelpers'
import type { SpeciesId } from './speciesRegistry'

/**
 * usageLineForSpecies에 주입하는 컨텍스트 — 톤을 정한 '관건 창' 하나를 담는다.
 * label: '5시간' | '주간'(대사가 인용할 창 이름), pct: 0..1, resetText: 창-무관 리셋 표기.
 */
export interface UsageLineContext {
  label: string
  pct: number
  resetText: string
}

type LineTemplate = (ctx: UsageLineContext) => string
type BandLines = Readonly<Record<UsageLevel, readonly LineTemplate[]>>

/** 관건 창의 0..1 사용률 → 반올림된 정수 퍼센트. */
function pct(ctx: UsageLineContext): number {
  return Math.round(ctx.pct * 100)
}

/* ── 어종별 bespoke 대사 (speciesRegistry의 dialogue 톤에 맞춤, 10종 전부) ── */

const SPECIES_LINES: Record<SpeciesId, BandLines> = {
  'tetra-a': {
    ok: [
      (ctx) => `무리도 여유로워요, ${ctx.label} ${pct(ctx)}%예요.`,
      (ctx) => `오늘은 물살도 잔잔하네요, ${ctx.label} ${pct(ctx)}%예요.`,
    ],
    warn: [
      (ctx) => `슬슬 속도를 줄일 시간이에요, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지 아껴요.`,
      (ctx) => `무리 전체가 아끼는 중이에요, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지만 헤엄쳐요.`,
    ],
    critical: [
      (ctx) => `무리가 멈춰야 할 것 같아요! ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}에 초기화돼요.`,
      (ctx) => `너무 멀리 왔나 봐요, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지 살살 헤엄쳐요.`,
    ],
  },
  'tetra-b': {
    ok: [
      (ctx) => `내 리듬대로 헤엄쳐도 돼요, ${ctx.label} ${pct(ctx)}%예요.`,
      (ctx) => `오늘 박자는 느긋하네요, ${ctx.label} ${pct(ctx)}%예요.`,
    ],
    warn: [
      (ctx) => `박자를 조금 늦춰볼까요, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지 아껴요.`,
      (ctx) => `무리보다 앞서 왔나 봐요, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지 쉬어가요.`,
    ],
    critical: [
      (ctx) => `헉, 리듬이 너무 빨랐어요! ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지 멈춰야겠어요.`,
      (ctx) => `속도를 완전히 늦춰야 해요, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}에 초기화돼요.`,
    ],
  },
  clownfish: {
    ok: [
      (ctx) => `말미잘처럼 아늑해요, ${ctx.label} ${pct(ctx)}%밖에 안 썼어요.`,
      (ctx) => `오늘 보금자리는 평온하네요, ${ctx.label} ${pct(ctx)}%예요.`,
    ],
    warn: [
      (ctx) => `슬슬 집을 아껴야 할 때예요, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지 아껴요.`,
      (ctx) => `조금만 조심히 지낼게요, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지요.`,
    ],
    critical: [
      (ctx) => `보금자리가 가득 찼어요! ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}에 초기화돼요.`,
      (ctx) => `오늘은 여기서 잠시 쉴게요, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지 조용히요.`,
    ],
  },
  butterflyfish: {
    ok: [
      (ctx) => `우아하게 여유로운 하루예요, ${ctx.label} ${pct(ctx)}%뿐이에요.`,
      (ctx) => `서두르지 않아도 충분해요, ${ctx.label} ${pct(ctx)}%예요.`,
    ],
    warn: [
      (ctx) => `조금 천천히 돌아갈까요, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지 아껴요.`,
      (ctx) => `우아함에도 아낌이 필요해요, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지만요.`,
    ],
    critical: [
      (ctx) => `무늬가 너무 빨리 바랬나 봐요! ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}에 초기화돼요.`,
      (ctx) => `오늘은 산호 뒤에 숨어 쉴게요, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지요.`,
    ],
  },
  lionfish: {
    ok: [
      (ctx) => `고요한 하루예요, ${ctx.label} ${pct(ctx)}%밖에 안 썼어요.`,
      (ctx) => `느긋하게 나아가는 중이에요, ${ctx.label} ${pct(ctx)}%예요.`,
    ],
    warn: [
      (ctx) => `가시를 세울 정도는 아니지만, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지 아껴야겠어요.`,
      (ctx) => `조심스레 나아갈 시간이에요, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지요.`,
    ],
    critical: [
      (ctx) => `이건 가시 세울 일이에요! ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}에 초기화돼요.`,
      (ctx) => `오늘은 조용히 숨어야겠어요, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지요.`,
    ],
  },
  shrimp: {
    ok: [
      (ctx) => `부지런히 잘 쓰고 있어요, ${ctx.label} ${pct(ctx)}%예요.`,
      (ctx) => `오늘도 여유롭게 청소 중이에요, ${ctx.label} ${pct(ctx)}%밖에 안 썼어요.`,
    ],
    warn: [
      (ctx) => `더듬이가 슬슬 신호를 보내요, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지 아껴요.`,
      (ctx) => `바닥까지 다 쓸기 전에 아껴요, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지요.`,
    ],
    critical: [
      (ctx) => `바닥까지 다 썼나 봐요! ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}에 초기화돼요.`,
      (ctx) => `오늘은 여기까지만 청소할게요, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지 쉴게요.`,
    ],
  },
  manta: {
    ok: [
      (ctx) => `날개를 넉넉히 펼쳐도 돼요, ${ctx.label} ${pct(ctx)}%예요.`,
      (ctx) => `오늘 바다는 넓고 여유롭네요, ${ctx.label} ${pct(ctx)}%밖에 안 썼어요.`,
    ],
    warn: [
      (ctx) => `날갯짓을 조금 줄여볼까요, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지 아껴요.`,
      (ctx) => `넓은 바다도 아낄 땐 아껴야죠, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지요.`,
    ],
    critical: [
      (ctx) => `날개를 접어야 할 때예요! ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}에 초기화돼요.`,
      (ctx) => `오늘은 고요히 떠 있을게요, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지 쉬어요.`,
    ],
  },
  whale: {
    ok: [
      (ctx) => `깊이 숨 쉴 여유가 있어요, ${ctx.label} ${pct(ctx)}%예요.`,
      (ctx) => `먼바다처럼 넉넉한 하루예요, ${ctx.label} ${pct(ctx)}%밖에 안 썼어요.`,
    ],
    warn: [
      (ctx) => `숨을 조금 아껴 쉴 때예요, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지 아껴요.`,
      (ctx) => `깊은 곳에서 잠시 아낄게요, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지요.`,
    ],
    critical: [
      (ctx) => `정말 깊이 잠수해야겠어요! ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}에 초기화돼요.`,
      (ctx) => `오늘은 고요히 가라앉아 쉴게요, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지요.`,
    ],
  },
  dolphin: {
    ok: [
      (ctx) => `오늘은 신나게 놀 여유가 있어요! ${ctx.label} ${pct(ctx)}%예요.`,
      (ctx) => `${ctx.label} ${pct(ctx)}%밖에 안 썼어요, 더 놀아도 돼요!`,
    ],
    warn: [
      (ctx) => `슬슬 아껴야 할 것 같아요, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지 아껴요!`,
      (ctx) => `점프는 살짝 줄여볼까요? ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지만요.`,
    ],
    critical: [
      (ctx) => `이제 진짜 멈춰야 해요! ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}에 초기화돼요.`,
      (ctx) => `오늘은 여기까지만 놀게요, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지 쉬어야겠어요.`,
    ],
  },
  shark: {
    ok: [
      (ctx) => `아직은 멈추지 않아도 돼요, ${ctx.label} ${pct(ctx)}%예요.`,
      (ctx) => `오늘은 여유롭게 나아가요, ${ctx.label} ${pct(ctx)}%밖에 안 썼어요.`,
    ],
    warn: [
      (ctx) => `속도를 조금 늦출 때가 왔어요, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지 아껴요.`,
      (ctx) => `강함에도 아낌이 필요해요, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지요.`,
    ],
    critical: [
      (ctx) => `멈춰야 할 신호예요! ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}에 초기화돼요.`,
      (ctx) => `오늘은 조용히 물러설게요, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지 쉴게요.`,
    ],
  },
}

/* ── 미등록 id 공용 fallback (목소리는 중립이지만 따뜻하게) ── */

const FALLBACK_LINES: BandLines = {
  ok: [
    (ctx) => `아직 여유가 있어요, ${ctx.label} ${pct(ctx)}%예요.`,
    (ctx) => `오늘은 넉넉하게 쓰고 있어요, ${ctx.label} ${pct(ctx)}%밖에 안 썼어요.`,
  ],
  warn: [
    (ctx) => `슬슬 아껴 쓸 때예요, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지요.`,
    (ctx) => `조금만 신경 써주세요, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지 아껴 써요.`,
  ],
  critical: [
    (ctx) => `한도에 거의 다 왔어요! ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}에 초기화돼요.`,
    (ctx) => `잠시 쉬어가야 할 것 같아요, ${ctx.label} ${pct(ctx)}%, ${ctx.resetText}까지요.`,
  ],
}

/** idx를 0..len-1로 감싼다(음수 idx도 안전하게 랩). Math.random 사용 금지 — 순수·결정적. */
function wrapIndex(len: number, idx: number): number {
  return ((idx % len) + len) % len
}

/**
 * speciesId·band·수치 컨텍스트·idx로 대사 한 줄을 결정적으로 고른다.
 * speciesId가 SPECIES_LINES에 없으면(미등록/미래 종) FALLBACK_LINES를 쓴다 — 항상 비어있지
 * 않은 문자열을 반환한다(커버리지 불변식).
 */
export function usageLineForSpecies(
  speciesId: string,
  band: UsageLevel,
  ctx: UsageLineContext,
  idx: number,
): string {
  const lines = SPECIES_LINES[speciesId as SpeciesId] ?? FALLBACK_LINES
  const templates = lines[band]
  const template = templates[wrapIndex(templates.length, idx)]
  return template(ctx)
}
