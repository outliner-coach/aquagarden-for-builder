// electron-builder afterPack 훅 — macOS .app을 ad-hoc 서명한다.
// Apple Silicon은 모든 실행 파일에 최소 ad-hoc 서명을 요구하므로, 미서명(identity:null) 빌드는
// 격리를 풀어도 실행이 거부된다. 유료 Developer 인증서 없이도 실행되도록 codesign -s - 로 서명.
// (notarization은 아니므로 첫 실행 시 Gatekeeper 우회는 여전히 필요할 수 있다.)
const { execFileSync } = require('node:child_process')
const path = require('node:path')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return
  const appName = `${context.packager.appInfo.productFilename}.app`
  const appPath = path.join(context.appOutDir, appName)
  // --deep: 내부 헬퍼 앱·프레임워크까지 ad-hoc 서명. "-" = ad-hoc identity.
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' })
  // eslint-disable-next-line no-console
  console.log(`[adhoc-sign] ad-hoc signed ${appPath}`)
}
