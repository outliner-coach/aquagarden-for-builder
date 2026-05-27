# 추가 가능 어종 GLB 모델 리서치 (2026-05-27)

기능 후보 #1(어종 추가)을 위한 에셋 조사. 코드는 `speciesRegistry.ts` 레지스트리로 거의 공짜이므로
**병목은 에셋 소싱**이다. 이 문서는 후보 모델과 통합 시 반드시 확인할 제약을 정리한다.

## 현재 5종의 출처 (재확인)

`src/renderer/assets/fish/CREDITS.md` 기준 — 모두 **Quaternius, CC0 1.0, poly.pizza에서 GLB 다운로드**.

| 파일 | 모델 | kind | poly.pizza URL |
|------|------|------|----------------|
| clownfish.glb | 흰동가리 | individual | https://poly.pizza/m/769fHo3eEB |
| butterflyfish.glb | 나비고기 | individual | https://poly.pizza/m/s2MkBeSzGy |
| lionfish.glb | 쏠배감펭 | individual | https://poly.pizza/m/czsz9Baw86 |
| tetra-a.glb | Fish 변형 A | schooling | https://poly.pizza/m/BEcU9rjiAq |
| tetra-b.glb | Fish 변형 B | schooling | https://poly.pizza/m/XWl86YFtpF |

> ⚠️ CREDITS.md에 "리그를 사용하지 않고 정적 메시+셰이더 벤딩"이라 적혀 있으나 이는 **stale**.
> CLAUDE.md 현재 상태대로 프로젝트는 **스켈레탈 애니메이션(AnimationMixer로 GLB 본 클립 재생)**을
> 쓴다(`fishAssets.pickSwimClip` → `Fish`가 `SkeletonUtils.clone`). CREDITS.md 갱신 권장.

## 새 어종에 요구되는 조건 (체크리스트)

신규 GLB는 다음을 만족해야 기존 파이프라인에 그대로 들어간다:

1. **라이선스 CC0**(또는 재배포·상용 가능한 허용 라이선스). 현재 전부 CC0 1.0.
2. **포맷 GLB** (Vite `?url` import). poly.pizza는 GLB 직배포(로그인 불필요).
3. **스켈레탈 swim 클립 포함** — `pickSwimClip`이 `Swimming_Normal`/`Swim`/첫 클립 순으로 선택.
   클립 없으면 정지 자세로 떠다님(군집·개체 모두 헤엄 모션 상실).
4. **머리 +X 규약** — `Fish.update`의 `headingYaw`가 +X를 속도 방향에 맞춘다. GLB 노드 변환을
   무시하면 누운/뒤집힌 자세(CLAUDE.md GLB 함정). 도입 시 자세 육안 확인 + `npm run smoke` 필수.
5. **MeshStandardMaterial** — `prepareMaterials`가 커스틱+물깊이+림을 onBeforeCompile로 주입.
   다른 머티리얼 타입이면 효과 미적용(치명적이진 않음).
6. **적정 폴리수** — 로우폴리 권장(상주 위젯, 풀링 다수 인스턴스).

## 1순위 후보: 같은 Quaternius "Animated Fish Bundle"

poly.pizza 번들 `Animated-Fish-Bundle-ZkGbjS8m8g` — **7모델, 전부 CC0 + swim 애니메이션 + GLB**.
현재 미사용 모델:

- **Dolphin (돌고래)** — individual. 큰 개체. 위젯 바 스케일에 맞춰 `baseScale` 작게.
- **Shark (상어)** — individual. 포인트 개체로 1마리. 힐링 톤과 어울리는지 검토(위협적일 수 있음).
- **Whale (고래)** — individual. 매우 큼 → 천천히 가로지르는 "이벤트성" 개체로 쓰면 무드 좋음.
- **Manta ray (만타가오리)** — individual. 우아한 유영, 힐링 톤에 매우 적합. **강력 추천.**
- Fish 변형(3종 중 일부는 이미 tetra로 사용) — 남은 변형이 있으면 군집용 추가 가능.

> 다운로드: 번들 페이지에서 각 모델 클릭 → GLB Download. (개별 `/m/` 슬러그는 JS 렌더링이라
> 본 리서치에서 자동 추출 실패 — 번들 페이지에서 클릭 한 번이면 됨.)
> 번들: https://poly.pizza/bundle/Animated-Fish-Bundle-ZkGbjS8m8g

**추천:** Manta ray + Whale를 "이벤트성 대형 개체", Dolphin을 개체 추가. 상어는 컨셉 검토 후.

## 2순위 후보: Quaternius "Animated Cute Fish Pack"

- `https://quaternius.com/packs/cutefish.html` — **50+ 애니메이션 cute fish + 낚싯대/루어 등, CC0.**
- ⚠️ quaternius.com 직배포는 **FBX/OBJ/Blend만** → **GLB 변환 필요**(Blender 임포트 →
  glTF 익스포트, 애니메이션 포함 체크). 변환 시 본/클립 유지·머리축 정렬 검증 필수.
- 종류가 매우 많아 schooling/individual 다양화에 좋음. 변환 한 단계만 감수하면 로스터 대폭 확장.

## 3순위: 기타 CC0 소스 (변환·검증 부담)

- **poly.pizza 검색**(`/search/fish`, `/u/Quaternius`) — Quaternius 외 CC0 모델 다수.
  단, **swim 애니메이션 포함 여부를 모델별로 확인**해야 함(정지 모델 많음).
- **OpenGameArt "Animated Fish"** — 라이선스 모델별 상이(CC0/CC-BY 혼재), 포맷·리그 품질 편차 큼.

## 권장 도입안 (1차 범위)

스타일 일관성(같은 Quaternius 로우폴리 톤) + 즉시 GLB + 검증 부담 최소 →
**Animated Fish Bundle의 Manta ray, Whale, Dolphin 우선 도입**:

1. 위 3종 GLB를 `src/renderer/assets/fish/`에 추가, `CREDITS.md` 갱신(+stale 문구 수정).
2. `speciesRegistry.ts`에 항목 추가(`kind: 'individual'`, 대형은 `baseScale` 보수적, `swimSpeed` 느리게,
   `displayName`, `dialogue` 10개). 대형 개체는 개체수 슬라이더에서 소수만 등장하도록 정책 검토.
3. 머리 +X 자세·스케일 육안 확인 + `fishHelpers.headingYaw` 유닛테스트 + `npm run smoke`.
4. (선택) cute fish 팩에서 군집용 소형종 1~2개 GLB 변환 도입으로 schooling 다양화.

## 미해결/후속

- 개별 모델의 정확한 poly.pizza `/m/` URL은 번들 페이지 수동 확인 필요(자동 추출 실패).
- 대형 개체(고래 등)와 풀링·boids 군집 정책의 정합(개체수 슬라이더에서 대형은 캡) 설계 필요.
- cute fish 팩 GLB 변환 파이프라인(애니메이션 보존) 1회 검증 필요.

---

### 출처
- Quaternius Animated Fish Pack: https://quaternius.com/packs/animatedfish.html (CC0, 7종, swim 애니)
- Animated Fish Bundle (poly.pizza, GLB 직배포): https://poly.pizza/bundle/Animated-Fish-Bundle-ZkGbjS8m8g
- Quaternius Animated Cute Fish Pack: https://quaternius.com/packs/cutefish.html (CC0, 50+, FBX/OBJ/Blend)
- Quaternius poly.pizza 전체: https://poly.pizza/u/Quaternius
- LowPoly Animated Fish (itch.io): https://quaternius.itch.io/lowpoly-animated-fish
