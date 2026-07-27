/**
 * 여름 밑그림 공개 일정.
 *
 * 테마 지면 노출 기간(8/1~8/26) 동안 밑그림을 한꺼번에 다 보여주지 않고
 * 주마다 하나씩 더한다. 다시 열어볼 이유를 만들기 위한 것이다.
 *
 * **이것은 해금이 아니다.** 사용자가 무엇을 했는지와 무관하게 모두에게
 * 같은 날 열린다. 방문 횟수나 공유 횟수에 따라 열리는 것은 출석·초대
 * 보상이고, 비게임 경계에서 금지된다. 날짜만 본다.
 *
 * 잠긴 밑그림을 자물쇠나 남은 날짜와 함께 보여주지도 않는다. 게임의
 * 잠금 화면처럼 읽힌다. 그날이 되면 목록에 그냥 나타난다.
 *
 * DOM과 SDK를 쓰지 않는다. `test/season.test.mjs`가 직접 불러 확인한다.
 */

/**
 * 밑그림별 공개 시각. `null`은 출시부터 열려 있다는 뜻이다.
 *
 * 한국 시간 자정 기준이다. 사용자가 어느 시간대에 있든 같은 순간에
 * 열려야 하므로 offset을 명시한다.
 *
 * 늦여름의 흐름을 따라간다. 휴가 절정에 계곡, 광복절 즈음 늦장마,
 * 여름의 끝에 밤 불꽃이 온다.
 */
export const THEME_RELEASE = {
  "sunset-beach": null,
  "bingsu-shop": null,
  "han-river-picnic": null,
  "blank-white": null,
  "green-valley": "2026-08-08T00:00:00+09:00",
  "monsoon-window": "2026-08-15T00:00:00+09:00",
  "summer-fireworks": "2026-08-22T00:00:00+09:00",
};

/**
 * 지금 이 밑그림이 열려 있는지.
 *
 * 일정에 없는 밑그림은 열려 있는 것으로 본다. 새 밑그림을 추가하고
 * 일정을 빠뜨렸을 때 조용히 사라지는 것보다 보이는 편이 낫다.
 */
export function isThemeOpen(themeId, now) {
  const at = THEME_RELEASE[themeId];
  if (!at) return true;

  const opensAt = Date.parse(at);
  if (Number.isNaN(opensAt)) return true;

  return now >= opensAt;
}

/**
 * 화면에 보일 밑그림 순서.
 *
 * `order`는 밑그림 번호의 표시 순서다. 번호 자체는 링크에 들어가므로
 * 절대 바뀌면 안 된다. 여기서는 걸러내기만 한다.
 *
 * 아직 열리지 않은 밑그림으로 그린 그림을 받아도 화면에는 정상적으로
 * 그려진다. 거르는 것은 **고르는 목록**뿐이다.
 */
export function openThemeOrder(order, themes, now) {
  const open = order.filter((index) => isThemeOpen(themes[index].id, now));
  // 일정을 잘못 적어 전부 닫히더라도 첫 밑그림은 남긴다.
  return open.length > 0 ? open : [order[0]];
}
