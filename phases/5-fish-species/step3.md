# Step 3: control-panel-ui

## 읽어야 할 파일

- `/CLAUDE.md` (레이어 분리·매직넘버·자기보고 불신·렌더링 함정)
- `/docs/superpowers/specs/2026-05-27-fish-species-addition-design.md` (§"C. ControlPanel UI")
- `/docs/HANDOFF.md` (과거 **패널 잘림→종료 버튼 스크롤 밖** 버그 — `WINDOW.expandedHeight`/`panelExtra` 맥락)
- `src/renderer/ui/ControlPanel.ts` (주 수정 — `_createSlider`/`_createToggle`/`setInteractive`/`_buildHelpModal`/CSS)
- `src/renderer/main.ts` (ControlPanel 콜백·`fishSchool.init().then(...)` — step 2에서 확장한 블록)
- `src/renderer/entities/FishSchool.ts` (`availableFeatures()`/`setEnabledFeatures()`)
- `src/renderer/entities/speciesRegistry.ts` (`getSpecies(id).displayName`, `SpeciesId`)
- `src/shared/config.ts` (`WINDOW`)

## 작업

### A. ControlPanel — "어종" 섹션 + 라벨

1. `ControlPanelCallbacks`에 `onEnabledFeaturesChange: (ids: string[]) => void` 추가.
2. **"어종" 섹션 라벨**을 개체수 슬라이더 **직전**에 삽입. 헬퍼 추가:
   ```ts
   private _appendSectionLabel(text: string): void {
     const el = document.createElement('div')
     el.style.cssText = `font-size:11px;font-weight:700;color:${COLORS.textSecondary};letter-spacing:0.04em;margin:2px 0 8px;opacity:0.8;`
     el.textContent = text
     this._panel.appendChild(el)
   }
   ```
   개체수 슬라이더 생성 코드(`this._createSlider('개체수', ...)`) 바로 위에서 `this._appendSectionLabel('어종')` 호출.
3. **개체수 라벨 변경**: `this._createSlider('개체수', ...)` → 라벨 문자열을 `'개체수 (작은 물고기)'`로.
   (주의: `_createSlider`의 `isPercent` 판정은 라벨 정확매칭 — `'밝기'|'배경 투명도'|'확대'`만 %이므로 영향 없음. 그대로 비-% 정수 표시.)

### B. 특별 개체 접이식 그룹

개체수 슬라이더 **직후**에 접이식 그룹(기본 접힘)을 만든다. 토글 항목은 **setFeatureSpecies에서 채운다**
(가용 종은 `fishSchool.init()` 완료 후에야 알 수 있으므로 생성 시엔 빈 컨테이너).

1. 필드: `private _featureGroupHeader!: HTMLDivElement`, `private _featureGroupBody!: HTMLDivElement`, `private _featureExpanded = false`.
2. 생성자(개체수 슬라이더 다음)에 구성:
   ```ts
   const fg = document.createElement('div'); fg.style.cssText = 'margin-bottom:12px;'
   const fgHeader = document.createElement('div')
   fgHeader.className = 'cp__feature-header'
   fgHeader.textContent = '▸ 특별 개체'
   fgHeader.addEventListener('click', () => this._toggleFeatureGroup())
   const fgBody = document.createElement('div')
   fgBody.className = 'cp__feature-body'
   fgBody.style.display = 'none'
   fg.append(fgHeader, fgBody)
   this._panel.appendChild(fg)
   this._featureGroupHeader = fgHeader
   this._featureGroupBody = fgBody
   ```
3. 접기/펼치기:
   ```ts
   private _toggleFeatureGroup(): void {
     this._featureExpanded = !this._featureExpanded
     this._featureGroupBody.style.display = this._featureExpanded ? 'block' : 'none'
     this._featureGroupHeader.textContent = (this._featureExpanded ? '▾' : '▸') + ' 특별 개체'
   }
   ```
4. **setFeatureSpecies** — main이 init 후 호출:
   ```ts
   setFeatureSpecies(species: { id: string; displayName: string }[], enabled: string[]): void {
     this._featureGroupBody.replaceChildren()
     if (species.length === 0) {
       const empty = document.createElement('div')
       empty.style.cssText = `font-size:11px;color:${COLORS.textSecondary};opacity:0.7;`
       empty.textContent = '추가 가능한 특별 개체가 없습니다.'
       this._featureGroupBody.appendChild(empty)
       return
     }
     const enabledSet = new Set(enabled)
     for (const sp of species) {
       const row = document.createElement('div')
       row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;'
       const label = document.createElement('span')
       label.style.cssText = `font-size:12px;font-weight:500;color:${COLORS.textSecondary};`
       label.textContent = sp.displayName
       const wrap = document.createElement('label'); wrap.className = 'cp__toggle'
       const input = document.createElement('input'); input.type = 'checkbox'
       input.checked = enabledSet.has(sp.id); input.style.cssText = 'display:none;'
       input.dataset.speciesId = sp.id
       const track = document.createElement('span'); track.className = 'cp__toggle-track'
       input.addEventListener('change', () => this._emitEnabledFeatures())
       wrap.append(input, track)
       row.append(label, wrap)
       this._featureGroupBody.appendChild(row)
     }
   }
   private _emitEnabledFeatures(): void {
     const ids = Array.from(
       this._featureGroupBody.querySelectorAll<HTMLInputElement>('input[type=checkbox]'),
     ).filter((i) => i.checked).map((i) => i.dataset.speciesId!).filter(Boolean)
     this._callbacks.onEnabledFeaturesChange(ids)
   }
   ```
5. CSS(`_injectStyles`에 추가):
   ```css
   .cp__feature-header { font-size:12px;font-weight:600;color:${COLORS.textSecondary};cursor:pointer;user-select:none;padding:4px 0;margin-bottom:4px; }
   .cp__feature-header:hover { color:${COLORS.textPrimary}; }
   ```

### C. setInteractive — 종/개체수 제외

`setInteractive`는 **확대·먹이·놀래키기만** 비활성한다(현행). 개체수 슬라이더와 특별 개체 토글은
**비활성 대상에 넣지 마라** — 설정이지 화면 클릭 인터랙션이 아니므로 투과/숨김 중에도 조작 가능해야 한다.
(현재 코드가 fishCount를 비활성하지 않으므로 추가 작업 없음 — 단, feature group을 `cp__control--disabled`에
묶지 않도록 확인만.)

### D. 도움말 모달 갱신

`_buildHelpModal`의 `items` 배열에서:
- `['개체수', ...]` → `['개체수 (작은 물고기)', '함께 헤엄치는 작은 물고기 수를 조절합니다.']`
- 새 항목 추가: `['특별 개체', '고래·만타가오리 등 큰 개체를 켜고 끕니다. 켜면 한 마리씩 천천히 등장합니다.']`

### E. main.ts 배선

1. ControlPanel 콜백 객체에 추가:
   ```ts
   onEnabledFeaturesChange(ids: string[]) {
     settings.enabledFeatures = ids
     fishSchool.setEnabledFeatures(ids as SpeciesId[])
     persistSoon()
   },
   ```
2. step 2에서 확장한 `fishSchool.init().then(...)` 블록 **끝**에 토글 채우기 추가(valid 계산 직후):
   ```ts
   const featureList = [...avail].map((id) => ({ id, displayName: getSpecies(id).displayName }))
   controlPanel.setFeatureSpecies(featureList, valid)
   ```
   (`avail`/`valid`는 step 2에서 정의됨. `controlPanel`은 init().then 시점엔 이미 생성돼 있다 — 선언 순서 확인: ControlPanel은 동기 생성이고 init은 비동기 then이라 안전.)

### F. 패널 잘림 재발 방지

접이식이라 기본(접힘) 높이 증가는 미미하다. 단 **펼친 상태**에서 종료 버튼이 스크롤 밖으로 밀리지
않는지 dev에서 확인한다. 패널은 `overflow-y:auto` + `max-height:calc(100vh-96px)`이고 확장 창은
`panelExtra`(=400)로 커진다. 종료 버튼이 잘리면 `WINDOW.panelExtra`를 상향(예: 440)하거나 그룹을
접힘 기본 유지로 대응(매직넘버는 config에서).

## Acceptance Criteria

```bash
npm run test
npm run build
npm run lint
npm run smoke
```

## 검증 절차

1. AC 4개 종료코드 0(smoke `pass:true`). 기존 패널 회귀 없음.
2. **eval(harness smoke + vision)**: 패널/수조 렌더 정상, 콘솔 에러 0, 투과 보존, 화면 비지 않음.
3. **dev 라이브 QA**(`npm run dev` — 자기보고 불신, 반드시 수행):
   - "특별 개체 ▸" 클릭 → 펼침/접힘. 토글 4개(만타가오리·고래·돌고래·상어) 표시.
   - 각 토글 ON → 해당 대형 개체가 **화면 안에 즉시** 등장(머리 진행방향, 누운/뒤집힘 없음). OFF → 사라짐.
   - 개체수 라벨이 "개체수 (작은 물고기)"이고 슬라이더가 작은 물고기만 조절(대형은 토글로만).
   - **재시작**: 토글 상태가 복원됨.
   - **마우스 투과/수조 숨김 ON 중에도** 종 토글·개체수 조작 가능(확대·먹이·놀래키기는 비활성 유지).
   - 패널 펼친 상태에서 **종료 버튼 잘림 없음**.
   - 머리 자세가 어긋난 종이 있으면 보고(원인=GLB 노드 변환/머리축; 필요 시 후속 step에서 `Fish._align` 보정).
4. `index.json` step 3 갱신(`completed` + summary, dev QA 결과 명시).

## 금지사항

- 특별 개체 토글/개체수 슬라이더를 `setInteractive`의 비활성 대상에 넣지 마라. 이유: 설정 컨트롤이라 투과/숨김 중에도 조작돼야 함.
- 썸네일/렌더-투-텍스처를 추가하지 마라(범위 밖, YAGNI). 텍스트 displayName으로 충분.
- `availableFeatures`에 없는 종 토글을 그리지 마라(로드 실패 종 숨김 = 유령 차단). 토글 목록은 setFeatureSpecies 인자(main이 avail로 구성)만 사용.
- 매직넘버를 ControlPanel에 흩뿌리지 마라(크기/여백은 기존 CSS 패턴 재사용, 임계값은 `WINDOW`/config).
- dev QA 없이 "동작함"으로 단정하지 마라(smoke는 토글 인터랙션·머리 자세를 못 본다).
