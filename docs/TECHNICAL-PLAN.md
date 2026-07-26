# 한 줄 여름 기술 계획

- 문서 상태: v5 활성 기술 기준선
- 기준 제품: `docs/PRODUCT-SPEC.md`
- 목표: 같은 중간 선에서 여러 결과가 안전하게 갈라지는 두 기기
  상태 전이를 먼저 증명

## 1. 기술 결정

### 클라이언트

- Apps in Toss WebView
- React + TypeScript
- `@apps-in-toss/web-framework` 최신 검증 버전
- Granite 빌드
- TDS 모바일 컴포넌트와 비게임 내비게이션
- Canvas 2D 기반 선 렌더링

### 백엔드

P0 후보는 `Supabase Edge Functions + Postgres`다.

- 지속 운영 서버 프로세스를 직접 관리하지 않는다.
- Postgres가 불변 중간 상태와 부모-자식 관계를 저장한다.
- Edge Function이 공개 토큰·쓰기 검증·속도 제한을 담당한다.
- Realtime은 P0 필수가 아니다. 진입·포그라운드 복귀·사용자
  새로고침 때 최신 자식 가지를 조회한다.

무료 요금제는 검증 단계 후보일 뿐 무중단 운영 보장이 아니다.
휴면, 할당량, 데이터 보존, 상업 이용 조건은 프로젝트 생성 시점의
공식 요금 정책을 다시 확인한다.

## 2. 핵심 불변식

1. 저장된 노드는 수정하지 않는다.
2. 새 획은 정확히 하나의 부모 노드를 가진다.
3. 부모의 마지막 끝점과 새 획의 첫 점이 허용 오차 안에서 만난다.
4. 같은 부모에서 여러 자식을 만들 수 있다.
5. 한 자식 저장이 형제 자식을 덮어쓰지 않는다.
6. 공개 토큰은 읽기·파생 생성만 허용하고 기존 노드 수정 권한을
   주지 않는다.
7. 클라이언트 URL 상태는 캐시·공유 표현이며 서버가 정본이다.

## 3. 데이터 모델

### `canvases`

- `id`: UUID
- `root_node_id`: UUID, nullable until root creation
- `palette_key`
- `prompt_key`
- `creator_user_hash`: nullable
- `created_at`
- `expires_at`
- `status`: active / completed / deleted

### `nodes`

- `id`: UUID
- `canvas_id`
- `parent_node_id`: nullable, root only
- `depth`: 0~12
- `author_alias`: 최대 8자
- `author_slot`: A / B / guest
- `stroke_color_key`
- `stroke_points`: 정규화된 좌표 JSONB
- `endpoint_x`, `endpoint_y`
- `created_at`
- `finished_at`: nullable

노드 하나는 `부모까지의 그림 + 새 획 하나`를 의미한다. 전체 그림은
루트에서 현재 노드까지 조상 경로를 읽어 재구성한다. P0에서는 최대
12획, 획당 최대 84개 점으로 제한한다.

### `share_tokens`

- `id`
- `node_id`
- `token_hash`: unique
- `created_by_user_hash`: nullable
- `created_at`
- `expires_at`
- `revoked_at`: nullable

토큰 원문은 생성 응답에서 한 번만 반환하고 DB에는 해시만 저장한다.

### `events`

분석 이벤트는 별도 수집 계층을 우선한다. 사용자 이름, 좌표 원문,
공개 토큰, 익명 키를 분석 속성으로 보내지 않는다.

## 4. API

### `POST /v1/canvases`

- 팔레트·장면·표시 이름·첫 획을 검증한다.
- Canvas와 첫 Node를 한 트랜잭션으로 만든다.
- 첫 Node용 공개 토큰을 반환한다.

### `GET /v1/nodes/by-token/:token`

- 현재 노드와 조상 경로를 반환한다.
- 현재 노드의 자식 수와 최대 두 개의 최신 가지 요약을 반환한다.
- 내부 사용자 키·토큰 해시·분석 식별자를 포함하지 않는다.

### `POST /v1/nodes/by-token/:token/children`

입력:

- 표시 이름
- 색상 키
- 정규화된 한 획 좌표
- idempotency key

처리:

1. 토큰·만료·depth 확인
2. 점 수·범위·총 payload 제한 확인
3. 부모 끝점과 새 획 시작점의 거리 확인
4. 부모를 수정하지 않고 새 자식 Node 삽입
5. 새 Node 공유 토큰 생성
6. 동일 idempotency key 재요청이면 기존 자식 반환

### `GET /v1/nodes/by-token/:token/branches`

- 해당 노드의 직접 자식과 각 자식의 대표 말단을 반환한다.
- 기본 최대 두 가지, 커서 기반 추가 조회
- 우열·인기·좋아요 정렬 없음

### `POST /v1/nodes/by-token/:token/complete`

- 현재 경로를 완성 상태로 표시한다.
- 조상 노드나 형제 가지를 잠그지 않는다.
- 완료 이후에도 중간 토큰에서 새 가지 생성 가능

## 5. 동시성과 무결성

- `parent_node_id + idempotency_key_hash` unique constraint
- 부모 노드는 행 잠금 없이 읽고 자식만 append
- 같은 부모의 여러 동시 insert는 모두 성공 가능
- 최대 depth·payload·속도 제한은 서버에서 재검증
- 좌표는 0~1 정규화 또는 고정 논리 캔버스 기준으로 저장
- 표시 이름은 제어 문자 제거·길이 제한·HTML 이스케이프
- 완료 요청은 멱등 처리

## 6. Apps in Toss 연동

### 익명 식별

`getAnonymousKey()` 성공 응답의 `hash`를 다시 단방향 해시해 내부
사용자 기준으로 쓴다.

- 별도 로그인 화면 없음
- 조회 실패해도 받은 링크의 열람·한 획 추가는 가능
- 내 최근 작품 복원만 제한

### 공유

정식 경로 예:

`intoss://<appName>/line/<publicToken>`

`getTossShareLink()`로 정식 링크를 만들고 `share()`로 전송한다.
샌드박스 mock과 실제 QR·실기기 증거를 분리한다.

### 내비게이션과 복원

| 경로 | 역할 |
| --- | --- |
| `/` | 직접 진입·최근 작품 |
| `/create` | 빛·장면·첫 획 |
| `/line/:token` | 받은 중간 선·한 획 추가 |
| `/flow/:token` | 조상 흐름·중간 공유 |
| `/branches/:token` | 같은 부모의 분기 비교 |
| `/result/:token` | 완성·재생·저장 |

## 7. 로컬 프로토타입과 출시 구현의 차이

현재 `prototype/`은:

- 전체 문서를 URL fragment에 base64url로 담는다.
- 같은 브라우저의 `localStorage`에 생성 노드를 저장한다.
- 공유받은 상대 화면을 새 탭으로 재현한다.

이 방식은 네트워크 없이 UX를 검증하기 위한 것이다. 서로 다른 기기의
`localStorage`는 공유되지 않으므로 실제 협업, 동시성, 원본 갱신,
보안의 증거가 아니다. 출시 버전에서 URL에는 공개 토큰만 두고 좌표와
노드 정본은 Supabase에 둔다.

## 8. 개인정보·보안

- 서비스 역할 키를 클라이언트 번들에 포함하지 않는다.
- RLS를 켜고 Edge Function 외 기존 노드 쓰기를 막는다.
- 공개 토큰은 128비트 이상 무작위 값으로 생성한다.
- 토큰·사용자 키·좌표 원문을 애플리케이션 로그에 남기지 않는다.
- 정확한 위치·연락처·전화번호·사진을 수집하지 않는다.
- 작품 만료·사용자 삭제 경로와 실제 삭제 검증 로그를 둔다.
- 공개 토큰별 생성 속도, IP/익명 키 기반 남용 방지를 적용한다.

## 9. 성능·접근성

- 첫 선택 가능 시점 1초 목표
- 한 획 payload 32KB 이하 목표
- 결과 렌더링 60fps 목표, 저사양에서 점 간소화
- 320px·390px 가로 스크롤 없음
- 버튼 터치 영역 최소 44px
- 캔버스에 텍스트 상태 안내와 명확한 접근 가능한 이름 제공
- 색만으로 차례를 구분하지 않고 이름·순서를 함께 표시
- `prefers-reduced-motion`에서 반복 펄스·순서 재생 생략

## 10. 구현 순서

1. 현재 V5 프로토타입으로 무설명 사용성 확인
2. Supabase schema·RLS·Edge Function 최소 절단면
3. 두 브라우저에서 같은 부모의 동시 자식 생성 테스트
4. Apps in Toss 공유·익명 식별·딥링크
5. 두 실기기 왕복
6. 분석·오류·만료·삭제
7. `.ait` 번들·콘솔 검수
