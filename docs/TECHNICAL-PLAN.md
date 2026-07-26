# 올여름 내가 토스할게 기술 계획

- 문서 상태: v4 활성 기술 기준선
- 기준 제품: `docs/PRODUCT-SPEC.md`
- 목표: 1:1 약속 토스의 두 기기 상태 전이를 먼저 증명

## 1. 기술 결정

### 클라이언트

- Apps in Toss WebView
- React + TypeScript
- `@apps-in-toss/web-framework` SDK 2.4.5 이상
- Granite 빌드
- TDS 모바일 컴포넌트와 비게임 내비게이션 바
- CSR 또는 정적 빌드만 사용

### 백엔드

첫 구현 후보는 `Supabase Edge Functions + Postgres`다.

선정 이유:

- 짧은 일정에서 HTTPS API와 트랜잭션을 함께 구성할 수 있다.
- 초대·응답의 명시적 상태와 만료 쿼리를 관계형으로 표현하기 쉽다.
- 클라이언트에 서비스 역할 키를 노출하지 않고 Edge Function을
  상태 전이 경계로 사용할 수 있다.

P0는 Realtime이나 WebSocket에 의존하지 않는다. 화면 진입·포그라운드
복귀·사용자 새로고침에서 최신 상태를 다시 가져온다. 공급자 확정은
환경 변수와 배포 권한을 확인한 뒤 기록한다.

## 2. 공식 기능

### 비게임 사용자 식별

`getAnonymousKey()`의 성공 응답 `hash`를 내부 사용자 기준으로 쓴다.

- 별도 로그인 화면 없음
- 서버에는 원문을 다시 단방향 해시한 값만 저장
- `INVALID_CATEGORY`, `ERROR`, `undefined`를 각각 처리
- 샌드박스 mock 성공만으로 실제 동작을 승인하지 않고 QR 실기기 확인

식별키 조회 실패 시:

- 받은 초대 조회·응답은 허용
- `내가 보낸 토스` 복원은 제한
- 오류를 가입 요구로 우회하지 않음

### 공유

받는 사람 경로:

`intoss://<appName>/invite/<publicToken>`

정식 링크는 `getTossShareLink()`로 만들고 `share()`로 전송한다.
출시 전 QR 테스트에서는 배포별 private scheme을 테스트 용도로만
사용하며 사용자에게 공유하지 않는다.

## 3. 화면 경로

| 경로 | 역할 |
| --- | --- |
| `/` | 직접 진입·내 최근 초대 |
| `/create` | 장면·날짜·역할 작성 |
| `/create/preview` | 공유 전 확인 |
| `/invite/:token` | 받는 사람 진입·응답 또는 확정 결과 |
| `/mine/:inviteId` | 보내는 사람 답장 대기·확정 상태 |
| `/result/:token` | 확정 결과 공유용 화면 |

경로만으로 권한을 신뢰하지 않는다. 보내는 사람 작업은 익명 키
소유권을 서버에서 확인한다.

## 4. 데이터 모델

### UserRef

- `user_hash`
- `created_at`
- `last_seen_at`

별도 사용자 프로필 테이블은 만들지 않는다. 표시 이름은 초대 안에만
보관한다.

### Invite

- `id`: 내부 UUID
- `public_token_hash`: 공유 토큰 해시
- `creator_user_hash`
- `creator_alias`: 최대 8자
- `scene_a_key`
- `scene_b_key`
- `creator_role_key`
- `creator_message`: 최대 20자
- `status`: pending / confirmed / expired / cancelled
- `created_at`
- `expires_at`: 생성 후 최대 30일
- `confirmed_at`
- `version`

### DateOption

- `id`
- `invite_id`
- `local_date`
- `time_band`: day / sunset / evening
- `sort_order`: 0~2

서버는 오늘 이후·30일 이내·2~3개·중복 없음 규칙을 다시 검증한다.

### Response

- `id`
- `invite_id`: unique
- `responder_user_hash`: nullable
- `responder_alias`: 최대 8자
- `selected_scene_key`
- `selected_date_option_id`
- `responder_role_key`
- `responder_message`: 최대 20자
- `submitted_at`
- `idempotency_key_hash`

초대 하나에 유효 응답 하나만 저장한다.

## 5. API

### `POST /v1/invites`

입력:

- 장면 키 두 개
- 날짜·시간대 2~3개
- 보내는 역할
- 표시 이름·문장
- 클라이언트 idempotency key

처리:

1. 익명 키와 입력 검증
2. 초대·날짜를 한 트랜잭션으로 생성
3. 128비트 이상의 무작위 public token 발급
4. public token은 한 번만 응답하고 DB에는 해시 저장

### `GET /v1/invites/by-token/:token`

응답:

- 공개 가능한 초대 내용
- 현재 상태
- 확정 시 공개 가능한 응답과 결과

포함하지 않음:

- 내부 사용자 키
- 원문 토큰
- 분석 식별자
- 읽음 여부

### `POST /v1/invites/by-token/:token/responses`

처리:

1. token·상태·만료 확인
2. 장면·날짜가 해당 초대의 선택지인지 확인
3. idempotency key 확인
4. Response 생성과 Invite 확정을 한 트랜잭션으로 처리
5. 이미 확정됐으면 기존 확정 결과 반환

### `GET /v1/me/invites`

- 익명 키 소유 초대만 반환
- 최근 20개
- pending / confirmed / expired / cancelled 상태
- 본문 전체가 아니라 목록 요약 반환

### `POST /v1/me/invites/:id/cancel`

- 소유권 확인
- pending만 cancelled로 전환
- confirmed는 취소하지 않음

## 6. 상태 무결성

- 클라이언트 표시 상태가 아니라 서버 상태를 정본으로 사용
- 응답 unique constraint로 동시 제출 방지
- 모든 생성·응답 요청에 idempotency key
- 날짜·장면·역할 키는 허용 목록 검증
- 상태 전이에 낙관적 잠금용 `version` 사용
- 만료는 조회 시 계산과 예약 정리 작업을 함께 사용
- 같은 응답 재시도는 성공한 기존 결과를 반환

## 7. 공유와 OG

### P0

- 정적 챌린지 브랜드 OG 이미지
- 초대 메시지에 보내는 사람의 별칭을 직접 넣지 않음
- 딥링크 진입 후 서버에서 초대 내용 조회

### P1

- 확정된 장면 조합으로 서버 렌더링한 OG
- 생성 실패 시 정적 OG로 폴백
- 사용자 직접 입력 문장은 OG에 포함하지 않음

동적 OG는 P0 출시를 막지 않는다.

## 8. 분석

- 페이지 이동은 SDK 자동 로그와 충돌하지 않게 확인
- 핵심 행동만 커스텀 이벤트로 기록
- 별칭, 문장, 날짜 원문, 토큰, 사용자 키는 분석으로 보내지 않음
- 샌드박스 데이터는 콘솔 분석에 집계되지 않으므로 로컬 디버그 로그와
  출시 후 콘솔 지표를 구분
- 네트워크 실패 시 제품 요청을 막지 않고 분석 이벤트만 제한적으로
  재시도

세부 이벤트는 `docs/ANALYTICS.md`를 따른다.

## 9. 개인정보·보안

- DB·Edge Function·클라이언트 권한을 분리
- 서비스 역할 키를 번들에 포함하지 않음
- RLS를 켜고 Edge Function 외 직접 쓰기를 막음
- public token은 URL·서버 접근 로그 노출 가능성을 고려해 128비트
  이상 무작위 값 사용
- 토큰 원문과 사용자 키를 애플리케이션 로그에 남기지 않음
- 직접 입력은 길이·제어 문자·HTML 이스케이프 검증
- `eval`, 외부 코드 실행, 임의 HTML 삽입 금지
- 정확한 위치·연락처·전화번호 수집 없음
- 30일 만료 데이터 정리 작업과 삭제 검증 로그 운영

## 10. 성능·접근성

- 첫 선택 가능 시점 1초 목표
- 화면 전환과 네트워크 대기 2초 이상이면 상태 안내
- 첫 화면 핵심 이미지 우선 로드, 나머지는 lazy loading
- 320px·390px에서 가로 스크롤 없음
- 버튼 최소 터치 영역과 텍스트 확대 대응
- 라디오 그룹의 이름·선택 상태를 화면 낭독기에 제공
- `prefers-reduced-motion`에서 공 이동 제거
- 네트워크 오류·확정·만료를 색만으로 구분하지 않음

## 11. 테스트

### 단위

- 장면 두 개 중복 방지
- 날짜 범위·개수·중복
- 표시 이름·문장 길이
- 상태 전이 허용표
- 만료 계산
- 공개 응답 DTO에서 비공개 필드 제거

### 통합

- 초대 생성 트랜잭션
- 응답과 확정 원자성
- 중복·동시 응답
- idempotency 재시도
- 소유 초대 목록 권한
- 취소·만료 링크

### E2E

- 직접 진입 → 초대 생성 → 공유 링크 생성
- 새 기기에서 초대 진입 → 응답 → 확정
- 원기기 재진입 → 동일 확정 결과
- 공유 취소 후 다시 공유
- 오프라인 응답 후 재시도
- 백그라운드 복귀

### 실제 환경

- Sandbox WebView
- QR iOS·Android
- `getAnonymousKey` 실제 응답
- private test scheme 경로·쿼리
- 정식 `intoss://` 설정 검수
- 비게임 내비게이션 바·뒤로가기·Safe Area

## 12. 기술 하드 게이트

1. 백엔드 공급자와 환경 변수 소유자가 정해진다.
2. `POST invite → GET recipient → POST response → GET creator`가 서로
   다른 두 브라우저 컨텍스트에서 작동한다.
3. 동시 응답 두 건 중 하나만 확정된다.
4. 익명 키 실패·네트워크 실패·만료 링크에서 복구 경로가 있다.
5. 첫 `.ait` 번들에서 SDK와 비게임 내비게이션 바가 작동한다.

2026-07-27 12:00 KST까지 2번을 통과하지 못하면 시각 폴리싱과 P1을
중단하고 출품 지속 여부를 재결정한다.
