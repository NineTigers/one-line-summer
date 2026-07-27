# 한 줄 여름 인수인계

- 작성일: 2026-07-26 KST
- 작성자: 자매 프로젝트 `summer-promise`를 진행한 Claude 세션
- 대상: 이 저장소를 이어받는 새 세션

새 세션은 이 문서를 먼저 읽고, 그다음
`docs/PRODUCT-SPEC.md`(활성 기준)만 정본으로 삼는다.

## 0. 30초 요약

`한 줄 여름`은 여름 밑그림 위에 **한 붓**만 그리고 링크로 친구에게
토스하면, 받은 친구가 한 붓을 더해 다시 건네는 비게임 미니앱이다.
2026년 7월 앱인토스 바이브코딩 챌린지 출품작이다.

**Vite 앱과 `.ait` 번들은 나온다. 백엔드는 없다. 실기기 증거도 없다.**

## 1. 마감과 심사 구조

| 항목 | 내용 |
| --- | --- |
| 첫 번들 등록 마감 | **2026-07-29** (완성 마감이 아니라 등록 마감) |
| 테마 지면 노출 | 8/1 ~ 8/26 |
| 1차 심사 | **8/1~8/26 지표** |
| 최종 심사 | 테마 적합성 + 사용자 경험 |
| 상금 | 1등 300만 / 2등 150만×2 / 3등 50만×5 |
| 심사 제외 | 단순 리워드성, 주제 이탈 |

**7/29는 "첫 번들 등록"만 하면 된다.** 완성품이 아니어도 된다.
진짜 승부는 8월 지표다. 비게임 앱의 기본 활성 지표는
`7일 후 재방문`이고, 노출 알고리즘이 활성 사용자 유사군에 앱을
추천하므로 재방문 → 노출 → 재방문의 복리가 돈다.

## 2. 절대 규칙

- **비게임을 유지한다.** 게임으로 분류되면 등급분류 증빙이 필요하고
  마감 내 확보가 불가능하다. 점수·타이머·승패·순위·보상 금지.
- `모여름`은 별도 프로젝트다. 파일·기획을 섞지 않는다.
- `/Users/in9/YGGame.Co./projects/toss-summer-ready`는 기준선이므로
  수정하지 않는다.
- 로컬 시뮬레이션을 실기기 공유 증거로 보고하지 않는다.
- 검증하지 않은 재미와 완료를 과장하지 않는다.

## 3. 현재 상태

### 되는 것

Vite 앱이다. `npm install && npm run dev`로 돈다.

- 화면 4개: `homeScreen` `setupScreen` `inviteScreen` `drawScreen`
- 여름 테마 7종 (밑그림 이미지 6장 + 하얀 캔버스)
- 캔버스 어디서든 시작하는 한 붓 입력, 두 번째 붓 차단, 다시 그리기
- 링크 생성·복사, 받은 링크로 이어 그리기
- 390×844 / 320×760, reduced motion 대응
- `npx ait build` → `one-line-summer.ait` (압축 해제 23MB)
- `pushState`/`popstate` 화면 히스토리. 모든 화면에서 뒤로가기가
  앱을 종료하지 않는다
- `src/bridge.js`에 익명 키·딥링크·공유·Analytics 연결

### 안 되는 것

- **백엔드 없음.** 그림 상태를 URL(`#d=` 웹 / `?d=` 딥링크)과
  `localStorage`(`one-line-summer-nodes-v6`)에 담는다. `fetch` 호출이
  코드에 0건이다. 인코딩을 접어 12붓 최악값이 2000자 미만이지만
  (`src/link.js`, `test/link.test.mjs`), 12붓을 넘기려면 백엔드가
  필요하다.
- **SDK 실호출 미검증.** 코드는 연결했으나 토스 앱 안에서 익명 키·
  딥링크·공유·Analytics가 실제로 응답하는지 한 번도 못 봤다. 브라우저
  에서는 전부 조용히 건너뛰는 경로만 확인했다.
- **실기기 증거 없음.** 두 기기 왕복을 한 번도 못 했다.
- **사용자 증거 없음.** 플레이테스트 미실시.
- 콘솔 등록 없음. `appName`은 임시값 `one-line-summer`다.
- `site/`의 고객문의 이메일이 실제로 받는 주소인지 확인되지 않았다.
  페이지는 https://ninetigers.github.io/one-line-summer/ 에 떠 있다.

### 저장소 지도

| 경로 | 내용 |
| --- | --- |
| `docs/PRODUCT-SPEC.md` | **활성 기준 v5.1.** 이것만 정본 |
| `docs/WORK-PLAN.md` | 단계별 계획 |
| `docs/RISKS-AND-GATES.md` | 위험과 하드 게이트 |
| `docs/TECHNICAL-PLAN.md` | Supabase 스키마 초안 |
| `docs/PLAYTEST-PLAN.md` | 5그룹 검증 설계 |
| `docs/DIRECTION-REVIEW-V5.md` | 왜 이 방향인지의 근거 |
| `docs/TEST-SCRIPT.md` | 수동 테스트 절차 |
| `docs/history/`, `docs/CONCEPT-V3-*` | 폐기된 v1~v4 |
| `index.html` | Vite 진입점 |
| `src/ui/` | 화면·그리기 구현 |
| `src/bridge.js` | Apps in Toss SDK 얇은 감싸개 |
| `public/assets/` | 밑그림 6장. 번들에 들어간다 |
| `granite.config.ts` | `appName`·브랜드·권한 |
| `store/` | 콘솔 지면 자산과 재생성 스크립트 |
| `site/` | 개인정보 처리방침·고객문의. 앱 번들에 안 들어간다 |
| `docs/history/assets-v3/` | **V3 시절 자산. 출품에 쓰지 않는다** |

## 4. 다음 작업 (우선순위)

### P0 — 7/29 등록을 위한 최소 경로

7/29에 필요한 건 `.ait` 번들 하나다. 백엔드가 없어도 등록은 된다.
**등록을 백엔드 뒤로 미루지 말 것.**

1. ~~Apps in Toss SDK 연동~~ — 코드 연결 완료(2026-07-26). 실기기
   확인은 아직이다
2. ~~`.ait` 빌드~~ — `npx ait build`로 나온다
3. ~~로고·썸네일·스크린샷~~ — `store/`에 규격대로 있다.
   `./store/make-assets.sh`로 다시 만든다
4. ~~개인정보 처리방침·고객문의~~ — `site/`에 초안이 있다
5. `appName` 콘솔 중복 확인. 확정하면 `granite.config.ts`와
   `src/bridge.js`의 `APP_NAME`을 **둘 다** 바꾼다
6. ~~`site/` 호스팅~~ — https://ninetigers.github.io/one-line-summer/ 에 떠 있다.
   `site/`를 밀면 GitHub Actions가 자동 배포한다
7. `site/`의 고객문의 이메일이 실제로 받는 주소인지 확인한다
8. 콘솔 등록

### P1 — 제품이 실제로 성립하려면

5. Supabase 백엔드. 링크에 그림이 통째로 들어가는 구조는 그대로다.
   인코딩을 접어 12붓까지는 버티게 했지만 그 이상은 못 간다.
6. 두 기기 왕복 검증
7. 5그룹 플레이테스트

### 8월 지표 관점에서 비어 있는 것

현재 구조에는 **재방문 이유가 없다.** 한 붓 그리고 링크를 보내면
끝이고, 상대가 이어 그려도 원래 사람에게 알릴 방법이 없다.
1차 심사가 8월 지표인데 이게 비어 있다는 점을 제품 책임자와
반드시 상의할 것.

분석 이벤트는 `docs/ANALYTICS.md`대로 붙어 있다. 다만 재방문은
지금 구조에서 잴 수도, 만들 수도 없다. 이벤트를 더 붙여서 해결되는
문제가 아니다.

## 5. 자매 프로젝트에서 이미 확인한 것

같은 챌린지에 내는 `summer-promise`(`에어컨 켜도 돼?`)에서 실제로
검증한 내용이다. **다시 조사하지 말고 그대로 쓸 것.**

### Apps in Toss SDK

```bash
npm install @apps-in-toss/web-framework   # 설치 확인 버전 2.10.7
npx ait build                              # .ait 아티팩트 생성
```

- `granite.config.ts`에 `appName`, `brand`, `web.commands`,
  `permissions`, `outdir`을 넣는다.
- **Vite 기반이어야 한다.** 순수 정적 HTML로는 `ait build`가 안 된다.
- `getAnonymousKey`는 `@apps-in-toss/web-framework`에서 바로
  import된다. 배럴이 `@apps-in-toss/web-bridge`를 재export한다.
- 설치된 2.10.7의 반환 타입은
  `Promise<{type:'HASH',hash:string} | 'ERROR' | undefined>`다.
  **공식 문서에 적힌 `'INVALID_CATEGORY'`는 타입에 없다.** 양쪽 다
  처리하는 편이 안전하다.
- 분석은 `Analytics.screen / impression / click`.
- 그 밖에 `getTossShareLink`, `closeView`, `getOperationalEnvironment`,
  `getPlatformOS` 등이 있다.

### 함정

- **`ait build`는 `package.json`에 `devDependencies`가 없으면
  `Object.keys(undefined)`로 죽는다.** CLI 버그다. `vite`를
  `devDependencies`에 두면 해결된다.
- 브릿지는 토스 앱 안에서만 동작한다. 브라우저 개발이 막히지 않게
  SDK를 얇게 감싸고 실패 시 조용히 건너뛰게 만들 것.

### 비게임 출시 체크리스트에서 실제로 걸리는 것

- **사용자 식별자 저장 필수** → 익명 키를 받아 기기에 저장
- **모든 화면에서 뒤로가기 동작** → 화면을 감추고 보이는 방식이면
  히스토리에 항목을 직접 넣어야 한다. 안 하면 뒤로가기 한 번에 앱이
  종료된다. `pushState` + `popstate`로 처리했다.
- 공식 내비게이션 바 필수. 자체 헤더와 토스 뒤로가기 버튼을 동시에
  노출하면 안 된다. 실기기를 봐야 판단된다.
- SSR 금지(CSR/SSG만), `eval` 금지, 진입 시 자동 바텀시트 금지
- 반응 2초 이상 지연 금지

### 운영 사실

- **검수는 영업일 기준 최대 3일.** 8월 업데이트 사이클을 이 기준으로
  잡는다. 8/25~26에는 검수 재진입이 필요한 변경을 넣지 않는다.
- 번들은 압축 해제 기준 100MB 이하.

### 지면 자산 만드는 법

비트맵 원본 없이 코드로 만들 수 있다.

- SVG/HTML을 헤드리스 크롬으로 정확한 크기에서 캡처한다.
- 스크린샷은 빌드 결과물을 임시 폴더로 복사한 뒤 `localStorage`를
  미리 채우는 스크립트와 `html { zoom: 3 }`을 주입해 캡처한다.
  **제품 코드에 스크린샷용 분기를 넣지 않는다.**
- `--force-device-scale-factor`는 레이아웃 뷰포트가 어긋나 오른쪽이
  잘린다. `--window-size`를 최종 크기로 주고 CSS `zoom`을 쓴다.
- `scrollIntoView`는 zoom과 충돌한다. 스크롤 대신 표시할 내용의
  양을 조절해 원하는 영역을 화면에 담는다.

## 6. 알려진 문서 드리프트

2026-07-27에 아래를 정리했다. 남은 것만 적는다.

- ~~`docs/WORK-PLAN.md` 완료 목록~~ 정정함.
- ~~`docs/RISKS-AND-GATES.md` G1·G4~~ 정정함. 제거된 분기 기능을
  완료로 체크하고 있었다.
- ~~`docs/ANALYTICS.md`~~ 다시 씀. 대표 전환이
  `summer_branch_created`였는데, 분기는 v5.1에서 빠진 기능이라 영원히
  발생하지 않는 이벤트였다.
- ~~`store/`의 V3 PNG~~ `docs/history/assets-v3/`로 옮김.
- `docs/TECHNICAL-PLAN.md`는 Supabase 스키마 초안이고 분기 저장을
  전제한다. 백엔드를 실제로 붙일 때 v5.1 기준으로 다시 봐야 한다.
- `docs/PLAYTEST-PLAN.md`도 분기 비교 과업이 남아 있을 수 있다.
  5그룹 테스트를 돌리기 전에 확인할 것.
- `docs/INQUIRY-DRAFT.md`는 발송 보류된 역사 문서다.

## 7. 과장하지 말 것

다음은 전부 **미검증**이다. 보고할 때 완료로 적지 않는다.

- 실제 기기 간 그림 동기화
- Apps in Toss 공유·익명 식별·딥링크
- Supabase 보안·동시성·만료
- 실제 사용자가 한 붓을 더하고 다시 토스하는지
- 화면 낭독기·키보드 전용 실사용
- 재미와 우승 가능성
