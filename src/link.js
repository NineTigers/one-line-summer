/**
 * 그림을 링크에 싣는 형식.
 *
 * 백엔드가 없어서 그림이 링크에 통째로 들어간다. 붓이 늘수록 링크가
 * 길어지고, 문서를 JSON 그대로 실으면 세 붓에서 이미 4천 자를 넘겨
 * 메신저 전달과 딥링크가 깨진다.
 *
 * 그래서 링크에는 **그림을 다시 그리는 데 필요한 것만** 담는다.
 * 식별자·시각·이름은 받는 쪽에서 새로 만든다. v5.1에서 이력과 분기를
 * 공개 흐름에서 뺐으므로 계보를 링크로 옮길 이유가 없다.
 *
 * 좌표는 앞 점과의 차이만 적는다. 입력이 8단위 미만 이동을 버리므로
 * 차이는 대개 한 바이트에 들어간다.
 *
 *   [형식][밑그림][팔레트][붓 수]
 *   붓마다: [작성자<<2 | 펜색][점 수][첫 점 x][첫 점 y][이후 델타...]
 *
 * DOM을 쓰지 않는다. `test/link.test.mjs`가 이 파일을 직접 불러
 * 왕복과 길이를 확인한다.
 */

export const FORMAT_VERSION = 6;

/**
 * 붓 하나가 링크에 실을 수 있는 점 수.
 *
 * 손가락 한 붓을 그리면 점이 수십 개 쌓이지만, 그리는 화면은 점을
 * 곡선으로 이어 그린다. 점을 줄여도 같은 선으로 보인다. 이 상한이
 * 링크 길이의 최악값을 결정한다.
 */
export const MAX_POINTS = 30;

/**
 * 그림 하나에 쌓을 수 있는 붓의 수.
 *
 * `MAX_POINTS`와 함께 링크 길이의 최악값을 정한다. 늘리려면
 * `test/link.test.mjs`의 길이 상한을 먼저 확인한다.
 */
export const MAX_STROKES = 12;

function perpendicularDistance(point, start, end) {
  const [px, py] = point;
  const [sx, sy] = start;
  const [ex, ey] = end;
  const dx = ex - sx;
  const dy = ey - sy;

  if (dx === 0 && dy === 0) return Math.hypot(px - sx, py - sy);

  const along = ((px - sx) * dx + (py - sy) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, along));
  return Math.hypot(px - (sx + clamped * dx), py - (sy + clamped * dy));
}

function markCorners(points, first, last, tolerance, keep) {
  let furthest = 0;
  let at = -1;

  for (let index = first + 1; index < last; index += 1) {
    const distance = perpendicularDistance(
      points[index],
      points[first],
      points[last],
    );
    if (distance > furthest) {
      furthest = distance;
      at = index;
    }
  }

  if (furthest > tolerance) {
    markCorners(points, first, at, tolerance, keep);
    keep.add(at);
    markCorners(points, at, last, tolerance, keep);
  }
}

/**
 * 선의 모양을 유지하면서 점을 줄인다.
 *
 * 먼저 직선에 가까운 구간의 중간 점을 버린다. 그래도 상한을 넘으면
 * 고르게 솎아낸다. 마구 흔든 낙서까지 링크가 감당하게 하려면 상한이
 * 반드시 보장돼야 한다.
 *
 * 허용 오차 6은 0~1000 좌표계 기준이라 캔버스 폭의 0.6%다.
 */
export function reducePoints(points, limit = MAX_POINTS, tolerance = 6) {
  if (points.length <= 2) return points.map((point) => [...point]);

  const keep = new Set([0, points.length - 1]);
  markCorners(points, 0, points.length - 1, tolerance, keep);
  const kept = [...keep].sort((a, b) => a - b).map((index) => points[index]);

  if (kept.length <= limit) return kept;

  const thinned = [];
  const step = (kept.length - 1) / (limit - 1);
  for (let index = 0; index < limit; index += 1) {
    thinned.push(kept[Math.round(index * step)]);
  }
  return thinned;
}

function writeVarint(bytes, value) {
  let rest = value;
  while (rest >= 0x80) {
    bytes.push((rest & 0x7f) | 0x80);
    rest >>>= 7;
  }
  bytes.push(rest);
}

/** 음수를 부호 비트로 접어 작은 값이 한 바이트에 들어가게 한다. */
function zigzag(value) {
  return value < 0 ? -value * 2 - 1 : value * 2;
}

function unzigzag(value) {
  return value % 2 ? -(value + 1) / 2 : value / 2;
}

function bytesToToken(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function tokenToBytes(token) {
  let base64 = token.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) base64 += "=";
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

/**
 * 그림을 링크 토큰으로 접는다.
 *
 * `artwork`는 `{ prompt, palette, strokes }`이고, 각 붓은
 * `{ actor, color, points }`다. 점은 0~1000 정수 쌍이다.
 */
export function encodeArtwork(artwork) {
  const bytes = [
    FORMAT_VERSION,
    artwork.prompt,
    artwork.palette,
    artwork.strokes.length,
  ];

  artwork.strokes.forEach((stroke) => {
    bytes.push(((stroke.actor === "B" ? 1 : 0) << 2) | stroke.color);
    bytes.push(stroke.points.length);

    let [previousX, previousY] = stroke.points[0];
    writeVarint(bytes, previousX);
    writeVarint(bytes, previousY);

    stroke.points.slice(1).forEach(([x, y]) => {
      writeVarint(bytes, zigzag(x - previousX));
      writeVarint(bytes, zigzag(y - previousY));
      previousX = x;
      previousY = y;
    });
  });

  return bytesToToken(bytes);
}

/**
 * 링크 토큰을 그림으로 편다.
 *
 * 잘렸거나, 형식이 다르거나, 알아볼 수 없으면 `null`을 돌려준다.
 * 부르는 쪽은 그때 막힌 화면 대신 첫 화면을 보여준다.
 */
export function decodeArtwork(token) {
  if (!token) return null;

  try {
    const bytes = tokenToBytes(token);
    let at = 0;

    const readByte = () => {
      if (at >= bytes.length) throw new RangeError("링크가 잘렸어요");
      return bytes[at++];
    };

    const readVarint = () => {
      let result = 0;
      let shift = 0;
      let byte;
      do {
        byte = readByte();
        result |= (byte & 0x7f) << shift;
        shift += 7;
      } while (byte & 0x80);
      return result >>> 0;
    };

    if (readByte() !== FORMAT_VERSION) return null;
    const prompt = readByte();
    const palette = readByte();
    const strokeCount = readByte();

    const strokes = [];
    for (let index = 0; index < strokeCount; index += 1) {
      const flags = readByte();
      const pointCount = readByte();
      if (pointCount < 2) return null;

      let x = readVarint();
      let y = readVarint();
      const points = [[x, y]];

      for (let step = 1; step < pointCount; step += 1) {
        x += unzigzag(readVarint());
        y += unzigzag(readVarint());
        points.push([x, y]);
      }

      strokes.push({
        actor: flags & 0b100 ? "B" : "A",
        color: flags & 0b11,
        points,
      });
    }

    return { prompt, palette, strokes };
  } catch {
    return null;
  }
}
