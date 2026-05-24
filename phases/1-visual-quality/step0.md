# Step 0: lit-pipeline

## 읽어야 할 파일

- `/docs/superpowers/specs/2026-05-24-aquagarden-visual-quality-design.md` (§3.1 렌더링 파이프라인 전환 — 이 step의 근거)
- `/docs/ADR.md` (ADR-002 알파 투명 clearAlpha 0, ADR-004 순수 분리)
- `/CLAUDE.md` (CRITICAL 규칙들 — hidden 시 렌더 정지, 매직넘버 금지→config 사용)
- `src/renderer/core/SceneRoot.ts` (Scene/Camera/Renderer 셋업 — 여기에 환경맵 추가)
- `src/renderer/lighting/Lighting.ts` (directional/ambient — 여기에 envIntensity 통합)
- `src/renderer/lighting/lightingHelpers.ts` + `src/renderer/lighting/__tests__/lightingHelpers.test.ts` (순수 매핑 함수 — 여기에 추가)
- `src/renderer/entities/Aquascape.ts` (현재 sand/rocks가 MeshBasicMaterial — lit로 전환해 파이프라인 작동을 증명)
- `src/shared/config.ts` (LIGHT 상수)

## 작업

조명이 실제로 작동하는 렌더링 기반을 만든다. 현재 모든 재질이 `MeshBasicMaterial`(언릿)이라 조명이 무의미하다. 이 step에서 **환경맵(IBL)** 을 도입하고, 밝기 슬라이더가 IBL 세기까지 구동하게 하며, 아쿠아스케이프의 모래/바위를 조명 받는 재질로 바꿔 파이프라인이 보이게 한다.

1. **`src/shared/config.ts` — LIGHT 확장**
   - `LIGHT`에 `minEnvIntensity`, `maxEnvIntensity` 추가 (예: 0.15 ~ 1.2). 매직넘버 금지 규칙 준수.

2. **`src/renderer/lighting/lightingHelpers.ts` — 순수 매핑 추가 (TDD 먼저)**
   - `brightnessToEnvIntensity(b01: number, min: number, max: number): number` 추가. 기존 `brightnessToIntensity`/`brightnessToAmbient`와 동일한 형태(클램프 + 선형/곡선 보간).
   - `__tests__/lightingHelpers.test.ts`에 테스트 먼저 작성: b01=0→min, b01=1→max, 중간값, 범위 밖 클램프.

3. **`src/renderer/core/SceneRoot.ts` — 환경맵(IBL) 주입**
   - 생성자에서 `PMREMGenerator`(`renderer` 기반) + `RoomEnvironment`(`three/examples/jsm/environments/RoomEnvironment.js`)로 환경 텍스처를 만들어 `this.scene.environment`에 할당.
     ```ts
     const pmrem = new THREE.PMREMGenerator(this.renderer)
     this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
     ```
   - CRITICAL: `this.scene.background`는 **null로 유지**한다(투명 창 보존). 환경맵은 조명/반사용이며 배경이 되면 안 된다.
   - PMREM 리소스는 dispose 경로에 정리(`pmrem.dispose()`)한다. 환경 텍스처 핸들을 보관해 `dispose()`에서 `.dispose()` 호출.
   - `scene.environmentIntensity`를 외부에서 조절할 수 있도록 getter/setter 또는 public 메서드 `setEnvironmentIntensity(v: number)`를 제공한다(three r184는 `scene.environmentIntensity` 지원).

4. **`src/renderer/lighting/Lighting.ts` — 밝기 슬라이더에 envIntensity 통합**
   - `Lighting`이 `SceneRoot`(또는 `scene`)를 알 수 있게 생성자 인자로 주입받거나, `setBrightness01` 호출부에서 함께 처리할 수 있도록 한다. 레이어 규칙상 Lighting은 renderer 내부이므로 scene 참조 주입은 허용.
   - `setBrightness01(b01)`이 directional·ambient에 더해 `scene.environmentIntensity = brightnessToEnvIntensity(b01, LIGHT.minEnvIntensity, LIGHT.maxEnvIntensity)`까지 설정하게 한다.
   - 결과: 슬라이더 최소 → 어둑한 심해 느낌(IBL도 약함), 최대 → 맑고 환함.

5. **`src/renderer/entities/Aquascape.ts` — sand/rocks를 lit 재질로 (파이프라인 증명)**
   - `SAND_COLOR` 모래 평면: `MeshBasicMaterial` → `MeshStandardMaterial`(roughness 높게, metalness 0) 또는 `MeshLambertMaterial`.
   - rocks/pebbles: `ROCK_COLOR` `MeshBasicMaterial` → `MeshStandardMaterial`/`MeshLambertMaterial`.
   - grass(ShaderMaterial)와 glass edge(LineBasicMaterial)는 **이 step에서 건드리지 않는다**(grass는 step 3에서 교체).
   - 주의: 이 변경으로 모래/바위에 비로소 음영이 생겨야 한다(수동 확인 포인트).

## Acceptance Criteria

```bash
npm run test
npm run build
npm run lint
```

## 검증 절차

1. 위 AC 3개 모두 종료코드 0 확인. 특히 `brightnessToEnvIntensity` 단위 테스트 통과.
2. `npm run dev`로 **수동 확인**: (a) 배경이 여전히 투명(바탕화면 비침), (b) 모래/바위에 음영이 생김, (c) 밝기 슬라이더를 끝에서 끝으로 움직이면 어둑↔환함이 IBL 포함해 변함.
3. 아키텍처 체크리스트:
   - `scene.background`가 null인가? (투명 보존 — CRITICAL)
   - 매직넘버 대신 `config.LIGHT` 상수를 썼는가?
   - 순수 매핑 함수가 three/DOM 없이 테스트되는가? (ADR-004)
   - 기존 테스트가 모두 통과하는가?
4. `phases/1-visual-quality/index.json`의 step 0 갱신:
   - 성공 → `status: "completed"` + `summary`에 "환경맵(PMREM+RoomEnvironment) IBL 도입, scene.environmentIntensity 노출, 밝기 슬라이더가 directional/ambient/env 동시 구동, Aquascape 모래·바위 lit 전환, brightnessToEnvIntensity 헬퍼+테스트" 한 줄 요약.
   - 3회 시도 실패 → `status: "error"` + `error_message`.
   - 사용자 개입 필요 → `status: "blocked"` + `blocked_reason` 후 중단.

## 금지사항

- `scene.background`를 설정하지 마라. 이유: 투명 창이 깨져 바탕화면 투과가 사라진다(ADR-002).
- `THREE.Fog`/`FogExp2`를 추가하지 마라. 이유: 투명 배경에서 불투명 안개 사각형을 만든다. 물 뎁스는 step 6에서 셰이더로 처리한다.
- 물고기/수초/유목/파티클/포스트프로세싱을 만들지 마라. 이유: 이 step은 조명 파이프라인 한정. 콘텐츠는 후속 step.
- grass ShaderMaterial을 교체하지 마라. 이유: step 3 담당.
- 기존 테스트를 깨뜨리지 마라.
