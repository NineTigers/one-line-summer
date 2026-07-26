import { defineConfig } from "@apps-in-toss/web-framework/config";

/**
 * Apps in Toss 앱 설정.
 *
 * appName은 콘솔에서 발급받는 고유 앱 ID다. 아직 콘솔 중복 확인을 하지
 * 않았으므로 아래 값은 임시다. 콘솔에서 앱을 만든 뒤 실제 값으로 바꾸지
 * 않으면 배포가 되지 않는다.
 *
 * appName은 딥링크 경로(`intoss://<appName>`)에도 쓰인다. 값을 바꾸면
 * `src/bridge.js`의 `APP_NAME`도 같이 바꿔야 한다.
 *
 * brand.icon도 콘솔에 아이콘을 올린 뒤 받는 URL로 채워야 한다.
 */
export default defineConfig({
  // 콘솔에서 중복 확인이 필요하다. 막히면 summer-one-line으로 간다.
  appName: "one-line-summer",
  brand: {
    displayName: "한 줄 여름",
    primaryColor: "#087f7a",
    icon: "", // TODO: 콘솔에 아이콘 업로드 후 URL 입력
  },
  web: {
    host: "localhost",
    port: 5173,
    commands: {
      dev: "vite dev",
      build: "vite build",
    },
  },
  // 위치·연락처·카메라·앨범을 쓰지 않는다. 권한 요청이 없다.
  permissions: [],
  outdir: "dist",
});
