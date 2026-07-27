import { defineConfig } from "@apps-in-toss/web-framework/config";

/**
 * Apps in Toss 앱 설정.
 *
 * appName은 콘솔의 고유 앱 ID다. 2026-07-27에 `one-line-summer`로
 * 확정했다. **등록 후에는 바꿀 수 없다.**
 *
 * 딥링크 경로(`intoss://<appName>`)에도 쓰인다. 여기를 고치면
 * `src/bridge.js`의 `APP_NAME`도 반드시 같이 고쳐야 한다. 한쪽만
 * 바뀌면 링크를 받은 사람이 앱을 열지 못한다.
 *
 * brand.icon은 콘솔에 아이콘을 올린 뒤 받는 URL로 채워야 한다.
 */
export default defineConfig({
  // 콘솔 중복 확인 통과 (2026-07-27). 변경 불가.
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
