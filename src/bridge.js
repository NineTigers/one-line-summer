/**
 * Apps in Toss 브릿지 얇은 감싸개.
 *
 * 이 앱은 토스 안에서도, 그냥 브라우저에서도 똑같이 돌아가야 한다.
 * 브릿지가 없으면 조용히 `unavailable`을 돌려주고 제품 기능은 그대로
 * 유지한다. SDK 호출이 실패해도 그리기와 링크 공유가 멈추지 않는다.
 *
 * 설치된 SDK: @apps-in-toss/web-framework 2.10.7
 * 확인한 시그니처:
 *   getAnonymousKey(): Promise<{type:'HASH',hash}|'ERROR'|undefined>
 *   getTossShareLink(path: string, ogImageUrl?: string): Promise<string>
 *   share({ message: string }): Promise<void>
 */

/** `granite.config.ts`의 appName과 반드시 같아야 한다. */
export const APP_NAME = "one-line-summer";

let sdkPromise = null;

function loadSdk() {
  if (sdkPromise === null) {
    sdkPromise = import("@apps-in-toss/web-framework").catch(() => null);
  }
  return sdkPromise;
}

/**
 * 비게임 익명 사용자 키.
 *
 * 출시 체크리스트가 사용자 식별자 저장을 필수로 요구한다.
 * 문서에는 `INVALID_CATEGORY` 반환이 적혀 있으나 설치된 2.10.7의
 * 타입 정의에는 없다. 둘 다 처리한다.
 */
export async function anonymousKey() {
  const sdk = await loadSdk();
  if (typeof sdk?.getAnonymousKey !== "function") {
    return { status: "unavailable" };
  }

  try {
    const result = await sdk.getAnonymousKey();
    if (!result) return { status: "unsupported-version" };
    if (result === "ERROR") return { status: "error" };
    if (result === "INVALID_CATEGORY") return { status: "invalid-category" };
    if (result.type === "HASH" && typeof result.hash === "string") {
      return { status: "ok", hash: result.hash };
    }
    return { status: "error" };
  } catch {
    return { status: "unavailable" };
  }
}

/**
 * 그림 상태를 담은 토스 딥링크를 만든다.
 *
 * 딥링크는 `intoss://<appName>/?d=<토큰>` 형태다. 프래그먼트(`#`)가
 * deep_link_value를 거쳐 보존된다는 보장이 없어 쿼리로 싣는다.
 * 앱은 쿼리와 프래그먼트 양쪽에서 토큰을 읽는다.
 *
 * 토스 밖이면 `null`을 돌려주고, 호출한 쪽이 웹 링크로 넘어간다.
 */
export async function tossShareLink(token) {
  const sdk = await loadSdk();
  if (typeof sdk?.getTossShareLink !== "function") return null;

  try {
    const path = `intoss://${APP_NAME}/?d=${encodeURIComponent(token)}`;
    const link = await sdk.getTossShareLink(path);
    return typeof link === "string" && link ? link : null;
  } catch {
    return null;
  }
}

/**
 * 토스 네이티브 공유 시트.
 *
 * 성공하면 `shared`, 브릿지가 없으면 `unavailable`을 돌려준다.
 * 사용자가 시트를 닫은 경우와 실패를 구분할 방법이 없으므로 호출한
 * 쪽에서 결과 문구를 단정하지 않는다.
 */
export async function tossShare(message) {
  const sdk = await loadSdk();
  if (typeof sdk?.share !== "function") return "unavailable";

  try {
    await sdk.share({ message });
    return "shared";
  } catch {
    return "failed";
  }
}

/**
 * 지금 시각.
 *
 * 밑그림 공개 일정을 기기 시각으로 판단하면 시계를 바꾼 사람에게 먼저
 * 열린다. 토스 서버 시각을 우선 쓰고, 못 받으면 기기 시각으로 넘어간다.
 * 못 받았다고 앱이 멈추지는 않는다.
 */
export async function now() {
  const sdk = await loadSdk();
  if (typeof sdk?.getServerTime !== "function") return Date.now();

  try {
    if (sdk.getServerTime.isSupported?.() === false) return Date.now();
    const serverTime = await sdk.getServerTime();
    return typeof serverTime === "number" && serverTime > 0
      ? serverTime
      : Date.now();
  } catch {
    return Date.now();
  }
}

/**
 * 분석 이벤트.
 *
 * 이벤트 사전은 `docs/ANALYTICS.md`에 있다. 그림 좌표·링크 토큰·익명
 * 키는 절대 보내지 않는다. 무엇을 했는지와 붓이 몇 번째인지만 남긴다.
 *
 * `screen`은 화면 진입, `click`은 사용자가 누른 것, `event`는 누르지
 * 않았는데 일어난 것(저장 성공, 공유 결과, 깨진 링크)에 쓴다.
 */
async function log(kind, name, params) {
  const sdk = await loadSdk();
  try {
    await sdk?.Analytics?.[kind]?.({ log_name: name, ...params });
  } catch {
    /* 분석 실패가 제품을 막지 않는다 */
  }
}

export function logScreen(name, params = {}) {
  return log("screen", name, params);
}

export function logClick(name, params = {}) {
  return log("click", name, params);
}

export function logEvent(name, params = {}) {
  return log("impression", name, params);
}

/** 토스 앱 안에서 실행 중인지. 판단이 불가능하면 false. */
export async function isInsideToss() {
  const sdk = await loadSdk();
  if (typeof sdk?.getOperationalEnvironment !== "function") return false;
  try {
    const environment = await sdk.getOperationalEnvironment();
    return environment === "toss" || environment?.environment === "toss";
  } catch {
    return false;
  }
}
