import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { THEME_RELEASE, isThemeOpen, openThemeOrder } from "../src/season.js";

/** 앱의 `THEMES`와 같은 순서. 번호는 링크에 들어가므로 바뀌면 안 된다. */
const THEMES = [
  { id: "sunset-beach" },
  { id: "bingsu-shop" },
  { id: "blank-white" },
  { id: "han-river-picnic" },
  { id: "green-valley" },
  { id: "monsoon-window" },
  { id: "summer-fireworks" },
];

const DISPLAY_ORDER = [0, 1, 3, 4, 5, 6, 2];

const at = (iso) => Date.parse(iso);

describe("밑그림 공개 일정", () => {
  it("출시부터 열린 밑그림은 언제나 보인다", () => {
    for (const id of ["sunset-beach", "bingsu-shop", "han-river-picnic", "blank-white"]) {
      assert.equal(isThemeOpen(id, at("2026-08-01T00:00:00+09:00")), true, id);
    }
  });

  it("공개 시각 전에는 닫혀 있다", () => {
    const 하루전 = at("2026-08-07T23:59:00+09:00");
    assert.equal(isThemeOpen("green-valley", 하루전), false);
    assert.equal(isThemeOpen("monsoon-window", 하루전), false);
    assert.equal(isThemeOpen("summer-fireworks", 하루전), false);
  });

  it("공개 시각 정각에 열린다", () => {
    assert.equal(
      isThemeOpen("green-valley", at("2026-08-08T00:00:00+09:00")),
      true,
    );
  });

  it("한 번 열리면 계속 열려 있다", () => {
    const 나중 = at("2026-09-30T00:00:00+09:00");
    for (const id of Object.keys(THEME_RELEASE)) {
      assert.equal(isThemeOpen(id, 나중), true, id);
    }
  });

  it("일정에 없는 밑그림은 열린 것으로 본다", () => {
    assert.equal(isThemeOpen("아직-없는-밑그림", at("2026-08-01T00:00:00+09:00")), true);
  });

  it("주마다 하나씩 늘어난다", () => {
    const 주차 = [
      ["2026-08-01T09:00:00+09:00", 4],
      ["2026-08-08T09:00:00+09:00", 5],
      ["2026-08-15T09:00:00+09:00", 6],
      ["2026-08-22T09:00:00+09:00", 7],
    ];
    for (const [iso, expected] of 주차) {
      const open = openThemeOrder(DISPLAY_ORDER, THEMES, at(iso));
      assert.equal(open.length, expected, iso);
    }
  });

  it("기본 밑그림은 언제나 목록에 있다", () => {
    const open = openThemeOrder(
      DISPLAY_ORDER,
      THEMES,
      at("2026-08-01T00:00:00+09:00"),
    );
    assert.ok(open.includes(0), "선셋 비치는 기본값이라 항상 있어야 한다");
  });

  it("하얀 캔버스는 출시부터 있고 목록 끝에 남는다", () => {
    const open = openThemeOrder(
      DISPLAY_ORDER,
      THEMES,
      at("2026-08-01T00:00:00+09:00"),
    );
    assert.equal(open.at(-1), 2);
  });

  it("표시 순서를 거를 뿐 밑그림 번호를 바꾸지 않는다", () => {
    const open = openThemeOrder(
      DISPLAY_ORDER,
      THEMES,
      at("2026-08-10T00:00:00+09:00"),
    );
    // 걸러진 순서가 원래 순서의 부분수열이어야 한다.
    let cursor = 0;
    for (const index of open) {
      cursor = DISPLAY_ORDER.indexOf(index, cursor);
      assert.notEqual(cursor, -1, `${index}가 원래 순서에 없다`);
      cursor += 1;
    }
  });

  it("일정이 전부 닫혀 있어도 빈 목록을 주지 않는다", () => {
    const 아주오래전 = at("2020-01-01T00:00:00+09:00");
    const open = openThemeOrder([4, 5, 6], THEMES, 아주오래전);
    assert.equal(open.length, 1);
  });
});
