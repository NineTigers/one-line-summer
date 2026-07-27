import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hasSeenBefore, isContinuationOf } from "../src/lineage.js";

const stroke = (seed) => ({
  points: [
    [100 + seed, 200 + seed],
    [300 + seed, 400 + seed],
    [500 + seed, 600 + seed],
  ],
});

const doc = (...seeds) => ({ strokes: seeds.map(stroke) });

describe("전에 본 그림 알아보기", () => {
  it("붓이 더해진 같은 그림을 알아본다", () => {
    assert.equal(isContinuationOf(doc(1, 2).strokes, doc(1, 2, 3).strokes), true);
  });

  it("한 붓만 더해져도 알아본다", () => {
    assert.equal(isContinuationOf(doc(1).strokes, doc(1, 2).strokes), true);
  });

  it("완전히 같은 그림도 이어진 것으로 본다", () => {
    assert.equal(isContinuationOf(doc(1, 2).strokes, doc(1, 2).strokes), true);
  });

  it("다른 그림은 아니라고 한다", () => {
    assert.equal(isContinuationOf(doc(1, 2).strokes, doc(7, 8, 9).strokes), false);
  });

  it("앞부분이 다르면 아니라고 한다", () => {
    assert.equal(isContinuationOf(doc(1, 2).strokes, doc(9, 2, 3).strokes), false);
  });

  it("붓 몇 개가 우연히 겹치는 것으로는 인정하지 않는다", () => {
    // 같은 붓(2)이 들어 있지만 앞부분이 다르다.
    assert.equal(isContinuationOf(doc(1, 2).strokes, doc(5, 2).strokes), false);
  });

  it("내 그림이 상대 그림보다 길면 아니다", () => {
    assert.equal(isContinuationOf(doc(1, 2, 3).strokes, doc(1, 2).strokes), false);
  });

  it("빈 그림은 아무것도 인정하지 않는다", () => {
    assert.equal(isContinuationOf([], doc(1, 2).strokes), false);
  });
});

describe("재방문 판별", () => {
  it("내가 시작한 그림이 돌아오면 재방문이다", () => {
    const 저장됨 = [doc(1), doc(1, 2)];
    assert.equal(hasSeenBefore(저장됨, doc(1, 2, 3)), true);
  });

  it("받아서 이어 그린 그림이 다시 돌아와도 재방문이다", () => {
    // 남이 시작한 1번 위에 내가 2번을 더해 저장했다.
    const 저장됨 = [doc(1), doc(1, 2)];
    assert.equal(hasSeenBefore(저장됨, doc(1, 2, 3, 4)), true);
  });

  it("처음 받는 그림은 재방문이 아니다", () => {
    const 저장됨 = [doc(1), doc(1, 2)];
    assert.equal(hasSeenBefore(저장됨, doc(7, 8)), false);
  });

  it("저장된 그림이 없으면 재방문이 아니다", () => {
    assert.equal(hasSeenBefore([], doc(1, 2)), false);
  });

  it("빈 그림만 저장돼 있어도 재방문으로 오인하지 않는다", () => {
    assert.equal(hasSeenBefore([doc()], doc(1, 2)), false);
  });
});
