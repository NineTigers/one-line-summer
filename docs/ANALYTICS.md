# 한 줄 여름 분석 계획

- 문서 상태: v5 활성 기준
- 기준 제품: `docs/PRODUCT-SPEC.md`
- 원칙: 공개되지 않은 심사 배점을 추측하지 않고 실제 공동 창작과
  분기 공유가 일어나는지 측정한다.

## 1. 측정 질문

1. 직접 진입한 사람이 설명 없이 첫 획을 남기는가?
2. 받은 사람이 앞 선의 끝에서 자신의 한 획을 보태는가?
3. 중간 선을 한 명이 아니라 여러 사람에게 실제로 보내는가?
4. 같은 부모에서 서로 다른 가지가 두 개 이상 생기는가?
5. 분기 비교가 새 공유나 새 획으로 이어지는가?
6. 점수·보상 없이도 사용자가 결과 차이를 재미로 설명하는가?

## 2. 핵심 지표

### 제품 핵심 지표

`분기된 공통 부모 수 / 실제 수신된 중간 선 수`

분기된 공통 부모는 서로 다른 자식 Node가 두 개 이상 생성된 부모다.
같은 사람이 같은 요청을 재시도한 중복은 idempotency key로 제거한다.

### 대표 전환

`summer_branch_created`

한 부모에 두 번째 고유 자식 Node가 저장되어 처음으로 분기가 성립한
순간 한 번만 발생한다.

### 보조 지표

- 직접 진입 → 첫 획 저장률
- 공유 시작 → 링크 수신률
- 링크 수신 → 다음 획 저장률
- 중간 흐름 열람 → 중간 선 공유율
- 분기 비교 → 새 한 획 또는 새 공유율
- 네 획 경로 완성률

`공유 버튼 클릭`은 실제 수신을 뜻하지 않는다. SDK 성공 응답과
`entry_type=shared` 진입을 분리해 본다.

## 3. 이벤트 사전

이벤트 이름은 `summer_<object>_<action>` 형식을 쓴다.

| 이벤트 | 시점 | 허용 속성 |
| --- | --- | --- |
| `summer_entry_viewed` | 첫 진입 | `entry_type`: direct/shared/return |
| `summer_seed_selected` | 빛·장면 선택 | `palette_key`, `prompt_key` |
| `summer_stroke_started` | 유효 시작점 입력 | `depth`, `entry_type` |
| `summer_stroke_saved` | 자식 Node 저장 성공 | `depth`, `author_slot`, `point_bucket` |
| `summer_share_started` | 공유 UI 호출 | `depth`, `source_screen` |
| `summer_shared_entry_viewed` | 공유 링크 진입 | `depth` |
| `summer_flow_viewed` | 중간 흐름 열람 | `depth` |
| `summer_midpoint_selected` | 중간 상태 선택 | `selected_depth`, `current_depth` |
| `summer_branch_created` | 부모의 둘째 자식 저장 | `parent_depth` |
| `summer_branches_compared` | 분기 비교 노출 | `branch_count_bucket`, `parent_depth` |
| `summer_path_completed` | 완성 상태 저장 | `depth`, `participant_bucket` |
| `summer_replay_started` | 순서 다시 보기 | `depth`, `reduced_motion` |
| `summer_artwork_saved` | PNG 저장 시작 | `depth` |
| `summer_error_shown` | 복구 가능한 오류 | `error_code`, `screen` |

## 4. 금지 속성

- 표시 이름과 직접 입력 문구
- 원본 좌표 배열
- 공개 토큰·URL
- 익명 키·내부 사용자 해시
- IP·기기 광고 식별자
- 정확한 시각이나 위치
- 사용자가 그린 모양을 추론한 라벨

## 5. 퍼널

### 생성 퍼널

`direct entry → seed selected → first stroke saved → share started`

### 수신 퍼널

`shared entry → stroke started → child saved`

### 분기 퍼널

`midpoint selected → share started → 2+ shared entries → branch created → branches compared`

### 완성 퍼널

`first stroke → second participant → four strokes → path completed → replay/save`

## 6. 해석 규칙

- 로컬 프로토타입 이벤트는 제품 지표에 합치지 않는다.
- 샌드박스 SDK 성공을 실제 공유 성공으로 간주하지 않는다.
- 분기 수를 인기나 품질 점수로 쓰지 않는다.
- 한 사용자의 반복 새로고침을 별도 참여로 세지 않는다.
- 지표 상승이 스팸 공유나 원치 않는 압박에서 왔는지 정성 인터뷰로
  함께 확인한다.

## 7. 출시 판정용 최소 표본

정량 통계가 아니라 방향 결정을 위한 초기 표본으로 다섯 그룹을 쓴다.

- 네 그룹 이상: 첫 획과 수신 획 무설명 완료
- 세 그룹 이상: 같은 중간 선을 두 명 이상에게 전송
- 세 그룹 이상: 분기 비교 후 결과 차이를 자발적으로 말함
- 두 그룹 이하: 받은 링크가 부담스럽다고 응답

표본이 작으므로 퍼센트만 보고 우승 가능성을 주장하지 않는다.
