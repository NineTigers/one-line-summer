import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FORMAT_VERSION,
  MAX_POINTS,
  MAX_STROKES,
  decodeArtwork,
  encodeArtwork,
  reducePoints,
} from "../src/link.js";

/** 앱이 실제로 만드는 모양의 붓. 입력이 8단위 미만 이동을 버린다. */
function stroke(seed, pointCount, { actor = "A", color = 0 } = {}) {
  let x = 100 + (seed * 37) % 700;
  let y = 100 + (seed * 53) % 700;
  const points = [[x, y]];
  for (let step = 1; step < pointCount; step += 1) {
    x = Math.max(0, Math.min(1000, x + (((seed + step) * 13) % 60) - 20));
    y = Math.max(0, Math.min(1000, y + (((seed + step) * 17) % 60) - 20));
    points.push([x, y]);
  }
  return { actor, color, points };
}

function artwork(strokeCount, pointCount) {
  return {
    prompt: 0,
    palette: 2,
    strokes: Array.from({ length: strokeCount }, (_, index) =>
      stroke(index + 1, pointCount, {
        actor: index % 2 ? "B" : "A",
        color: index % 4,
      }),
    ),
  };
}

describe("링크 토큰", () => {
  it("그림을 그대로 되돌린다", () => {
    const original = artwork(4, 40);
    const decoded = decodeArtwork(encodeArtwork(original));
    assert.deepEqual(decoded, original);
  });

  it("붓 하나짜리 그림도 되돌린다", () => {
    const original = artwork(1, 2);
    assert.deepEqual(decodeArtwork(encodeArtwork(original)), original);
  });

  it("밑그림과 팔레트 선택을 보존한다", () => {
    const original = { ...artwork(2, 10), prompt: 6, palette: 3 };
    const decoded = decodeArtwork(encodeArtwork(original));
    assert.equal(decoded.prompt, 6);
    assert.equal(decoded.palette, 3);
  });

  it("작성자와 펜 색을 보존한다", () => {
    const original = {
      prompt: 0,
      palette: 0,
      strokes: [
        stroke(1, 5, { actor: "B", color: 3 }),
        stroke(2, 5, { actor: "A", color: 1 }),
      ],
    };
    const decoded = decodeArtwork(encodeArtwork(original));
    assert.equal(decoded.strokes[0].actor, "B");
    assert.equal(decoded.strokes[0].color, 3);
    assert.equal(decoded.strokes[1].actor, "A");
    assert.equal(decoded.strokes[1].color, 1);
  });

  it("캔버스 양 끝 좌표를 잃지 않는다", () => {
    const original = {
      prompt: 0,
      palette: 0,
      strokes: [
        { actor: "A", color: 0, points: [[0, 0], [1000, 1000], [0, 1000]] },
      ],
    };
    assert.deepEqual(decodeArtwork(encodeArtwork(original)), original);
  });

  it("잘린 링크는 막힌 화면 대신 null이 된다", () => {
    const token = encodeArtwork(artwork(3, 40));
    for (const cut of [0.25, 0.5, 0.75, 0.9]) {
      const truncated = token.slice(0, Math.floor(token.length * cut));
      assert.doesNotThrow(() => decodeArtwork(truncated));
    }
  });

  it("알아볼 수 없는 값은 null이 된다", () => {
    assert.equal(decodeArtwork(""), null);
    assert.equal(decodeArtwork(null), null);
    assert.equal(decodeArtwork("!!!not base64!!!"), null);
    assert.equal(decodeArtwork("AAAA"), null); // 형식 번호가 다르다
  });

  it("다른 형식 번호는 받지 않는다", () => {
    const token = encodeArtwork(artwork(1, 5));
    const bytes = Buffer.from(
      token.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    );
    bytes[0] = FORMAT_VERSION + 1;
    const other = bytes
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    assert.equal(decodeArtwork(other), null);
  });

  /*
   * 길이가 이 제품의 실질 한계다. 메신저 전달과 딥링크를 감안해
   * 2000자를 상한으로 잡는다.
   *
   * 최악값은 캔버스를 가로지르며 마구 흔든 낙서다. 좌표 차이가 커서
   * 한 점이 두 바이트를 먹는다. 완만한 곡선만으로 재면 이 한계를
   * 놓친다.
   */
  it("최악의 낙서 12붓도 링크 2000자 안에 들어간다", () => {
    const scribbles = Array.from({ length: MAX_STROKES }, (_, index) => ({
      actor: index % 2 ? "B" : "A",
      color: index % 4,
      points: Array.from({ length: MAX_POINTS }, (_, step) => [
        step % 2 ? 1000 : 0,
        step % 2 ? 0 : 1000,
      ]),
    }));
    const token = encodeArtwork({ prompt: 6, palette: 3, strokes: scribbles });
    const deepLink = `intoss://one-line-summer/?d=${encodeURIComponent(token)}`;
    assert.ok(
      deepLink.length < 2000,
      `딥링크가 ${deepLink.length}자다. 2000자를 넘으면 전달이 깨진다.`,
    );
  });
});

describe("점 줄이기", () => {
  it("두 점짜리 선은 그대로 둔다", () => {
    const points = [[10, 10], [900, 900]];
    assert.deepEqual(reducePoints(points), points);
  });

  it("직선 위의 중간 점을 버린다", () => {
    const points = Array.from({ length: 30 }, (_, i) => [i * 30, i * 30]);
    assert.deepEqual(reducePoints(points), [[0, 0], [870, 870]]);
  });

  it("선의 시작과 끝을 잃지 않는다", () => {
    const points = Array.from({ length: 200 }, (_, i) => [
      (i * 37) % 1000,
      (i * 53) % 1000,
    ]);
    const reduced = reducePoints(points);
    assert.deepEqual(reduced[0], points[0]);
    assert.deepEqual(reduced.at(-1), points.at(-1));
  });

  it("낙서도 상한 안으로 들어온다", () => {
    const scribble = Array.from({ length: 240 }, (_, i) => [
      500 + Math.round(400 * Math.sin(i * 1.7)),
      500 + Math.round(400 * Math.cos(i * 2.3)),
    ]);
    assert.ok(reducePoints(scribble).length <= MAX_POINTS);
  });

  it("곡선의 모양은 남긴다", () => {
    const arc = Array.from({ length: 120 }, (_, i) => [
      100 + i * 6,
      500 + Math.round(300 * Math.sin((i / 120) * Math.PI)),
    ]);
    const reduced = reducePoints(arc);
    assert.ok(reduced.length > 4, "완만한 곡선을 직선으로 뭉개면 안 된다");
    assert.ok(reduced.length <= MAX_POINTS);
  });
});
