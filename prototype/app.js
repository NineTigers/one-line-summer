const sceneNames = ["한낮", "노을", "여름밤"];
const sceneClasses = ["day", "sunset", "night"];
const IDEAL_CONTACT = 0.82;
const TOSS_CYCLE_MS = 1900;
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const forcedReducedMotion =
  new URLSearchParams(window.location.search).get("motion") === "reduce";

if (forcedReducedMotion) {
  document.documentElement.classList.add("reduced-motion");
}

function prefersReducedMotion() {
  return reducedMotionQuery.matches || forcedReducedMotion;
}

const state = {
  creator: "나",
  partner: "친구",
  mode: null,
  actor: null,
  direction: null,
  round: 0,
  animationFrame: null,
  runVersion: 0,
  roundStartedAt: 0,
  inputLocked: false,
  handoffAction: null,
  forwardTosses: [],
  forwardSpikes: [],
  returnTosses: [],
  returnSpikes: [],
};

const screens = {
  intro: document.querySelector("#introScreen"),
  handoff: document.querySelector("#handoffScreen"),
  play: document.querySelector("#playScreen"),
  firstResult: document.querySelector("#firstResultScreen"),
  finalResult: document.querySelector("#finalResultScreen"),
};

const playScreen = screens.play;
const court = document.querySelector("#court");
const gameBall = document.querySelector("#gameBall");
const ballShadow = document.querySelector("#ballShadow");
const actionButton = document.querySelector("#actionButton");
const feedback = document.querySelector("#feedback");
const impact = document.querySelector("#impact");
const impactWord = document.querySelector("#impactWord");
const particleField = document.querySelector("#particleField");

[
  "./assets/comic-cover.jpg",
  "./assets/comic-toss-play.jpg",
  "./assets/comic-spike-play.jpg",
  "./assets/comic-finale.jpg",
].forEach((source) => {
  const image = new Image();
  image.src = source;
});

function showScreen(target) {
  Object.values(screens).forEach((screen) => {
    screen.classList.toggle("hidden", screen !== target);
  });
  window.scrollTo({
    top: 0,
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
}

function stopAnimation() {
  if (state.animationFrame !== null) {
    cancelAnimationFrame(state.animationFrame);
    state.animationFrame = null;
  }
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function scheduleForCurrentRun(callback, delay) {
  const version = state.runVersion;
  window.setTimeout(() => {
    if (version === state.runVersion) callback();
  }, delay);
}

function placeBall(left, top, rotation, scale = 1) {
  const heightRatio = clamp((68 - top) / 58, 0, 1);
  gameBall.style.left = `${left}%`;
  gameBall.style.top = `${top}%`;
  gameBall.style.transform = `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`;
  ballShadow.style.left = `${left}%`;
  ballShadow.style.opacity = `${0.16 + (1 - heightRatio) * 0.34}`;
  ballShadow.style.transform =
    `translateX(-50%) scale(${0.58 + (1 - heightRatio) * 0.56})`;
}

function setScene(round) {
  sceneClasses.forEach((className) => playScreen.classList.remove(className));
  playScreen.classList.add(sceneClasses[round]);
  document.querySelector("#panelLabel").textContent =
    `${round + 1}컷 · ${sceneNames[round]}`;
  document.querySelector("#roundLabel").textContent = `${round + 1} / 3`;
}

function renderRoundDots() {
  const roundDots = document.querySelector("#roundDots");
  roundDots.setAttribute(
    "aria-label",
    `공 진행 상태: 3개 중 ${state.round + 1}번째`,
  );
  roundDots.innerHTML = [0, 1, 2]
    .map(
      (index) =>
        `<span class="round-dot ${
          index < state.round ? "done" : index === state.round ? "active" : ""
        }"></span>`,
    )
    .join("");
}

function showFeedback(message) {
  feedback.textContent = message;
  feedback.classList.add("show");
  window.setTimeout(() => {
    feedback.classList.remove("show");
    feedback.textContent = "";
  }, 650);
}

function showImpact(word = "정타!") {
  const left = Number.parseFloat(gameBall.style.left) || 50;
  const top = Number.parseFloat(gameBall.style.top) || 38;

  impact.classList.remove("show");
  court.classList.remove("is-impact");
  void impact.offsetWidth;
  court.style.setProperty("--impact-left", `${left}%`);
  court.style.setProperty("--impact-top", `${top}%`);
  impact.style.left = `${left}%`;
  impact.style.top = `${top}%`;
  impact.classList.add("show");
  court.classList.add("is-impact");
  showImpactWord(word, left, top + 12);
  emitContactParticles(left, top);

  window.setTimeout(() => {
    court.classList.remove("is-impact");
  }, 540);
}

function showImpactWord(message, left = 50, top = 22) {
  impactWord.textContent = message;
  impactWord.style.left = `${left}%`;
  impactWord.style.top = `${top}%`;
  impactWord.classList.remove("show");
  void impactWord.offsetWidth;
  impactWord.classList.add("show");
  window.setTimeout(() => impactWord.classList.remove("show"), 720);
}

function emitContactParticles(left, top) {
  if (prefersReducedMotion()) return;

  const colors = ["#fff5ba", "#ffcf57", "#ff7c68", "#71e4ec"];
  particleField.replaceChildren();

  Array.from({ length: 14 }, (_, index) => {
    const particle = document.createElement("i");
    const angle = (Math.PI * 2 * index) / 14;
    const distance = 38 + (index % 4) * 13;
    particle.style.left = `${left}%`;
    particle.style.top = `${top}%`;
    particle.style.setProperty("--particle-x", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--particle-y", `${Math.sin(angle) * distance}px`);
    particle.style.setProperty("--particle-r", `${120 + index * 31}deg`);
    particle.style.setProperty(
      "--particle-color",
      colors[index % colors.length],
    );
    particleField.append(particle);
  });

  window.setTimeout(() => particleField.replaceChildren(), 720);
}

function showHandoff({ eyebrow, title, description, button, action }) {
  stopAnimation();
  state.handoffAction = action;
  document.querySelector("#handoffEyebrow").textContent = eyebrow;
  document.querySelector("#handoffTitle").textContent = title;
  document.querySelector("#handoffDescription").textContent = description;
  document.querySelector("#handoffButton").textContent = button;
  showScreen(screens.handoff);
}

function preparePlayScreen(mode, actor) {
  state.mode = mode;
  state.actor = actor;
  state.round = 0;
  state.inputLocked = false;
  setScene(0);
  renderRoundDots();
  showScreen(screens.play);

  const isToss = mode === "toss";
  playScreen.classList.toggle("toss-mode", isToss);
  playScreen.classList.toggle("spike-mode", !isToss);
  document.querySelector("#playTitle").textContent = isToss
    ? `${actor}, 공을 올려주세요`
    : `${actor}, 공을 받아주세요`;
  document.querySelector("#panelKicker").textContent = isToss
    ? "CHAPTER 1 · TOSS"
    : "CHAPTER 2 · SPIKE";
  document.querySelector("#speechBubble").textContent = isToss
    ? "내 박자를 기억해!"
    : "이번엔 내가 받을게!";
  document.querySelector("#playInstruction").textContent = isToss
    ? "공이 손에 들어온다고 느껴질 때 눌러 나만의 궤적을 만들어요."
    : "상대가 만든 실제 궤적이에요. 가장 잘 맞는 순간 한 번만 눌러요.";
  document.querySelector("#actionHelper").textContent = isToss
    ? "정답 게이지는 없어요. 내 자연스러운 박자를 기록해요."
    : "조금 빗맞아도 괜찮아요. 세 번의 호흡을 함께 봐요.";
  actionButton.textContent = isToss ? "지금 토스!" : "지금 스파이크!";
  startRound();
}

function currentTossTarget() {
  if (state.direction === "forward") return state.forwardTosses;
  return state.returnTosses;
}

function currentSpikeTarget() {
  if (state.direction === "forward") return state.forwardSpikes;
  return state.returnSpikes;
}

function currentIncomingToss() {
  return state.direction === "forward"
    ? state.forwardTosses[state.round]
    : state.returnTosses[state.round];
}

function startRound() {
  stopAnimation();
  state.inputLocked = false;
  actionButton.disabled = false;
  court.classList.remove("is-impact", "is-launching", "is-entering");
  setScene(state.round);
  renderRoundDots();
  gameBall.style.opacity = "1";
  placeBall(state.mode === "toss" ? 57 : 24, state.mode === "toss" ? 16 : 58, 0);
  feedback.classList.remove("show");
  void court.offsetWidth;
  court.classList.add("is-entering");
  window.setTimeout(() => court.classList.remove("is-entering"), 460);

  if (state.mode === "toss") {
    startTossAnimation();
  } else {
    startSpikeAnimation();
  }
}

function startTossAnimation() {
  state.roundStartedAt = performance.now();

  if (prefersReducedMotion()) {
    placeBall(57, 16, 180);
    return;
  }

  const animate = (now) => {
    const cycle = ((now - state.roundStartedAt) % TOSS_CYCLE_MS) / TOSS_CYCLE_MS;
    const depth = 0.5 - 0.5 * Math.cos(cycle * Math.PI * 2);
    const top = 7 + depth * 9;
    const sway = Math.sin(cycle * Math.PI * 2) * 1.5;
    placeBall(57 + sway, top, cycle * 360, 0.97 + depth * 0.05);
    state.animationFrame = requestAnimationFrame(animate);
  };

  state.animationFrame = requestAnimationFrame(animate);
}

function recordToss() {
  if (state.inputLocked) return;
  state.inputLocked = true;
  actionButton.disabled = true;
  const elapsed = performance.now() - state.roundStartedAt;
  const phase = prefersReducedMotion()
    ? 0.5
    : (elapsed % TOSS_CYCLE_MS) / TOSS_CYCLE_MS;
  const depth = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
  const duration = Math.round(980 + (1 - depth) * 520);
  const arcHeight = Math.round(34 + (1 - depth) * 24);

  currentTossTarget().push({
    phase: Number(phase.toFixed(4)),
    depth: Number(depth.toFixed(4)),
    duration,
    arcHeight,
  });

  stopAnimation();
  court.classList.add("is-launching");
  showImpactWord("토스!", 58, 20);
  showFeedback(depth > 0.78 ? "빠르고 낮은 토스!" : depth > 0.45 ? "편안한 토스!" : "높고 긴 토스!");
  previewToss({ duration, arcHeight });
  window.setTimeout(() => court.classList.remove("is-launching"), 540);
  scheduleForCurrentRun(advanceRound, 650);
}

function previewToss(toss) {
  const started = performance.now();
  const previewDuration = 560;
  const startLeft = Number.parseFloat(gameBall.style.left) || 55;
  const startTop = Number.parseFloat(gameBall.style.top) || 30;

  if (prefersReducedMotion()) {
    placeBall(startLeft + 24, startTop + 7, 280);
    return;
  }

  const animate = (now) => {
    const progress = clamp((now - started) / previewDuration, 0, 1);
    const top =
      startTop - toss.arcHeight * 0.95 * 4 * progress * (1 - progress) +
      progress * 7;
    const left = startLeft + progress * 24;
    placeBall(left, top, progress * 280, 1 + Math.sin(progress * Math.PI) * 0.08);
    if (progress < 1) state.animationFrame = requestAnimationFrame(animate);
  };

  state.animationFrame = requestAnimationFrame(animate);
}

function spikePosition(toss, progress) {
  const bounded = clamp(progress, 0, 1.08);
  if (bounded <= IDEAL_CONTACT) {
    const approach = bounded / IDEAL_CONTACT;
    const variableLift =
      (toss.arcHeight - 34) * 0.22 * 4 * approach * (1 - approach);
    return {
      top: 58 + (11 - 58) * approach - variableLift,
      left: 24 + (56 - 24) * approach,
    };
  }

  const overshoot = (bounded - IDEAL_CONTACT) / (1.08 - IDEAL_CONTACT);
  return {
    top: 11 + overshoot * 5,
    left: 56 + overshoot * 7,
  };
}

function startSpikeAnimation() {
  const toss = currentIncomingToss();
  state.roundStartedAt = performance.now();
  placeBall(24, 58, 0);

  if (prefersReducedMotion()) {
    const contact = spikePosition(toss, IDEAL_CONTACT);
    placeBall(contact.left, contact.top, IDEAL_CONTACT * 360, 1.06);
    return;
  }

  const animate = (now) => {
    const elapsed = now - state.roundStartedAt;
    const progress = elapsed / toss.duration;
    const bounded = clamp(progress, 0, 1.08);
    const position = spikePosition(toss, bounded);
    placeBall(
      position.left,
      position.top,
      bounded * 360,
      1 + Math.sin(bounded * Math.PI) * 0.09,
    );

    if (progress >= 1.08) {
      recordSpike(true);
      return;
    }
    state.animationFrame = requestAnimationFrame(animate);
  };

  state.animationFrame = requestAnimationFrame(animate);
}

function recordSpike(autoMiss = false) {
  if (state.inputLocked) return;
  state.inputLocked = true;
  actionButton.disabled = true;
  const toss = currentIncomingToss();
  const elapsed = performance.now() - state.roundStartedAt;
  const progress = autoMiss
    ? 1.08
    : prefersReducedMotion()
      ? IDEAL_CONTACT
      : elapsed / toss.duration;
  const deviation = Math.abs(progress - IDEAL_CONTACT);
  const score = Math.round(clamp(100 - deviation * 190, 25, 100));

  currentSpikeTarget().push({
    progress: Number(progress.toFixed(4)),
    deviation: Number(deviation.toFixed(4)),
    score,
  });

  stopAnimation();
  showImpact(autoMiss ? "아차!" : score >= 88 ? "정타!" : "받았다!");

  let message = "정타! 서로의 박자가 통했어요";
  if (autoMiss) message = "공이 지나갔어요. 다음 공에서 만나요";
  else if (progress < IDEAL_CONTACT - 0.12) message = "조금 빨랐어요";
  else if (progress > IDEAL_CONTACT + 0.12) message = "조금 늦었어요";
  else if (score < 88) message = "좋아요, 공을 살렸어요";
  showFeedback(message);

  const started = performance.now();
  const startLeft = Number.parseFloat(gameBall.style.left);
  const startTop = Number.parseFloat(gameBall.style.top);

  if (prefersReducedMotion()) {
    placeBall(startLeft + 42, startTop + 62, 430, 0.75);
    scheduleForCurrentRun(advanceRound, 680);
    return;
  }

  const animateHit = (now) => {
    const p = clamp((now - started) / 430, 0, 1);
    placeBall(
      startLeft + p * 42,
      startTop + p * 62,
      p * 430,
      1 - p * 0.25,
    );
    if (p < 1) state.animationFrame = requestAnimationFrame(animateHit);
  };
  state.animationFrame = requestAnimationFrame(animateHit);
  scheduleForCurrentRun(advanceRound, 680);
}

function advanceRound() {
  stopAnimation();
  state.round += 1;
  if (state.round < 3) {
    startRound();
    return;
  }
  finishSet();
}

function setScore(spikes) {
  return Math.round(average(spikes.map((item) => item.score)));
}

function finishSet() {
  if (state.mode === "toss" && state.direction === "forward") {
    showHandoff({
      eyebrow: `${state.creator}님의 토스가 준비됐어요`,
      title: `${state.partner}님에게 건네주세요`,
      description: "상대가 만든 세 개의 실제 궤적을 한 번씩 받아칠 차례예요.",
      button: "기기를 받았어요",
      action: () => preparePlayScreen("spike", state.partner),
    });
    return;
  }

  if (state.mode === "spike" && state.direction === "forward") {
    renderFirstResult();
    showScreen(screens.firstResult);
    return;
  }

  if (state.mode === "toss" && state.direction === "return") {
    showHandoff({
      eyebrow: `${state.partner}님의 답토스가 준비됐어요`,
      title: `${state.creator}님에게 돌려주세요`,
      description: "이번에는 처음 공을 보낸 사람이 상대의 리듬을 받아줄 차례예요.",
      button: "다시 받았어요",
      action: () => preparePlayScreen("spike", state.creator),
    });
    return;
  }

  renderFinalResult();
  showScreen(screens.finalResult);
}

function renderFirstResult() {
  const score = setScore(state.forwardSpikes);
  const cleanHits = state.forwardSpikes.filter((item) => item.score >= 88).length;
  document.querySelector("#firstScore").textContent = `${score}점`;
  document.querySelector("#firstResultCopy").textContent =
    cleanHits >= 2
      ? `${state.partner}님이 ${state.creator}님의 공을 빠르게 읽었어요.`
      : `${state.partner}님이 서로 다른 높이의 공 세 개를 끝까지 받아줬어요.`;
}

function rhythmSimilarity() {
  const scores = state.forwardTosses.map((toss, index) => {
    const other = state.returnTosses[index];
    const rawDifference = Math.abs(toss.phase - other.phase);
    const circularDifference = Math.min(rawDifference, 1 - rawDifference);
    return clamp(100 - circularDifference * 180, 25, 100);
  });
  return Math.round(average(scores));
}

function finalResult() {
  const forward = setScore(state.forwardSpikes);
  const reverse = setScore(state.returnSpikes);
  const rhythm = rhythmSimilarity();
  const score = Math.round(forward * 0.4 + reverse * 0.4 + rhythm * 0.2);
  return { forward, reverse, rhythm, score };
}

function finalCopy(score) {
  if (score >= 92) {
    return {
      title: "말 안 해도 박자가 통하는 사이",
      scene: "생각난 순간 바로 떠나는 한여름 물놀이가 어울려요.",
    };
  }
  if (score >= 82) {
    return {
      title: "몇 번만 주고받으면 찰떡",
      scene: "서로 기다려주는 노을 피크닉 같은 호흡이에요.",
    };
  }
  if (score >= 68) {
    return {
      title: "다른 박자도 재미있게 받는 사이",
      scene: "계획과 즉흥이 함께 있는 여름밤 산책이 어울려요.",
    };
  }
  return {
    title: "다음 토스에서 반전할 사이",
    scene: "서로 다른 리듬 덕분에 예상 밖의 여름 장면이 생겼어요.",
  };
}

function renderFinalResult() {
  const result = finalResult();
  const copy = finalCopy(result.score);
  const creatorClean = state.returnSpikes.filter((item) => item.score >= 88).length;
  const partnerClean = state.forwardSpikes.filter((item) => item.score >= 88).length;

  document.querySelector("#finalPairName").textContent =
    `${state.creator} × ${state.partner}`;
  document.querySelector("#finalScore").textContent = `${result.score}점`;
  document.querySelector("#finalTitle").textContent = copy.title;
  document.querySelector("#finalScene").textContent = copy.scene;
  document.querySelector("#evidenceCard").innerHTML = `
    <strong>이 점수는 이렇게 나왔어요</strong>
    ${state.partner}님은 ${state.creator}님의 공 ${partnerClean}개를 정타로,
    ${state.creator}님은 ${state.partner}님의 공 ${creatorClean}개를 정타로
    받아줬어요. 두 사람의 자연스러운 토스 박자는 ${result.rhythm}점만큼
    비슷했어요.
  `;
}

function resetGame() {
  stopAnimation();
  state.runVersion += 1;
  court.classList.remove("is-impact", "is-launching", "is-entering");
  impactWord.classList.remove("show");
  playScreen.classList.remove("toss-mode", "spike-mode");
  particleField.replaceChildren();
  state.mode = null;
  state.actor = null;
  state.direction = null;
  state.round = 0;
  state.inputLocked = false;
  state.forwardTosses = [];
  state.forwardSpikes = [];
  state.returnTosses = [];
  state.returnSpikes = [];
  showScreen(screens.intro);
}

document.querySelector("#startButton").addEventListener("click", () => {
  state.creator = document.querySelector("#creatorName").value.trim() || "나";
  state.partner = document.querySelector("#partnerName").value.trim() || "친구";
  state.direction = "forward";
  showHandoff({
    eyebrow: "첫 번째 토스",
    title: `${state.creator}님부터 시작해요`,
    description: "세 번의 자연스러운 타이밍으로 상대에게 보낼 공을 만들어요.",
    button: "내가 토스할게",
    action: () => preparePlayScreen("toss", state.creator),
  });
});

document.querySelector("#handoffButton").addEventListener("click", () => {
  if (state.handoffAction) state.handoffAction();
});

actionButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  if (state.mode === "toss") recordToss();
  else recordSpike(false);
});

actionButton.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  if (state.mode === "toss") recordToss();
  else recordSpike(false);
});

document.querySelector("#returnTossButton").addEventListener("click", () => {
  state.direction = "return";
  preparePlayScreen("toss", state.partner);
});

document.querySelector("#playAgainButton").addEventListener("click", resetGame);
document.querySelector("#resetButton").addEventListener("click", resetGame);

document.addEventListener("visibilitychange", () => {
  if (document.hidden && !screens.play.classList.contains("hidden")) {
    stopAnimation();
    state.inputLocked = true;
    actionButton.disabled = true;
    showFeedback("화면으로 돌아오면 이 공을 다시 시작해요");
  } else if (!document.hidden && !screens.play.classList.contains("hidden")) {
    scheduleForCurrentRun(startRound, 250);
  }
});
