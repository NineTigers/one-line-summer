/**
 * 전에 본 그림인지 알아보기.
 *
 * 받은 사람이 한 붓을 더해 **보낸 사람에게 돌려주면** 원래 사람이 다시
 * 들어온다. 메신저가 알림 역할을 하므로 백엔드도 푸시 권한도 필요 없다.
 * 8월 1차 심사가 지표 기반이라 이 왕복이 실제로 일어나는지 재는 것이
 * 중요하다.
 *
 * 그런데 링크로 들어온 것은 전부 똑같이 보인다. 처음 받은 사람과 자기
 * 그림을 보러 돌아온 사람이 구분되지 않는다.
 *
 * 링크에 계보 번호를 넣을 수도 있지만 그럴 필요가 없다. 붓은 앞에서부터
 * 쌓이기만 하므로, 들어온 그림의 붓 목록이 이 기기에 있는 그림으로
 * 시작하면 같은 그림이 이어진 것이다. 링크는 한 바이트도 길어지지
 * 않는다.
 *
 * DOM을 쓰지 않는다. `test/lineage.test.mjs`가 직접 불러 확인한다.
 */

/**
 * 붓 하나를 문자열로 굳힌다.
 *
 * 좌표는 정수이고, 보내는 쪽과 받는 쪽이 같은 방식으로 점을 줄이므로
 * 같은 붓은 같은 문자열이 된다.
 */
function strokeSignature(stroke) {
  return stroke.points.map((point) => point.join(",")).join(" ");
}

/**
 * `candidate`가 `earlier`에서 이어진 그림인지.
 *
 * 앞부분이 통째로 같아야 한다. 붓 몇 개가 우연히 겹치는 것으로는
 * 같은 그림이라고 보지 않는다.
 */
export function isContinuationOf(earlier, candidate) {
  if (earlier.length === 0) return false;
  if (earlier.length > candidate.length) return false;

  return earlier.every(
    (stroke, index) =>
      strokeSignature(stroke) === strokeSignature(candidate[index]),
  );
}

/**
 * 이 기기가 전에 본 그림이 이어진 것인지.
 *
 * 내가 시작한 그림이 돌아온 경우와, 남에게 받아 이어 그린 그림이 다시
 * 돌아온 경우를 모두 잡는다. 둘 다 재방문이다.
 */
export function hasSeenBefore(storedDocs, doc) {
  return storedDocs.some((stored) =>
    isContinuationOf(stored.strokes, doc.strokes),
  );
}
