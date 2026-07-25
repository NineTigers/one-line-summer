# 올여름 내가 토스할게 기술 계획

> 문서 상태: v1 타이밍 게임 기술 계획으로 대체됨. 궤적·점수·토스 및
> 스파이크 데이터 모델은 구현하지 않는다. 활성 제품 기준은
> `docs/PRODUCT-SPEC.md`다.

## 1. 유형별 분기

### 비게임 인터랙티브 테스트로 승인될 경우

- Apps in Toss WebView
- React + TypeScript
- 비게임 익명 사용자 키
- 비게임 내비게이션 바
- 초대 링크와 최소 백엔드

### 게임으로만 분류될 경우

- 이번 챌린지 출품을 자동 진행하지 않는다.
- 동일 게임의 등급분류 증빙 경로를 별도 프로젝트 일정으로 계획한다.
- 게임 사용자 키·게임 프로필·게임 출시 가이드를 적용한다.

유형 확인 전 `appName`과 콘솔 앱 유형을 잠그지 않는다.

## 2. 인터랙션 구현

- 현재 체험판: 압축된 시간대별 배경 이미지 + DOM/CSS 모션 레이어
- 정식 렌더링: 저사양 Android 측정 뒤 DOM 유지 또는 Canvas 전환
- 물리: 고정 시간 간격 기반의 결정적 2D 궤적
- 입력: `pointerdown` 한 번, 중복 입력 잠금
- 재생: 저장된 초기 속도·중력·프레임 기준으로 동일 궤적 재현
- 접근성: 사운드 없이도 접점과 결과를 인지할 수 있는 시각 신호
- 모션 접근성: `prefers-reduced-motion`에서 반복·카메라 모션 중지
- 이미지 예산: 세 장 합계 600KB 안팎, 화면 표시 폭에 맞춰 축소
- 햅틱·사운드: 지원 환경에서 선택적으로 사용하고 설정 제공

프레임 속도에 따라 점수가 달라지지 않도록 화면 프레임이 아니라
고해상도 타임스탬프와 정규화된 궤적 시간으로 계산한다.

## 3. 점수 함수 초안

각 토스는 다음 값을 가진다.

- `release_phase`
- `initial_velocity_x`
- `initial_velocity_y`
- `apex_time`
- `ideal_contact_time`

각 스파이크는 다음 값을 가진다.

- `contact_time`
- `contact_offset`
- `device_latency_bucket`

적응 점수는 실제 토스의 `ideal_contact_time`과 스파이크 시점의
정규화된 차이로 계산한다. 기기별 지연을 완벽히 보정한다고 주장하지
않으며 QR 기기 테스트에서 허용 오차를 조정한다.

최종 점수는 클라이언트의 표시용 계산과 서버의 검증용 계산이 같은
순수 함수·테스트 벡터를 사용한다.

## 4. 데이터 모델

### PairSession

- `id`
- `invite_token_hash`
- `creator_key_hash`
- `responder_key_hash`
- `state`: awaiting_spike / awaiting_return / complete / expired
- `expires_at`

### TossSet

- `session_id`
- `owner_role`: creator / responder
- 세 개의 정규화된 토스 파라미터
- `created_at`

### SpikeSet

- `session_id`
- `owner_role`
- 세 개의 정규화된 입력
- `completed_at`

### Result

- 양방향 적응 점수
- 리듬 유사도
- 최종 호흡 점수
- 결과 문구 키
- 여름 장면 키

## 5. API 초안

- `POST /pair-sessions`
- `GET /pair-sessions/{inviteToken}`
- `POST /pair-sessions/{inviteToken}/spikes`
- `POST /pair-sessions/{inviteToken}/return-tosses`
- `GET /pair-sessions/{inviteToken}/result`

상태 전이는 서버 트랜잭션으로 한 번만 처리한다. 같은 링크를 다시
열었을 때는 진행 상태나 결과를 보여주고 공식 입력을 중복 기록하지
않는다.

## 6. 개인정보·안전

- 실명·전화번호·연락처·정확한 위치를 수집하지 않는다.
- 익명 사용자 키는 해시하여 저장한다.
- 초대 세션은 기본 30일 후 만료한다.
- 관계 결과가 의학·심리·과학적 진단이 아님을 명시한다.
- 사용자 이름 대신 선택형 별칭·색상을 사용한다.

## 7. 테스트

### 단위

- 궤적 결정성
- 점수 경계값
- 세 공 집계 방식
- 역할 교대
- 만료·중복·잘못된 상태 전이
- 결과 문구 구간

### 성능

- 320px·390px·저사양 Android
- 60Hz·120Hz 입력 차이
- 백그라운드 복귀
- 무음·진동 꺼짐

### 실환경

- Sandbox iOS·Android
- QR 배포
- 공유 딥링크 왕복
- 네트워크 지연·오프라인
- Safe Area와 닫기 버튼

## 8. 출시 산출물

- 유형 확인 증빙
- `.ait` 번들과 SHA-256
- 자체 제작 아이콘 600×600 PNG
- 썸네일 1932×828 PNG
- 세로 스크린샷 최소 3장
- 고객문의·개인정보 처리방침
- 플레이테스트 기록
- QR 테스트 기록
- 출품 문구와 제출 증빙
