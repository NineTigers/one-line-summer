import {
  FORMAT_VERSION,
  MAX_STROKES,
  decodeArtwork,
  encodeArtwork,
  reducePoints,
} from "../link.js";
import {
  anonymousKey,
  logClick,
  logEvent,
  logScreen,
  tossShare,
  tossShareLink,
} from "../bridge.js";

const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 900;
/*
 * 그리는 동안 담아두는 점의 상한.
 *
 * 링크에 실리는 점(`MAX_POINTS`)보다 넉넉해야 한다. 여기서 막으면 선이
 * 손가락을 따라가다 멈춘다. 저장하는 순간 `reducePoints`가 줄인다.
 */
const MAX_DRAFT_POINTS = 240;
const STORAGE_KEY = "one-line-summer-nodes-v6";
const ANON_KEY_STORAGE = "one-line-summer-anon-key";
const LINK_PARAM = "d";

const PALETTES = [
  {
    id: "sea",
    background: ["#fff4c7", "#b9e8e6"],
    strokes: ["#ef6351", "#087f86", "#7455a8", "#f0a43a"],
    strokeNames: ["산호색", "바다색", "보라색", "노을색"],
  },
  {
    id: "rain",
    background: ["#e5f0f3", "#a8c6d4"],
    strokes: ["#306b8a", "#f5b34b", "#7255a8", "#2f8f83"],
    strokeNames: ["빗물색", "햇살색", "보라색", "초록색"],
  },
  {
    id: "sunset",
    background: ["#ffe0a6", "#ef9b89"],
    strokes: ["#8a4272", "#ef6351", "#0e7780", "#f7c44b"],
    strokeNames: ["자두색", "산호색", "바다색", "햇살색"],
  },
  {
    id: "night",
    background: ["#222b55", "#67558e"],
    strokes: ["#ffd461", "#73d5d2", "#ff8f82", "#f5efff"],
    strokeNames: ["별빛색", "민트색", "산호색", "달빛색"],
  },
];

const THEMES = [
  {
    id: "sunset-beach",
    name: "선셋 비치",
    note: "노을이 내려앉은 해변",
    asset: "/assets/theme-sunset-beach.jpg",
    palette: 2,
  },
  {
    id: "bingsu-shop",
    name: "여름 빙수집",
    note: "햇살을 피해 들어온 오후",
    asset: "/assets/theme-bingsu-shop.jpg",
    palette: 0,
  },
  {
    id: "blank-white",
    name: "하얀 캔버스",
    note: "아무것도 없는 자유 배경",
    asset: null,
    palette: 0,
  },
  {
    id: "han-river-picnic",
    name: "한강 피크닉",
    note: "강바람 부는 오후",
    asset: "/assets/theme-han-river-picnic.jpg",
    palette: 0,
  },
  {
    id: "green-valley",
    name: "초록 계곡",
    note: "햇살 비치는 맑은 물",
    asset: "/assets/theme-green-valley.jpg",
    palette: 0,
  },
  {
    id: "monsoon-window",
    name: "장마 창가",
    note: "빗소리 듣는 한낮",
    asset: "/assets/theme-monsoon-window.jpg",
    palette: 1,
  },
  {
    id: "summer-fireworks",
    name: "여름밤 불꽃",
    note: "강변을 수놓은 밤",
    asset: "/assets/theme-summer-fireworks.jpg",
    palette: 3,
  },
];

const THEME_DISPLAY_ORDER = [0, 1, 3, 4, 5, 6, 2];

const THEME_IMAGES = THEMES.map((theme) => {
  if (!theme.asset) return null;
  const image = new Image();
  image.decoding = "async";
  image.src = theme.asset;
  return image;
});

const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const forcedReducedMotion =
  new URLSearchParams(window.location.search).get("motion") === "reduce";

if (forcedReducedMotion) {
  document.documentElement.classList.add("reduced-motion");
}

function prefersReducedMotion() {
  return reducedMotionQuery.matches || forcedReducedMotion;
}

const screens = {
  home: document.querySelector("#homeScreen"),
  setup: document.querySelector("#setupScreen"),
  invite: document.querySelector("#inviteScreen"),
  draw: document.querySelector("#drawScreen"),
};

const canvases = {
  draw: document.querySelector("#drawCanvas"),
  invite: document.querySelector("#inviteCanvas"),
};

const state = {
  currentDoc: null,
  incoming: false,
  actor: "A",
  actorName: "나",
  palette: THEMES[0].palette,
  prompt: 0,
  strokeColor: 0,
  draftPoints: [],
  drawing: false,
  strokeCommitted: false,
  sharing: false,
  shareDoc: null,
  toastTimer: null,
};

/**
 * 지금 그림에 쌓인 붓의 수.
 *
 * 릴레이가 몇 단계까지 이어지는지가 이 제품의 핵심 질문이라, 거의
 * 모든 이벤트에 붙인다. 그림 내용은 담기지 않는다.
 */
function docDepth() {
  return state.currentDoc?.strokes.length ?? 0;
}

function randomId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function showScreen(target) {
  Object.values(screens).forEach((screen) => {
    screen.classList.toggle("hidden", screen !== target);
  });

  /*
   * 화면을 감추고 보이는 구조라, 그냥 두면 초점이 방금 사라진 요소에
   * 남는다. 키보드 사용자는 다음 Tab이 어디서 이어질지 알 수 없고,
   * 화면 낭독기는 새 화면을 읽지 않는다.
   *
   * 새 화면의 제목으로 옮긴다. 제목은 누르는 요소가 아니므로
   * `tabindex="-1"`로 초점만 받고 Tab 순서에는 들어가지 않는다.
   */
  const heading = target.querySelector("h1");
  if (heading) {
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }

  window.scrollTo({
    top: 0,
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
}

/**
 * 화면 전환과 히스토리 항목.
 *
 * 이 앱은 한 페이지에서 섹션을 감추고 보이는 방식이라 히스토리에 항목을
 * 직접 넣지 않으면 토스 안에서 뒤로가기 한 번에 앱이 종료된다. 비게임
 * 출시 체크리스트가 모든 화면에서 뒤로가기 동작을 요구한다.
 */
function navigateTo(name, push = true) {
  const entry = { screen: name };
  if (push) window.history.pushState(entry, "");
  else window.history.replaceState(entry, "");
  showScreen(screens[name]);
  logScreen(`summer_${name}_viewed`, { depth: docDepth() });
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => {
    toast.classList.add("hidden");
  }, 2200);
}

function asSafeId(value, fallback = randomId()) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.slice(0, 80);
  return /^[a-zA-Z0-9-]+$/.test(trimmed) ? trimmed : fallback;
}

function safeName(value, fallback = "여름 친구") {
  if (typeof value !== "string") return fallback;
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return clean.slice(0, 8) || fallback;
}

function sanitizePoint(point) {
  if (!Array.isArray(point) || point.length !== 2) return null;
  const x = Math.round(Number(point[0]));
  const y = Math.round(Number(point[1]));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return [
    Math.max(0, Math.min(1000, x)),
    Math.max(0, Math.min(1000, y)),
  ];
}

function sanitizeStroke(stroke, index) {
  if (!stroke || typeof stroke !== "object") return null;
  const points = Array.isArray(stroke.points)
    ? stroke.points.map(sanitizePoint).filter(Boolean)
    : [];
  if (points.length < 2) return null;
  return {
    id: asSafeId(stroke.id),
    actor: stroke.actor === "B" ? "B" : "A",
    name: safeName(stroke.name),
    color: Number.isInteger(stroke.color)
      ? Math.max(0, Math.min(3, stroke.color))
      : index % 4,
    points: reducePoints(points),
  };
}

function sanitizeDoc(doc) {
  if (!doc || typeof doc !== "object" || doc.version !== FORMAT_VERSION) {
    return null;
  }
  const id = asSafeId(doc.id);
  const rootId = asSafeId(doc.rootId, id);
  const strokes = Array.isArray(doc.strokes)
    ? doc.strokes
        .slice(0, MAX_STROKES)
        .map(sanitizeStroke)
        .filter(Boolean)
    : [];
  return {
    version: FORMAT_VERSION,
    id,
    rootId,
    parentId:
      typeof doc.parentId === "string" ? asSafeId(doc.parentId, null) : null,
    palette: Number.isInteger(doc.palette)
      ? Math.max(0, Math.min(PALETTES.length - 1, doc.palette))
      : 0,
    prompt: Number.isInteger(doc.prompt)
      ? Math.max(0, Math.min(THEMES.length - 1, doc.prompt))
      : 0,
    strokes,
    finished: false,
    createdAt: Number.isFinite(doc.createdAt) ? doc.createdAt : Date.now(),
  };
}

function compactDoc(doc) {
  return {
    version: FORMAT_VERSION,
    id: doc.id,
    rootId: doc.rootId,
    parentId: doc.parentId,
    palette: doc.palette,
    prompt: doc.prompt,
    strokes: doc.strokes,
    finished: false,
    createdAt: doc.createdAt,
  };
}

/**
 * 링크 토큰과 문서 사이의 다리.
 *
 * 링크에는 그림만 담기므로(`src/link.js` 참고) 받는 쪽에서 식별자와
 * 시각을 새로 만든다. 이름은 화면에 쓰지 않으므로 기본값을 준다.
 */
function encodeDoc(doc) {
  return encodeArtwork(doc);
}

function decodeDoc(token) {
  const artwork = decodeArtwork(token);
  if (!artwork) return null;

  const id = randomId();
  return sanitizeDoc({
    version: FORMAT_VERSION,
    id,
    rootId: id,
    parentId: null,
    palette: artwork.palette,
    prompt: artwork.prompt,
    strokes: artwork.strokes.map((stroke) => ({ ...stroke, id: randomId() })),
    finished: false,
    createdAt: Date.now(),
  });
}

/**
 * 그림 토큰을 쿼리와 프래그먼트 양쪽에서 읽는다.
 *
 * 웹 링크는 프래그먼트(`#d=`)를 쓴다. 토스 딥링크는 프래그먼트가
 * deep_link_value를 거쳐 보존된다는 보장이 없어 쿼리(`?d=`)를 쓴다.
 * 어느 쪽으로 들어와도 같은 그림이 열려야 한다.
 */
function readLinkToken() {
  return (
    new URLSearchParams(window.location.search).get(LINK_PARAM) ||
    new URLSearchParams(window.location.hash.replace(/^#/, "")).get(LINK_PARAM)
  );
}

/**
 * 링크가 잘렸거나 알아볼 수 없으면 `null`을 돌려주고 그 사실을 남긴다.
 * 부르는 쪽은 막힌 화면 대신 첫 화면을 보여준다.
 */
function readDocFromLocation() {
  const tokens = [
    new URLSearchParams(window.location.search).get(LINK_PARAM),
    new URLSearchParams(window.location.hash.replace(/^#/, "")).get(LINK_PARAM),
  ].filter(Boolean);

  for (const token of tokens) {
    const doc = decodeDoc(token);
    if (doc) return doc;
  }

  if (tokens.length) logEvent("summer_link_broken");
  return null;
}

function basePageUrl() {
  const url = new URL(window.location.href);
  url.hash = "";
  url.searchParams.delete(LINK_PARAM);
  return url.href;
}

function docLink(doc) {
  return `${basePageUrl()}#${LINK_PARAM}=${encodeDoc(doc)}`;
}

/** 주소만 바꾸고 히스토리 항목의 화면 정보는 그대로 둔다. */
function replaceLocationWithDoc(doc) {
  window.history.replaceState(window.history.state, "", docLink(doc));
}

function clearLocationDoc() {
  window.history.replaceState(window.history.state, "", basePageUrl());
}

function loadStoredNodes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizeDoc).filter(Boolean);
  } catch (error) {
    return [];
  }
}

function saveNode(doc) {
  const nodes = loadStoredNodes().filter((node) => node.id !== doc.id);
  nodes.push(compactDoc(doc));
  const ordered = nodes
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(-100);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ordered));
  } catch (error) {
    // 로컬 저장 실패가 그리기와 공유를 막지 않게 한다.
  }
}

function nextActor(doc) {
  return doc.strokes.at(-1)?.actor === "A" ? "B" : "A";
}

function createRootDoc() {
  const id = randomId();
  return {
    version: FORMAT_VERSION,
    id,
    rootId: id,
    parentId: null,
    palette: state.palette,
    prompt: state.prompt,
    strokes: [],
    finished: false,
    createdAt: Date.now(),
  };
}

function toCanvasPoint(point) {
  return [
    (point[0] / 1000) * CANVAS_WIDTH,
    (point[1] / 1000) * CANVAS_HEIGHT,
  ];
}

function drawSmoothLine(context, points, color, width = 17) {
  if (points.length < 2) return;
  const scaled = points.map(toCanvasPoint);
  context.save();
  context.beginPath();
  context.moveTo(scaled[0][0], scaled[0][1]);
  for (let index = 1; index < scaled.length - 1; index += 1) {
    const current = scaled[index];
    const next = scaled[index + 1];
    context.quadraticCurveTo(
      current[0],
      current[1],
      (current[0] + next[0]) / 2,
      (current[1] + next[1]) / 2,
    );
  }
  context.lineTo(scaled.at(-1)[0], scaled.at(-1)[1]);
  context.strokeStyle = color;
  context.lineWidth = width;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.stroke();
  context.restore();
}

function paintBackground(context, doc) {
  const palette = PALETTES[doc.palette];
  const themeIndex = Math.max(0, Math.min(THEMES.length - 1, doc.prompt));
  const theme = THEMES[themeIndex];
  const themeImage = THEME_IMAGES[themeIndex];
  const ready =
    theme.asset === null ||
    (themeImage?.complete && themeImage.naturalWidth > 0);

  if (theme.asset === null) {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  } else if (ready) {
    context.drawImage(themeImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  } else {
    const gradient = context.createLinearGradient(
      0,
      0,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
    );
    gradient.addColorStop(0, palette.background[0]);
    gradient.addColorStop(1, palette.background[1]);
    context.fillStyle = gradient;
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }
  return ready;
}

function renderArtwork(canvas, doc, options = {}) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  const backgroundReady = paintBackground(context, doc);

  if (!backgroundReady) {
    THEME_IMAGES[doc.prompt]?.addEventListener(
      "load",
      () => renderArtwork(canvas, doc, options),
      { once: true },
    );
  }

  const palette = PALETTES[doc.palette];
  doc.strokes.forEach((stroke) => {
    drawSmoothLine(context, stroke.points, palette.strokes[stroke.color]);
  });

  if (options.draftPoints?.length > 1) {
    drawSmoothLine(
      context,
      options.draftPoints,
      palette.strokes[options.draftColorIndex],
      19,
    );
  }
}

function updateThemeAction() {
  const theme = THEMES[state.prompt];
  document.querySelector("#createCanvasButton").textContent =
    `${theme.name}에 그리기`;
}

function buildThemeOptions() {
  const group = document.querySelector("#themeGroup");
  group.replaceChildren();

  THEME_DISPLAY_ORDER.forEach((index) => {
    const theme = THEMES[index];
    const label = document.createElement("label");
    label.className = "theme-option";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "theme";
    input.value = String(index);
    input.checked = index === state.prompt;
    input.setAttribute("aria-label", `${theme.name}, ${theme.note}`);
    input.addEventListener("change", () => {
      state.prompt = index;
      state.palette = theme.palette;
      updateThemeAction();
    });

    const card = document.createElement("span");
    card.className = "theme-card";

    let preview;
    if (theme.asset) {
      preview = document.createElement("img");
      preview.src = theme.asset;
      preview.alt = "";
      preview.width = CANVAS_WIDTH;
      preview.height = CANVAS_HEIGHT;
    } else {
      preview = document.createElement("span");
      preview.className = "theme-blank-preview";
      preview.setAttribute("aria-hidden", "true");
    }

    const copy = document.createElement("span");
    copy.className = "theme-copy";
    const title = document.createElement("strong");
    title.textContent = theme.name;
    copy.append(title);
    card.append(preview, copy);
    label.append(input, card);
    group.append(label);
  });

  updateThemeAction();
}

function buildColorOptions(palette) {
  const group = document.querySelector("#colorGroup");
  group.replaceChildren();

  palette.strokes.forEach((color, index) => {
    const button = document.createElement("button");
    const selected = index === state.strokeColor;
    button.type = "button";
    button.className = `color-button${selected ? " is-selected" : ""}`;
    button.style.setProperty("--pen-color", color);
    button.setAttribute("aria-label", `${palette.strokeNames[index]} 펜`);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
    button.disabled = state.strokeCommitted || state.sharing;
    button.addEventListener("click", () => {
      state.strokeColor = index;
      buildColorOptions(palette);
      renderArtwork(canvases.draw, state.currentDoc, {
        draftPoints: state.draftPoints,
        draftColorIndex: state.strokeColor,
      });
    });
    group.append(button);
  });
}

function resetShareUi() {
  document.querySelector("#shareFallback").classList.add("hidden");
  document.querySelector("#shareLink").value = "";
  document.querySelector("#copyStatus").textContent = "";
}

/** 링크에 더 실을 수 없을 만큼 붓이 찼는지. */
function isFull(doc) {
  return doc.strokes.length >= MAX_STROKES;
}

function renderInvite(push = true) {
  renderArtwork(canvases.invite, state.currentDoc);
  const hasStroke = state.currentDoc.strokes.length > 0;
  const full = isFull(state.currentDoc);
  const eyebrow = document.querySelector("#inviteEyebrow");
  const title = document.querySelector("#inviteTitle");
  const action = document.querySelector("#acceptInviteButton");

  /*
   * 붓이 상한까지 차면 더 받을 수 없다. 그냥 두면 다음 사람이 그린 붓이
   * 화면에는 보이는데 링크에서는 잘려서, 받는 쪽에서 조용히 사라진다.
   * 그리기 전에 멈추고 다음 행동을 준다. 막힌 화면을 만들지 않는다.
   */
  if (full) {
    eyebrow.textContent = "가득 찬 그림이 도착했어요";
    title.innerHTML = "여기까지 함께 그렸어요<br />새 그림을 시작해 보세요";
    action.textContent = "새 그림 시작하기";
  } else {
    eyebrow.textContent = hasStroke
      ? "한 붓이 도착했어요"
      : "여름 배경이 도착했어요";
    title.innerHTML = hasStroke
      ? "친구가 한 붓을 보냈어요<br />원하는 곳에 한 붓을 더해요"
      : "친구가 여름 배경을 골랐어요<br />첫 한 붓을 더해요";
    action.textContent = "한 붓 더하기";
  }

  navigateTo("invite", push);
}

function renderDraw(push = true) {
  const count = state.currentDoc.strokes.length;
  const palette = PALETTES[state.currentDoc.palette];
  state.draftPoints = [];
  state.drawing = false;
  state.strokeCommitted = false;
  state.sharing = false;
  state.shareDoc = null;
  state.strokeColor = count % palette.strokes.length;

  renderArtwork(canvases.draw, state.currentDoc);
  buildColorOptions(palette);
  resetShareUi();

  document.querySelector("#drawCanvasCard").classList.remove("is-locked");
  document.querySelector("#drawEyebrow").textContent =
    THEMES[state.currentDoc.prompt].name;
  document.querySelector("#drawTitle").textContent =
    "원하는 곳에 한 붓 그려요";
  document.querySelector("#drawGuide").textContent =
    count === 0
      ? "손가락을 떼기 전까지 한 번에 그려요."
      : "친구의 그림은 그대로 두고 한 붓만 더해요.";
  document.querySelector("#undoButton").disabled = true;

  const commitButton = document.querySelector("#commitButton");
  commitButton.disabled = true;
  commitButton.textContent = "친구에게 토스하기";
  document.querySelector("#drawStatus").textContent =
    "캔버스 어디서든 시작할 수 있어요.";
  navigateTo("draw", push);
}

function beginNew() {
  state.currentDoc = null;
  state.incoming = false;
  state.actor = "A";
  state.actorName = "나";
  state.palette = THEMES[0].palette;
  state.prompt = 0;
  state.strokeColor = 0;
  state.draftPoints = [];
  buildThemeOptions();
  clearLocationDoc();
  navigateTo("setup");
}

function loadFromLocation(push = false) {
  const incomingDoc = readDocFromLocation();
  if (!incomingDoc) {
    navigateTo("home", push);
    return;
  }

  state.currentDoc = incomingDoc;
  state.incoming = true;
  state.actor = nextActor(incomingDoc);
  state.actorName = "다음 친구";
  saveNode(incomingDoc);
  renderInvite(push);
}

function eventPoint(event) {
  const rect = canvases.draw.getBoundingClientRect();
  return [
    Math.max(
      0,
      Math.min(
        1000,
        Math.round(((event.clientX - rect.left) / rect.width) * 1000),
      ),
    ),
    Math.max(
      0,
      Math.min(
        1000,
        Math.round(((event.clientY - rect.top) / rect.height) * 1000),
      ),
    ),
  ];
}

function pointDistance(first, second) {
  return Math.hypot(first[0] - second[0], first[1] - second[1]);
}

function beginStroke(event) {
  if (
    !state.currentDoc ||
    state.strokeCommitted ||
    state.sharing ||
    event.button > 0
  ) {
    return;
  }
  if (state.draftPoints.length >= 3) {
    showToast("한 번에 한 붓만 그릴 수 있어요.");
    return;
  }

  state.drawing = true;
  state.draftPoints = [eventPoint(event)];
  logEvent("summer_stroke_started", { depth: docDepth() });
  canvases.draw.setPointerCapture(event.pointerId);
  document.querySelector("#drawStatus").textContent =
    "손가락을 떼면 이 한 붓이 끝나요.";
}

function extendStroke(event) {
  if (!state.drawing) return;
  const point = eventPoint(event);
  const previous = state.draftPoints.at(-1);
  if (pointDistance(point, previous) < 8) return;

  if (state.draftPoints.length >= MAX_DRAFT_POINTS) {
    state.draftPoints[state.draftPoints.length - 1] = point;
  } else {
    state.draftPoints.push(point);
  }

  renderArtwork(canvases.draw, state.currentDoc, {
    draftPoints: state.draftPoints,
    draftColorIndex: state.strokeColor,
  });
}

function endStroke(event) {
  if (!state.drawing) return;
  state.drawing = false;
  if (canvases.draw.hasPointerCapture(event.pointerId)) {
    canvases.draw.releasePointerCapture(event.pointerId);
  }

  const ready = state.draftPoints.length >= 3;
  document.querySelector("#undoButton").disabled = !ready;
  document.querySelector("#commitButton").disabled = !ready;
  document.querySelector("#drawStatus").textContent = ready
    ? "한 붓이 준비됐어요. 친구에게 바로 토스할 수 있어요."
    : "조금 더 길게 그려주세요.";
}

function resetDraftStroke() {
  if (state.strokeCommitted || state.sharing) return;
  state.draftPoints = [];
  state.drawing = false;
  renderArtwork(canvases.draw, state.currentDoc);
  document.querySelector("#undoButton").disabled = true;
  document.querySelector("#commitButton").disabled = true;
  document.querySelector("#drawStatus").textContent =
    "캔버스 어디서든 다시 시작할 수 있어요.";
}

function commitDraftStroke() {
  if (state.draftPoints.length < 3 || !state.currentDoc) {
    return state.currentDoc;
  }

  /*
   * 마지막 방어선. 상한을 넘긴 붓은 링크에서 잘려 받는 쪽에서 사라지므로,
   * 애초에 문서에 넣지 않는다. 여기 걸리면 화면 흐름에 구멍이 있는 것이다.
   */
  if (isFull(state.currentDoc)) {
    showToast("이 그림은 더 이어 그릴 수 없어요.");
    return state.currentDoc;
  }

  const nodeId = randomId();
  const stroke = {
    id: nodeId,
    actor: state.actor,
    name: safeName(state.actorName),
    color: state.strokeColor,
    points: reducePoints(state.draftPoints),
  };
  const child = {
    ...state.currentDoc,
    id: nodeId,
    parentId: state.currentDoc.id,
    strokes: state.currentDoc.strokes.concat(stroke),
    finished: false,
    createdAt: Date.now(),
  };

  logEvent("summer_stroke_saved", { depth: child.strokes.length });
  state.currentDoc = child;
  state.shareDoc = child;
  state.draftPoints = [];
  state.strokeCommitted = true;
  saveNode(child);
  replaceLocationWithDoc(child);
  renderArtwork(canvases.draw, child);
  document.querySelector("#drawCanvasCard").classList.add("is-locked");
  document.querySelector("#undoButton").disabled = true;
  buildColorOptions(PALETTES[child.palette]);
  return child;
}

async function copyLink(link) {
  try {
    await navigator.clipboard.writeText(link);
    return true;
  } catch (error) {
    return false;
  }
}

function showShareFallback(link) {
  const fallback = document.querySelector("#shareFallback");
  document.querySelector("#shareLink").value = link;
  document.querySelector("#copyStatus").textContent =
    "링크를 길게 눌러 복사할 수도 있어요.";
  fallback.classList.remove("hidden");
  fallback.scrollIntoView({
    block: "nearest",
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
}

const SHARE_TEXT = "내 한 붓 위에 친구의 여름을 더해 주세요.";

/**
 * 링크 토스 경계.
 *
 * 토스 안이면 딥링크를 만들어 네이티브 공유 시트로 보낸다. 브릿지가 없는
 * 브라우저에서는 시스템 공유와 클립보드로 같은 흐름을 검증한다.
 * 어느 경로도 못 쓰면 링크를 직접 복사할 수 있게 `fallback`을 돌려준다.
 */
async function shareLinkWithPlatform(doc, link) {
  const deepLink = await tossShareLink(encodeDoc(doc));
  if (deepLink) {
    const result = await tossShare(`${SHARE_TEXT}\n${deepLink}`);
    if (result === "shared") return "shared";
  }

  if (typeof navigator.share === "function") {
    await navigator.share({
      title: "한 줄 여름",
      text: SHARE_TEXT,
      url: link,
    });
    return "shared";
  }

  return (await copyLink(link)) ? "copied" : "fallback";
}

function setSharingUi(sharing) {
  state.sharing = sharing;
  const button = document.querySelector("#commitButton");
  button.disabled = sharing;
  button.textContent = sharing
    ? "공유 준비 중..."
    : "친구에게 다시 토스하기";
  buildColorOptions(PALETTES[state.currentDoc.palette]);
}

async function shareArtwork(doc) {
  const link = docLink(doc);
  resetShareUi();
  setSharingUi(true);
  document.querySelector("#drawStatus").textContent =
    "공유할 앱을 준비하고 있어요.";

  try {
    const result = await shareLinkWithPlatform(doc, link);
    logEvent("summer_toss_result", { result, depth: doc.strokes.length });
    if (result === "shared") {
      showToast("공유를 마쳤어요.");
      document.querySelector("#drawStatus").textContent =
        "필요하면 같은 그림을 다시 토스할 수 있어요.";
    } else if (result === "copied") {
      showToast("링크를 복사했어요.");
      document.querySelector("#drawStatus").textContent =
        "친구에게 링크를 보내주세요.";
    } else {
      showShareFallback(link);
      document.querySelector("#drawStatus").textContent =
        "링크를 직접 복사해 친구에게 보낼 수 있어요.";
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      logEvent("summer_toss_result", {
        result: "cancelled",
        depth: doc.strokes.length,
      });
      document.querySelector("#drawStatus").textContent =
        "공유를 취소했어요. 다시 토스할 수 있어요.";
    } else if (await copyLink(link)) {
      showToast("링크를 복사했어요.");
      document.querySelector("#drawStatus").textContent =
        "친구에게 링크를 보내주세요.";
    } else {
      showShareFallback(link);
      document.querySelector("#drawStatus").textContent =
        "링크를 직접 복사해 친구에게 보낼 수 있어요.";
    }
  } finally {
    setSharingUi(false);
  }
}

async function commitAndShare() {
  if (state.sharing || !state.currentDoc) return;
  logClick("summer_toss_tapped", { depth: docDepth() });
  const doc = state.strokeCommitted
    ? state.shareDoc || state.currentDoc
    : commitDraftStroke();
  if (!doc) return;
  await shareArtwork(doc);
}

/**
 * 익명 사용자 키.
 *
 * 비게임 출시 체크리스트가 사용자 식별자 저장을 필수로 요구한다. 토스
 * 밖에서는 키를 받을 수 없고, 없어도 그리기와 링크 토스는 그대로 된다.
 * 그림·링크와 함께 보내지 않고 기기에만 둔다.
 */
async function ensureAnonymousKey() {
  try {
    if (localStorage.getItem(ANON_KEY_STORAGE)) return;
  } catch {
    return; // 저장소를 못 쓰면 식별자도 남기지 않는다.
  }

  const result = await anonymousKey();
  if (result.status !== "ok") return;

  try {
    localStorage.setItem(ANON_KEY_STORAGE, result.hash);
  } catch {
    // 저장 실패가 제품을 막지 않는다.
  }
}

/** 뒤로가기로 돌아온 화면을 히스토리 항목을 늘리지 않고 되살린다. */
function restoreScreen(name) {
  if (name === "setup") {
    buildThemeOptions();
    navigateTo("setup", false);
    return;
  }
  if (name === "draw" && state.currentDoc) {
    renderDraw(false);
    return;
  }
  if (name === "invite" && state.currentDoc) {
    renderInvite(false);
    return;
  }
  navigateTo("home", false);
}

buildThemeOptions();

document.querySelector("#startButton").addEventListener("click", () => {
  logClick("summer_start_tapped");
  beginNew();
});

document.querySelector("#createCanvasButton").addEventListener("click", () => {
  logClick("summer_theme_selected", { theme_key: THEMES[state.prompt].id });
  state.actor = "A";
  state.actorName = "나";
  state.currentDoc = createRootDoc();
  saveNode(state.currentDoc);
  renderDraw();
});

document.querySelector("#acceptInviteButton").addEventListener("click", () => {
  // 가득 찬 그림은 이어 그릴 수 없다. 새 그림으로 보낸다.
  if (isFull(state.currentDoc)) {
    logClick("summer_full_restarted", { depth: docDepth() });
    beginNew();
    return;
  }

  logClick("summer_invite_accepted", { depth: docDepth() });
  state.actorName = "다음 친구";
  renderDraw();
});

canvases.draw.addEventListener("pointerdown", beginStroke);
canvases.draw.addEventListener("pointermove", extendStroke);
canvases.draw.addEventListener("pointerup", endStroke);
canvases.draw.addEventListener("pointercancel", endStroke);

document.querySelector("#undoButton").addEventListener("click", resetDraftStroke);
document
  .querySelector("#commitButton")
  .addEventListener("click", commitAndShare);

document.querySelector("#copyButton").addEventListener("click", async () => {
  const doc = state.shareDoc || state.currentDoc;
  const copied = await copyLink(docLink(doc));
  document.querySelector("#copyStatus").textContent = copied
    ? "링크를 복사했어요. 친구에게 보내주세요."
    : "링크를 길게 눌러 복사해 주세요.";
  if (copied) showToast("링크를 복사했어요.");
  else document.querySelector("#shareLink").select();
});

window.addEventListener("popstate", (event) => {
  restoreScreen(event.state?.screen);
});

// 프래그먼트가 바뀌면서 이미 히스토리 항목이 생기므로 여기서 더 넣지 않는다.
window.addEventListener("hashchange", () => loadFromLocation(false));

logEvent("summer_entry_viewed", {
  entry_type: readLinkToken() ? "shared" : "direct",
});
ensureAnonymousKey();
loadFromLocation(false);
