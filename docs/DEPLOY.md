# 배포 가이드 (Aquagarden)

Electron 데스크톱 앱을 GitHub Releases로 배포한다. macOS(.dmg)·Windows(.exe) 설치 파일을
**GitHub Actions가 태그 push 시 자동 빌드·게시**한다.

## 한 줄 요약 (릴리스 내는 법)

```bash
# 1) 배포할 코드를 기본 브랜치(또는 릴리스 브랜치)에 머지
# 2) package.json 의 version 을 올린다 (예: 0.1.0 → 0.1.1)
# 3) 같은 버전으로 태그를 만들어 push
git tag v0.1.1
git push origin v0.1.1
```

→ `.github/workflows/release.yml` 이 macOS·Windows 러너에서 각각 빌드해
`https://github.com/outliner-coach/aquagarden-for-builder/releases` 의 `v0.1.1` 릴리스에
`.dmg`(arm64·x64)와 `.exe`(x64)를 첨부한다. (Actions 탭에서 진행 상황 확인)

- 빌드 전 `npm test`(순수 로직)가 게이트로 돈다. 실패하면 릴리스가 안 만들어진다.
- 추가 시크릿 설정 불필요 — 기본 `GITHUB_TOKEN` 으로 같은 레포 Release에 게시한다.

## 로컬에서 만들어 보기 (테스트)

```bash
npm run pack   # dist/ 에 .app(맥)만 빠르게 — 설치 파일 없이 동작 확인
npm run dist   # dist/ 에 현재 OS용 설치 파일(.dmg 등) 생성 (게시는 안 함)
```

## 설치 안내 (배포받는 사람에게 전달)

### macOS — ⚠️ 공증(notarization) 안 된 앱이라 첫 실행에 한 번 우회가 필요
빌드는 **ad-hoc 서명**돼 있어 Apple Silicon에서도 실행은 되지만, Apple **공증(notarization)**은
안 돼 있어서 다른 Mac에서 처음 열 때 Gatekeeper가 막는다. (악성이 아니라 미공증이라서다.)

> 참고: 미서명(서명 자체가 없는) 빌드는 Apple Silicon에서 격리를 풀어도 실행이 거부된다.
> 그래서 `build/adhoc-sign.cjs`(afterPack 훅)로 모든 mac 빌드를 `codesign -s -`(ad-hoc) 서명한다.

1. Releases에서 **Apple Silicon은 `Aquagarden-<버전>-arm64.dmg`**, 인텔 맥은 `Aquagarden-<버전>.dmg`(접미사
   없는 것 = x64) 다운로드. (arm64 맥에서 x64를 받으면 Rosetta로 돌고 "Intel 앱 지원 종료" 경고가 뜬다.)
2. dmg 열고 `Aquagarden`을 `응용 프로그램`으로 드래그
3. 첫 실행 → 차단되면:
   - **방법 A(권장, 영구):** 터미널에서 한 번 `xattr -dr com.apple.quarantine /Applications/Aquagarden.app`
     → 이후 더블클릭으로 바로 열림. (격리 플래그를 지워 Gatekeeper가 다시 검사 안 함)
   - **방법 B(GUI):** **시스템 설정 → 개인정보 보호 및 보안 → "그래도 열기"**. 단 ad-hoc(미공증) 앱은
     이 승인이 안정적으로 남지 않아 매 실행마다 다시 물을 수 있으므로 방법 A를 권장.

### Windows — SmartScreen 우회
1. Releases에서 `Aquagarden Setup <버전>.exe` 다운로드·실행
2. "Windows의 PC 보호" 창이 뜨면 **추가 정보 → 실행**

## 완전 무경고로 만들려면 (선택, 유료)
- **macOS:** Apple Developer Program($99/년) 가입 → Developer ID 인증서로 서명 + notarization.
  CI에 인증서(`CSC_LINK`/`CSC_KEY_PASSWORD`)·notarization 자격증명(`APPLE_ID` 등) 시크릿을 넣고
  `package.json` build.mac 의 `identity: null` 을 제거한다.
- **Windows:** 코드서명 인증서(EV 권장)로 서명하면 SmartScreen 경고가 줄어든다.

## 참고
- 앱 아이콘 미설정 → 기본 Electron 아이콘 사용. 커스텀하려면 `build/icon.icns`(mac)·`build/icon.ico`(win)
  추가 후 `package.json` build 에 경로 지정.
- `dist/`·`out/` 은 `.gitignore` 대상(커밋 안 함). 배포 산출물은 CI가 Release에만 올린다.
