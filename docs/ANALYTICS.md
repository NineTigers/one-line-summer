# 한 줄 여름 분석 계획

- 문서 상태: v5.1 활성 기준
- 기준 제품: `docs/PRODUCT-SPEC.md`
- 구현 위치: `src/bridge.js`, `src/ui/app.js`
- 원칙: 공개되지 않은 심사 배점을 추측하지 않고 실제로 붓이 오가는지
  측정한다.

> **v5 초안에서 바뀐 이유.** 이전 판은 대표 전환이
> `summer_branch_created`였다. 분기는 v5.1에서 공개 흐름에서 빠진
> 기능이라 그 이벤트는 영원히 발생하지 않는다. 없는 기능을 재고
> 있으면 8월 지표가 0으로 보인다. 지금 있는 제품 기준으로 다시 썼다.

## 1. 측정 질문

1. 직접 진입한 사람이 설명 없이 첫 붓을 남기는가?
2. 한 붓을 저장한 사람이 실제로 토스까지 가는가?
3. 받은 사람이 이어 그리고 **다시** 토스하는가?
4. 릴레이가 몇 번째 붓까지 이어지는가?
5. 링크가 깨져서 흐름이 끊기는 일이 얼마나 되는가?

## 2. 핵심 지표

### 제품 핵심 지표

`재토스율 = 받은 링크로 진입해 다시 토스한 수 / 받은 링크 진입 수`

이 제품은 한 붓이 다음 사람에게 넘어갈 때만 성립한다. 받은 사람이
이어 그리고 멈추면 릴레이가 끊긴 것이다.

### 대표 전환

`summer_toss_result` 의 `result=shared`

버튼을 눌렀다는 것과 실제로 건네졌다는 것은 다르다. 클릭이 아니라
공유 결과를 전환으로 센다.

### 릴레이 깊이

거의 모든 이벤트에 `depth`(그림에 쌓인 붓 수)를 붙인다. `depth`별
`summer_toss_result` 분포가 릴레이가 어디서 끊기는지 보여준다.

`depth`는 링크 길이의 상한(`MAX_STROKES` 12)에서 멈춘다. 실제 분포가
상한에 닿기 시작하면 백엔드 없이는 더 못 간다는 신호다.

### 보조 지표

- 직접 진입 → 배경 선택률
- 배경 선택 → 첫 붓 저장률
- 붓 저장 → 토스 성공률
- 받은 링크 진입 → 이어 그리기 시작률
- 깨진 링크 비율

## 3. 이벤트 사전

이름은 `summer_<object>_<action>` 형식을 쓴다. 아래가 구현된 전부다.

| 이벤트 | 종류 | 시점 | 속성 |
| --- | --- | --- | --- |
| `summer_entry_viewed` | impression | 앱 진입 1회 | `entry_type`: direct/shared |
| `summer_home_viewed` | screen | 첫 화면 | `depth` |
| `summer_setup_viewed` | screen | 배경 선택 화면 | `depth` |
| `summer_draw_viewed` | screen | 그리기 화면 | `depth` |
| `summer_invite_viewed` | screen | 받은 그림 화면 | `depth` |
| `summer_start_tapped` | click | `첫 한 붓 그리기` | — |
| `summer_theme_selected` | click | 배경 골라 캔버스 생성 | `theme_key` |
| `summer_invite_accepted` | click | `한 붓 더하기` | `depth` |
| `summer_stroke_started` | impression | 캔버스에 첫 점 | `depth` |
| `summer_stroke_saved` | impression | 한 붓 저장 | `depth` |
| `summer_toss_tapped` | click | `친구에게 토스하기` | `depth` |
| `summer_toss_result` | impression | 공유 종료 | `result`, `depth` |
| `summer_link_broken` | impression | 링크 해독 실패 | — |

`summer_toss_result`의 `result`:

| 값 | 뜻 |
| --- | --- |
| `shared` | 토스 또는 시스템 공유 시트로 건넸다 |
| `copied` | 공유 시트가 없어 링크를 복사했다 |
| `fallback` | 복사도 실패해 직접 복사 입력창을 보였다 |
| `cancelled` | 사용자가 공유를 닫았다 |

## 4. 금지 속성

- 그림 좌표와 붓의 모양
- 공유 링크와 토큰 값
- 익명 키
- 표시 이름과 직접 입력 문구
- IP·기기 광고 식별자
- 정확한 시각이나 위치

`depth`와 `theme_key`는 그림 내용을 담지 않는다.

## 5. 퍼널

### 생성 퍼널

`entry_viewed(direct) → start_tapped → theme_selected → stroke_saved
→ toss_result(shared)`

### 수신 퍼널

`entry_viewed(shared) → invite_accepted → stroke_saved
→ toss_result(shared)`

**수신 퍼널의 마지막 칸이 이 제품의 전부다.** 여기서 끊기면 릴레이가
아니라 일회성 그림 전송이다.

## 6. 해석 규칙

- 로컬 프로토타입 이벤트는 제품 지표에 합치지 않는다.
- 브릿지가 없는 브라우저에서는 이벤트가 아예 나가지 않는다. 웹에서
  본 수치를 토스 안 수치로 쓰지 않는다.
- `summer_toss_tapped`을 공유 성공으로 읽지 않는다.
- 한 사용자의 반복 새로고침을 별도 참여로 세지 않는다.
- 지표 상승이 스팸 공유나 원치 않는 압박에서 왔는지 정성 인터뷰로
  함께 확인한다.

## 7. 아직 못 재는 것

- **재방문.** 익명 키를 기기에 저장하지만 방문 시점을 기록하지 않는다.
  8월 1차 심사가 재방문 기반인데 이 구조에는 재방문할 이유 자체가
  없다. 제품 결정이 먼저다.
- **링크를 받은 사람이 원래 사람과 이어졌는지.** 백엔드가 없어 두
  기기의 이벤트를 연결할 수 없다. `depth`로 간접 추정만 한다.

## 8. 출시 판정용 최소 표본

정량 통계가 아니라 방향 결정을 위한 초기 표본으로 다섯 그룹을 쓴다.

- 네 그룹 이상: 첫 붓과 이어 그리기를 설명 없이 완료
- 세 그룹 이상: 받은 뒤 실제로 다시 토스
- 두 그룹 이하: 받은 링크가 부담스럽다고 응답

표본이 작으므로 퍼센트만 보고 우승 가능성을 주장하지 않는다.
