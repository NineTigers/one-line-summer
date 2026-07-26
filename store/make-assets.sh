#!/usr/bin/env bash
# 콘솔 지면 자산을 코드에서 다시 만든다.
#
#   ./store/make-assets.sh
#
# 빌드 결과물을 임시 폴더로 복사하고 거기에 캡처용 소스를 얹어 찍는다.
# 제품 코드에는 스크린샷용 분기를 넣지 않는다.
#
# 함정: --force-device-scale-factor는 레이아웃 뷰포트가 어긋나 오른쪽이
# 잘린다. 그래서 --window-size를 최종 크기로 그대로 준다.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STORE="$ROOT/store"
WORK="$(mktemp -d)"
PROFILE="$(mktemp -d)"
PORT="${PORT:-4187}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

cleanup() {
  [[ -n "${SERVER_PID:-}" ]] && kill "$SERVER_PID" 2>/dev/null || true
  rm -rf "$WORK" "$PROFILE"
}
trap cleanup EXIT

echo "==> 웹 빌드"
cd "$ROOT"
npx vite build >/dev/null

echo "==> 캡처용 임시 폴더 $WORK"
cp -R "$ROOT/dist/." "$WORK/"
cp "$STORE"/*.source.html "$STORE/screenshot.css" "$WORK/"

echo "==> 정적 서버 :$PORT"
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$WORK" >/dev/null 2>&1 &
SERVER_PID=$!
sleep 2

# 크롬은 PNG를 쓰고도 스스로 끝나지 않을 때가 있다. 파일이 생기고
# 크기가 멈추면 우리가 끊는다.
shoot() {
  local page="$1" out="$2" width="$3" height="$4"
  local target="$STORE/$out"
  echo "==> $out (${width}x${height})"
  rm -f "$target"

  "$CHROME" \
    --headless=old \
    --disable-gpu \
    --hide-scrollbars \
    --no-sandbox \
    --user-data-dir="$PROFILE" \
    --window-size="${width},${height}" \
    --virtual-time-budget=8000 \
    --screenshot="$target" \
    "http://127.0.0.1:$PORT/$page" >/dev/null 2>&1 &
  local pid=$!

  local last=0 size=0
  for _ in $(seq 1 60); do
    sleep 0.5
    if [[ -f "$target" ]]; then
      size=$(wc -c <"$target")
      [[ "$size" -gt 0 && "$size" -eq "$last" ]] && break
      last="$size"
    fi
    kill -0 "$pid" 2>/dev/null || break
  done

  kill -9 "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  [[ -s "$target" ]] || { echo "실패: $out"; exit 1; }
}

shoot "icon.source.html" "icon-600.png" 600 600
shoot "thumbnail.source.html" "thumbnail-1932x828.png" 1932 828
shoot "screenshot-1.source.html" "screenshot-1-home.png" 636 1048
shoot "screenshot-2.source.html" "screenshot-2-draw.png" 636 1048
shoot "screenshot-3.source.html" "screenshot-3-received.png" 636 1048

echo "==> 완료"
ls -la "$STORE"/*.png
