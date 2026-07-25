# 올여름 내가 토스할게 분석 계획

> 문서 상태: v1 타이밍 게임 분석 계획으로 대체됨. 점수·적중·라운드
> 이벤트는 수집하지 않는다. 새 이벤트는 비게임 프로토타입 구현 시
> `docs/PRODUCT-SPEC.md`의 초대장 흐름에 맞춰 정의한다.

## 핵심 지표

- 활성 지표 후보: 답토스를 받기 위한 2일 이내 재방문 또는
  `return_spike_completed`
- 대표 전환: `mutual_sync_completed`
- 보조 전환 1: `invited_spike_completed`
- 보조 전환 2: `return_toss_sent`

## 이벤트

| 이벤트 | 시점 | 핵심 속성 |
| --- | --- | --- |
| `intro_viewed` | 첫 화면 | 유입 경로 |
| `practice_completed` | 연습공 완료 | 소요 시간 |
| `toss_set_started` | 첫 공식 토스 | 역할 |
| `toss_set_completed` | 세 토스 완료 | 입력 분산·소요 시간 |
| `invite_link_created` | 공유 링크 생성 | 세션 상태 |
| `invite_landed` | B 진입 | 링크 나이 |
| `spike_set_completed` | 세 스파이크 완료 | 적중 분산·소요 시간 |
| `first_sync_viewed` | 첫 호흡 결과 | 점수 구간 |
| `return_toss_sent` | 답토스 공유 | 첫 호흡 구간 |
| `return_spike_completed` | A 재방문 완료 | 왕복 시간 |
| `mutual_sync_completed` | 최종 결과 노출 | 최종 점수·문구 키 |
| `result_shared` | 최종 카드 공유 | 여름 장면 키 |
| `session_failed` | 흐름 실패 | 단계·오류·재시도 |

## 퍼널

`toss_set_completed → invite_landed → invited_spike_completed →
return_toss_sent → return_spike_completed → mutual_sync_completed`

## 판단 기준

- 토스 완료 대비 초대 유입 40% 미만: 이름·초대 문구 재검토
- 초대 유입 대비 스파이크 완료 70% 미만: 튜토리얼·공 수 축소
- 첫 호흡 대비 답토스 전송 35% 미만: 역할 교대 보상 재설계
- 답토스 대비 원사용자 복귀 50% 미만: 알림·공유 문구 재검토
- 최종 결과 대비 공유 20% 미만: 결과 카드와 문구 재설계
- 기기별 평균 입력 오차 차이가 크면 점수 공개를 보류
