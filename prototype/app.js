const SCENES = [
  { name: "한낮의 바다", asset: "beach-court-day.jpg", tone: "day" },
  { name: "노을", asset: "beach-court-sunset.jpg", tone: "sunset" },
  { name: "여름밤", asset: "beach-court-night.jpg", tone: "night" },
];

const ROLES = [
  "장소 찾기",
  "시간 맞추기",
  "준비물 챙기기",
  "간식 맡기",
  "사진 남기기",
  "길 찾기",
  "음악 고르기",
  "분위기 맡기",
];

const LINES = [
  "이번 여름은 내가 먼저 말 걸게.",
  "일단 날짜부터 같이 비워볼래?",
  "거창하지 않아도 한 장면 남기자.",
];

const DEFAULT_NAME = "여름 친구";
const NAME_LIMIT = 8;
const LINE_LIMIT = 20;
const TOSS_ANIMATION_MS = 1200;

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
  cuts: [],
  draft: { scene: null, role: null, line: null, custom: "", name: "" },
  tossTimer: null,
};

const screens = {
  receive: document.querySelector("#receiveScreen"),
  compose: document.querySelector("#composeScreen"),
  toss: document.querySelector("#tossScreen"),
  strip: document.querySelector("#stripScreen"),
};

const tossButton = document.querySelector("#tossButton");
const composeHelper = document.querySelector("#composeHelper");

/* ---------- 릴레이 상태를 링크에 담기 ---------- */

function encodeRelay(cuts) {
  const bytes = new TextEncoder().encode(JSON.stringify(cuts));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function isValidCut(cut) {
  return (
    cut &&
    Number.isInteger(cut.s) &&
    cut.s >= 0 &&
    cut.s < SCENES.length &&
    Number.isInteger(cut.r) &&
    cut.r >= 0 &&
    cut.r < ROLES.length &&
    typeof cut.n === "string" &&
    typeof cut.m === "string"
  );
}

function decodeRelay(token) {
  if (!token) return [];
  try {
    let base64 = token.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) base64 += "=";
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidCut).map((cut) => ({
      s: cut.s,
      r: cut.r,
      n: cut.n.slice(0, NAME_LIMIT),
      m: cut.m.slice(0, LINE_LIMIT),
    }));
  } catch (error) {
    return [];
  }
}

function readRelayFromLocation() {
  const hash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  return decodeRelay(params.get("r"));
}

function relayLink(cuts) {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#r=${encodeRelay(cuts)}`;
}

/* ---------- 여름 카운트다운 ---------- */

function summerDaysLeft(now = new Date()) {
  const end = new Date(now.getFullYear(), 7, 31, 23, 59, 59, 999);
  return Math.ceil((end - now) / 86400000);
}

function countdownText() {
  const days = summerDaysLeft();
  if (days > 1) return `올여름이 ${days}일 남았어요`;
  if (days === 1) return "올여름이 하루 남았어요";
  if (days === 0) return "올여름의 마지막 날이에요";
  return "올여름 기록을 마무리했어요";
}

/* ---------- 화면 전환 ---------- */

function showScreen(target) {
  Object.values(screens).forEach((screen) => {
    screen.classList.toggle("hidden", screen !== target);
  });
  window.scrollTo({
    top: 0,
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
}

/* ---------- 컷 렌더링 ---------- */

function cutName(cut) {
  return cut.n.trim() || DEFAULT_NAME;
}

function renderCut(cut, index) {
  const scene = SCENES[cut.s];
  const panel = document.createElement("article");
  panel.className = `cut-card tone-${scene.tone}`;
  panel.style.backgroundImage = `url("./assets/${scene.asset}")`;

  const order = document.createElement("span");
  order.className = "cut-order";
  order.textContent = `${index + 1}번째 컷 · ${scene.name}`;

  const bubble = document.createElement("p");
  bubble.className = "cut-bubble";
  bubble.textContent = cut.m.trim() || LINES[0];

  const footer = document.createElement("p");
  footer.className = "cut-footer";
  footer.textContent = `${cutName(cut)} · ${ROLES[cut.r]}`;

  panel.append(order, bubble, footer);
  return panel;
}

/* ---------- A. 이어받기 화면 ---------- */

function renderReceiveScreen() {
  const lastCut = state.cuts[state.cuts.length - 1];
  document.querySelector("#receiveCount").textContent =
    `지금까지 ${state.cuts.length}명이 이어왔어요`;

  const holder = document.querySelector("#incomingCut");
  holder.replaceChildren(renderCut(lastCut, state.cuts.length - 1));
}

/* ---------- B. 컷 만들기 화면 ---------- */

function buildSceneOptions() {
  const group = document.querySelector("#sceneGroup");
  group.replaceChildren();

  SCENES.forEach((scene, index) => {
    const label = document.createElement("label");
    label.className = `scene-option tone-${scene.tone}`;
    label.style.backgroundImage = `url("./assets/${scene.asset}")`;

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "scene";
    input.value = String(index);
    input.setAttribute("aria-label", scene.name);
    input.addEventListener("change", () => {
      state.draft.scene = index;
      syncComposeState();
    });

    const caption = document.createElement("span");
    caption.textContent = scene.name;

    label.append(input, caption);
    group.append(label);
  });
}

function buildChoiceChips(containerId, values, name, onSelect) {
  const group = document.querySelector(containerId);
  group.replaceChildren();

  values.forEach((value, index) => {
    const label = document.createElement("label");
    label.className = "chip";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.value = String(index);
    input.setAttribute("aria-label", value);
    input.addEventListener("change", () => {
      onSelect(index);
      syncComposeState();
    });

    const caption = document.createElement("span");
    caption.textContent = value;

    label.append(input, caption);
    group.append(label);
  });
}

function draftMessage() {
  const custom = state.draft.custom.trim();
  if (custom) return custom.slice(0, LINE_LIMIT);
  if (state.draft.line !== null) return LINES[state.draft.line];
  return "";
}

function syncComposeState() {
  const ready = state.draft.scene !== null && state.draft.role !== null;
  tossButton.disabled = !ready;
  composeHelper.textContent = ready
    ? "언제 눌러도 괜찮아요. 시간 제한은 없어요."
    : "장면과 맡을 것을 고르면 토스할 수 있어요.";
}

function renderComposeScreen() {
  const isFirst = state.cuts.length === 0;
  document.querySelector("#composeEyebrow").textContent = isFirst
    ? "2026 여름"
    : `${state.cuts.length + 1}번째 컷`;
  document.querySelector("#composeTitle").innerHTML = isFirst
    ? "이번 여름,<br />어떤 장면이 좋아요?"
    : "내 컷을 보태<br />다음 사람에게 넘겨요";
  syncComposeState();
}

/* ---------- C. 토스 연출 ---------- */

function playTossTransition(onDone) {
  const stage = document.querySelector("#tossStage");
  document.querySelector("#tossMessage").textContent = "공이 날아가는 중";
  showScreen(screens.toss);

  if (prefersReducedMotion()) {
    onDone();
    return;
  }

  stage.classList.remove("is-flying");
  void stage.offsetWidth;
  stage.classList.add("is-flying");

  window.clearTimeout(state.tossTimer);
  state.tossTimer = window.setTimeout(() => {
    stage.classList.remove("is-flying");
    onDone();
  }, TOSS_ANIMATION_MS);
}

/* ---------- D. 릴레이 화면 ---------- */

function renderStripScreen() {
  document.querySelector("#countdown").textContent = countdownText();
  document.querySelector("#stripCount").textContent =
    `${state.cuts.length}명이 이어온 여름`;

  const list = document.querySelector("#stripList");
  list.replaceChildren();
  state.cuts.forEach((cut, index) => {
    if (index > 0) {
      const link = document.createElement("div");
      link.className = "strip-link";
      link.setAttribute("aria-hidden", "true");
      list.append(link);
    }
    list.append(renderCut(cut, index));
  });

  const names = state.cuts.map(cutName);
  document.querySelector("#posterHeadline").textContent =
    `우리 ${state.cuts.length}명의 2026 여름`;
  document.querySelector("#posterNames").textContent = names.join(" → ");

  document.querySelector("#shareLink").value = relayLink(state.cuts);
  document.querySelector("#shareBox").classList.add("hidden");
  document.querySelector("#copyStatus").textContent = "";
}

/* ---------- 흐름 ---------- */

function resetDraft() {
  state.draft = { scene: null, role: null, line: null, custom: "", name: "" };
  document
    .querySelectorAll("#composeScreen input[type='radio']")
    .forEach((input) => {
      input.checked = false;
    });
  document.querySelector("#customLine").value = "";
  document.querySelector("#nameInput").value = "";
}

function commitCut() {
  state.cuts = state.cuts.concat({
    s: state.draft.scene,
    r: state.draft.role,
    n: state.draft.name.trim().slice(0, NAME_LIMIT),
    m: draftMessage(),
  });

  window.history.replaceState(null, "", `#r=${encodeRelay(state.cuts)}`);
  resetDraft();

  playTossTransition(() => {
    renderStripScreen();
    showScreen(screens.strip);
  });
}

function startFromLocation() {
  state.cuts = readRelayFromLocation();

  if (state.cuts.length > 0) {
    renderReceiveScreen();
    showScreen(screens.receive);
    return;
  }

  renderComposeScreen();
  showScreen(screens.compose);
}

function startNewRelay() {
  window.clearTimeout(state.tossTimer);
  state.cuts = [];
  resetDraft();
  window.history.replaceState(null, "", window.location.pathname);
  renderComposeScreen();
  showScreen(screens.compose);
}

/* ---------- 이벤트 ---------- */

buildSceneOptions();
buildChoiceChips("#roleGroup", ROLES, "role", (index) => {
  state.draft.role = index;
});
buildChoiceChips("#lineGroup", LINES, "line", (index) => {
  state.draft.line = index;
});

document.querySelector("#customLine").addEventListener("input", (event) => {
  state.draft.custom = event.target.value;
});

document.querySelector("#nameInput").addEventListener("input", (event) => {
  state.draft.name = event.target.value;
});

document.querySelector("#continueButton").addEventListener("click", () => {
  renderComposeScreen();
  showScreen(screens.compose);
});

document
  .querySelector("#viewStripFromReceive")
  .addEventListener("click", () => {
    renderStripScreen();
    showScreen(screens.strip);
  });

tossButton.addEventListener("click", () => {
  if (tossButton.disabled) return;
  commitCut();
});

document.querySelector("#shareButton").addEventListener("click", async () => {
  const link = relayLink(state.cuts);
  const shareBox = document.querySelector("#shareBox");

  if (navigator.share) {
    try {
      await navigator.share({
        title: "올여름 내가 토스할게",
        text: "여름 한 컷을 토스할게. 네 컷도 이어줘.",
        url: link,
      });
      return;
    } catch (error) {
      /* 공유를 취소하면 링크 상자를 대신 보여준다 */
    }
  }

  shareBox.classList.remove("hidden");
  document.querySelector("#shareLink").select();
});

document.querySelector("#copyButton").addEventListener("click", async () => {
  const status = document.querySelector("#copyStatus");
  try {
    await navigator.clipboard.writeText(relayLink(state.cuts));
    status.textContent = "링크를 복사했어요.";
  } catch (error) {
    document.querySelector("#shareLink").select();
    status.textContent = "링크를 길게 눌러 복사해 주세요.";
  }
});

document.querySelector("#newRelayButton").addEventListener("click", startNewRelay);
document.querySelector("#restartButton").addEventListener("click", startNewRelay);

startFromLocation();
