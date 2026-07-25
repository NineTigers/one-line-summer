# 비치 코트 이미지 세트

## 사용 목적

`올여름 내가 토스할게` 체험판에서 한낮·노을·여름밤의 감정 변화를
만드는 세로형 비치 코트 배경이다. 선수·네트·공·효과는 이미지에
포함하지 않고 DOM/CSS 레이어로 분리했다.

## 파일

- `beach-court-day.jpg`: 한낮
- `beach-court-sunset.jpg`: 노을
- `beach-court-night.jpg`: 여름밤

세 파일은 562×1000 JPEG이며 합계 약 575KB다.

## 생성 방식

OpenAI 내장 이미지 생성 도구로 한낮 원본을 만들고, 동일 구도를
유지한 조명·시간대 편집으로 노을과 여름밤을 제작했다. 생성 원본은
941×1672 PNG이며, 모바일 로딩 예산을 위해 JPEG로 축소·압축했다.

## 생성 프롬프트 원문

### 한낮

> A vivid, premium summer beach volleyball environment for a social timing
> mini-game. Vertical 9:16, polished 2.5D editorial game illustration,
> sunlit sand, turquoise ocean and deep cyan sky. Keep a clear central action
> lane. Environment only; no people, volleyball, net, court lines, text,
> logos, UI or watermark.

### 노을

> Preserve the exact midday beach composition and transform only the time of
> day into vivid golden hour: coral sun, peach and magenta sky, warm sand,
> orange-pink ocean reflections. Keep the empty central action lane and add
> no people, volleyball, net, text, logos, UI or watermark.

### 여름밤

> Preserve the exact beach composition and transform only the time of day
> into an electric summer night: indigo-to-teal sky, moon reflection,
> scattered stars, aqua wave edges and subtle coral glow. Keep the scene
> readable and add no people, volleyball, net, text, logos, UI or watermark.
