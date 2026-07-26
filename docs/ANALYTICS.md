# 올여름 내가 토스할게 분석 계획

- 문서 상태: v4 활성 기준
- 기준 제품: `docs/PRODUCT-SPEC.md`
- 원칙: 알려지지 않은 공모전 배점을 추측하지 않고 제품의 실제 약속
  성사 여부를 측정한다.

## 1. 측정 질문

1. 직접 진입한 사람이 두 개의 구체적 제안을 완성하는가?
2. 만든 초대를 실제로 공유하는가?
3. 링크를 받은 사람이 장면·날짜·역할을 선택해 약속을 확정하는가?
4. 보낸 사람이 확정 결과를 다시 확인하는가?
5. 확정 경험이 새 독립 토스로 이어지는가?

## 2. 핵심 지표

### 제품 핵심 지표

`확정된 약속 수 / 실제 공유된 초대 수`

분모는 공유 버튼 클릭이 아니라 공유 SDK 성공 응답을 기준으로 한다.
SDK가 성공 여부를 확실히 제공하지 않는 경우 `공유 시작`과
`초대 링크 진입`을 분리해 해석한다.

### 대표 전환

`summer_plan_confirmed`

두 장면 중 하나, 날짜 하나, 받는 사람 역할이 서버 트랜잭션으로
저장되어 `confirmed`가 된 순간 한 번만 발생한다.

### 보조 전환

- `summer_invite_created`
- `summer_invite_shared`

### 활성 지표 후보

1순위는 `2일 이후 재방문`이다. 제품 검증에서 답장과 약속 재확인이
2일보다 빠르게 끝나면 `confirmed_plan_revisited` 커스텀 이벤트를
활성 지표로 검토한다. 지표 변경은 다음 날부터 적용될 수 있으므로
출시 직전 임의로 반복 변경하지 않는다.

## 3. 이벤트 사전

이벤트 이름은 `summer_<object>_<action>` 형식을 쓴다.

| 이벤트 | 시점 | 허용 속성 |
| --- | --- | --- |
| `summer_entry_viewed` | 첫 진입 | `entry_type`: direct/invite/return |
| `summer_invite_started` | 첫 장면 선택 | `entry_type` |
| `summer_scenes_selected` | 두 장면 선택 완료 | `scene_pair_key` |
| `summer_dates_completed` | 날짜 2~3개 완료 | `option_count`, `time_band_mix` |
| `summer_invite_created` | 서버 초대 생성 | `scene_pair_key`, `option_count` |
| `summer_share_started` | 공유 CTA | `surface`: pending/confirmed |
| `summer_invite_shared` | 공유 성공 확인 | `surface` |
| `summer_invite_landed` | 초대 링크 진입 | `invite_age_bucket`, `status` |
| `summer_response_started` | 받는 사람 첫 선택 | `invite_age_bucket` |
| `summer_plan_confirmed` | 서버 확정 성공 | `invite_age_bucket`, `scene_key`, `time_band` |
| `summer_plan_viewed` | 확정 결과 노출 | `viewer_role`, `visit_type` |
| `summer_plan_revisited` | 다른 세션에서 결과 재조회 | `viewer_role`, `days_since_confirmed` |
| `summer_new_invite_started` | 확정 화면에서 새 토스 시작 | `source`: confirmed_result |
| `summer_invite_cancelled` | 보내는 사람이 대기 초대 취소 | `age_bucket` |
| `summer_flow_error` | 사용자 흐름을 막는 오류 | `stage`, `error_class`, `recoverable` |

## 4. 금지 데이터

분석 이벤트에 아래 값을 보내지 않는다.

- 표시 이름과 직접 입력 문장
- 정확한 날짜
- 초대 public token과 내부 UUID
- 사용자 익명 키
- 전화번호·연락처·위치
- 서버 오류 원문이나 스택에 포함된 토큰

장면과 역할은 허용 목록의 키만 보낸다. 날짜는 `days_ahead_bucket`,
시간대는 day/sunset/evening으로만 집계한다.

## 5. 퍼널

### 보내는 사람

`summer_invite_started`
→ `summer_scenes_selected`
→ `summer_dates_completed`
→ `summer_invite_created`
→ `summer_invite_shared`

### 받는 사람

`summer_invite_landed`
→ `summer_response_started`
→ `summer_plan_confirmed`

### 재방문·확산

`summer_plan_confirmed`
→ `summer_plan_revisited`
→ `summer_new_invite_started`

## 6. 출시 초기 판단 가설

| 구간 | 통과 | 주의 | 중단·재설계 |
| --- | ---: | ---: | ---: |
| 시작 → 생성 | ≥70% | 50~69% | <50% |
| 생성 → 공유 | ≥60% | 40~59% | <40% |
| 링크 진입 → 응답 시작 | ≥75% | 55~74% | <55% |
| 링크 진입 → 확정 | ≥65% | 40~64% | <40% |
| 공유 → 확정 | ≥40% | 25~39% | <25% |
| 확정 → 다른 세션 재조회 | ≥25% | 15~24% | <15% |
| 확정 → 새 토스 시작 | ≥15% | 8~14% | <8% |

초기 모수가 30명 미만이면 백분율만으로 방향을 바꾸지 않고 세션
리플레이가 아닌 인터뷰와 오류 로그를 함께 본다.

## 7. 진단 규칙

- 장면 선택 전 이탈: 썸네일·한 줄 소개·첫 화면 가치 문제
- 장면 선택 후 날짜 이탈: 입력 부담 또는 날짜 UI 문제
- 생성 후 공유 이탈: 상대에게 보내기 부담 또는 미리보기 가치 문제
- 링크 진입 후 응답 이탈: 받는 사람 가치·안전·선택지 문제
- 확정 후 재조회 없음: 결과가 약속 기록으로 기능하지 못함
- 확정 후 새 토스 없음: 경험 만족 또는 대상 확장성이 약함

한 구간을 개선할 때 다른 구간을 억지로 악화시키지 않는다. 예를 들어
공유율을 올리기 위해 연락처 권한이나 리워드를 추가하지 않는다.

## 8. 데이터 품질

- 서버 확정 이벤트는 Invite ID 기준 한 번만 집계
- 클라이언트와 서버 이벤트 중복 여부를 문서화
- 개발·샌드박스 로그와 출시 콘솔 지표를 분리
- 앱 버전과 유입 경로 속성을 공통으로 포함
- 네트워크 재시도 이벤트에 동일 event id 사용
- 매일 KST 기준 퍼널과 오류율을 확인

## 9. 공모전 운영

1차 심사는 2026-08-01~2026-08-26 지표를 종합 고려하지만 세부 배점은
공개되지 않았다. 아래를 운영 판단에 사용한다.

- 8월 1~3일: 링크 진입·응답 오류와 첫 퍼널
- 8월 4~10일: 공유→확정과 첫 재조회
- 8월 11~17일: 장면·날짜 선택 이탈 개선
- 8월 18~24일: 확정 결과와 새 토스 전환 개선
- 8월 25~26일: 큰 기능 추가 없이 안정성 유지

검수에 다시 들어가는 대규모 기능 변경보다 문구·선택지·오류 복구처럼
검증 가능한 작은 개선을 우선한다.
