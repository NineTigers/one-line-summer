# 한 줄 여름

여름 밑그림 위에 한 붓을 그리고 링크로 친구에게 토스하면, 받은
친구가 한 붓을 더해 다시 건네는 관계형 비게임 미니앱이다.

## 프로젝트 상태

| 항목 | 현재 결정 |
| --- | --- |
| 공개 이름 | `한 줄 여름` · 잠정 |
| 제품 유형 | 비게임 한 붓 공동 창작·링크 릴레이 |
| 활성 제품 기준 | `docs/PRODUCT-SPEC.md` v5.1 |
| 앱인토스 유형 | 비게임 |
| `appName` | `one-line-summer` · 콘솔 중복 확인 전 임시 |
| 공모전 | 2026년 7월 앱인토스 바이브코딩 챌린지 |
| 기획 판정 | `PASS_WITH_RISK` · 실제 사용자 공유 검증 필요 |
| 현재 산출물 | Vite 앱 + `.ait` 번들 · 실기기 미검증 |

## 한 문장 약속

> 한 붓 그리고, 링크로 토스하고, 친구가 한 붓 더해요.

## 핵심 원칙

- 한 사람은 한 번에 연속선 한 획만 보탠다.
- 캔버스의 원하는 위치에서 자유롭게 시작한다.
- 각 차례의 유일한 다음 행동은 현재 그림 링크를 친구에게 토스하는
  것이다.
- 분기 비교·이력·완성 판정·결과 저장 기능은 공개 흐름에 두지 않는다.
- 점수·타이머·성공률·보상·관계 판정은 두지 않는다.
- 공개 피드, 정확한 위치, 연락처, 사진은 P0에서 수집하지 않는다.
- 다른 출품 앱과 코드·사용자 데이터·배포를 공유하지 않는다.
- Codex 앱 자동화 기능은 사용하지 않는다.

## 실행

```bash
npm install && npm run dev
```

`http://localhost:5173/`에서 다음 흐름을 확인한다.

1. 첫 선 만들기
2. `친구에게 토스하기` 한 번으로 저장·공유하기
3. 받은 그림 위에 한 붓 더하기
4. 새 그림을 다시 토스하기

## 번들 빌드

```bash
npx ait build
```

웹 산출물은 `dist/web/`, 콘솔에 올릴 번들은 `one-line-summer.ait`이다.

## 아직 링크에 그림이 통째로 들어간다

그림 데이터는 URL과 브라우저 `localStorage`에만 있다. 웹 링크는
프래그먼트(`#d=`), 토스 딥링크는 쿼리(`?d=`)를 쓰고 앱은 양쪽을 모두
읽는다. 붓이 늘수록 링크가 길어지므로 실사용 전에 Supabase 저장으로
옮겨야 한다.

Apps in Toss의 `getAnonymousKey()`·`getTossShareLink()`·`share()`·
`Analytics`는 `src/bridge.js`에 연결돼 있으나 **토스 실기기에서 한 번도
확인하지 않았다.** 브릿지가 없으면 조용히 브라우저 공유·클립보드로
넘어간다.

## 문서

- [**인수인계**](docs/HANDOFF.md) — 새 세션은 이것부터 읽는다
- [활성 제품 명세](docs/PRODUCT-SPEC.md)
- [V5 방향 검토](docs/DIRECTION-REVIEW-V5.md)
- [기술 계획](docs/TECHNICAL-PLAN.md)
- [작업 계획](docs/WORK-PLAN.md)
- [플레이테스트 계획](docs/PLAYTEST-PLAN.md)
- [분석 계획](docs/ANALYTICS.md)
- [콘솔 등록 문안](docs/LAUNCH-TEXT.md)
- [위험과 게이트](docs/RISKS-AND-GATES.md)
- [결정 기록](docs/DECISIONS.md)
- [공식 출처](docs/OFFICIAL-SOURCES.md)
- [수동 테스트 절차](docs/TEST-SCRIPT.md)
- [밑그림 자산 기록](docs/ASSETS.md)
- [콘솔 지면 자산](store/README.md)
- [개인정보 처리방침·고객문의](site/index.html)
- [V4 약속 토스 역사 기준](docs/history/PRODUCT-SPEC-PROMISE-V4.md)

## 다음 하드 게이트

1. 콘솔 `appName` 확정과 `site/` 정책 페이지 호스팅
2. Apps in Toss 두 실기기에서 링크 생성·수신·이어 그리기
3. Supabase의 불변 그림 상태 저장
4. 다섯 그룹의 무설명 완주와 실제 재토스
5. 실제 데이터로 한 붓을 주고받는 재미 가설 확인
6. 콘솔 검수 통과와 출품 지면 자산

게이트 전에는 현재 로컬 시뮬레이션을 실기기 공유 증거로 보고하지
않는다.
