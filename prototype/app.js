const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 900;
const FORMAT_VERSION = 5;
const MAX_STROKES = 12;
const MAX_POINTS = 84;
const NAME_LIMIT = 8;
const STORAGE_KEY = "one-line-summer-nodes-v5";
const LINK_PARAM = "d";

const PALETTES = [
  {
    id: "sea",
    name: "바다빛",
    note: "소금기와 햇살",
    background: ["#fff4c7", "#b9e8e6"],
    strokes: ["#ef6351", "#087f86", "#7455a8", "#f0a43a"],
  },
  {
    id: "rain",
    name: "소나기빛",
    note: "비 냄새와 물웅덩이",
    background: ["#e5f0f3", "#a8c6d4"],
    strokes: ["#306b8a", "#f5b34b", "#7255a8", "#2f8f83"],
  },
  {
    id: "sunset",
    name: "노을빛",
    note: "긴 그림자와 저녁",
    background: ["#ffe0a6", "#ef9b89"],
    strokes: ["#8a4272", "#ef6351", "#0e7780", "#f7c44b"],
  },
  {
    id: "night",
    name: "여름밤빛",
    note: "늦은 바람과 불빛",
    background: ["#222b55", "#67558e"],
    strokes: ["#ffd461", "#73d5d2", "#ff8f82", "#f5efff"],
    dark: true,
  },
];

const THEMES = [
  {
    id: "sunset-beach",
    name: "선셋 비치",
    note: "노을이 내려앉은 해변",
    asset: "./assets/theme-sunset-beach.jpg",
    palette: 2,
    seed: [205, 190],
  },
  {
    id: "bingsu-shop",
    name: "여름 빙수집",
    note: "햇살을 피해 들어온 오후",
    asset: "./assets/theme-bingsu-shop.jpg",
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
    asset: "./assets/theme-han-river-picnic.jpg",
    palette: 0,
  },
  {
    id: "green-valley",
    name: "초록 계곡",
    note: "햇살 비치는 맑은 물",
    asset: "./assets/theme-green-valley.jpg",
    palette: 0,
  },
  {
    id: "monsoon-window",
    name: "장마 창가",
    note: "빗소리 듣는 한낮",
    asset: "./assets/theme-monsoon-window.jpg",
    palette: 1,
  },
  {
    id: "summer-fireworks",
    name: "여름밤 불꽃",
    note: "강변을 수놓은 밤",
    asset: "./assets/theme-summer-fireworks.jpg",
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
  handoff: document.querySelector("#handoffScreen"),
};

const canvases = {
  draw: document.querySelector("#drawCanvas"),
  invite: document.querySelector("#inviteCanvas"),
  handoff: document.querySelector("#handoffCanvas"),
};

const state = {
  currentDoc: null,
  incoming: false,
  actor: "A",
  actorName: "여름 친구",
  names: { A: "", B: "" },
  palette: THEMES[0].palette,
  prompt: 0,
  strokeColor: 0,
  draftPoints: [],
  drawing: false,
  selectedHistoryCount: 0,
  selectedHistoryDoc: null,
  compareReturnToHistory: false,
  replayTimer: null,
  toastTimer: null,
  shareDoc: null,
};

function randomId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function showScreen(target) {
  Object.values(screens).forEach((screen) => {
    screen.classList.toggle("hidden", screen !== target);
  });
  const shell = document.querySelector(".app-shell");
  shell.scrollTop = 0;
  window.scrollTo({
    top: 0,
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
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
  return clean.slice(0, NAME_LIMIT) || fallback;
}

function hasBatchim(value) {
  const last = [...String(value).trim()].at(-1);
  if (!last) return false;
  const code = last.charCodeAt(0);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
}

function withParticle(value, batchimParticle, noBatchimParticle) {
  return `${value}${hasBatchim(value) ? batchimParticle : noBatchimParticle}`;
}

function joinNames(names) {
  if (names.length < 2) return names[0] || "두 사람";
  const head = names.slice(0, -1).join(", ");
  return `${withParticle(head, "과", "와")} ${names.at(-1)}`;
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
    ? stroke.points
        .slice(0, MAX_POINTS)
        .map(sanitizePoint)
        .filter(Boolean)
    : [];
  if (points.length < 2) return null;
  return {
    id: asSafeId(stroke.id),
    actor: stroke.actor === "B" ? "B" : "A",
    name: safeName(stroke.name),
    color: Number.isInteger(stroke.color)
      ? Math.max(0, Math.min(3, stroke.color))
      : index % 4,
    points,
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
    finished: Boolean(doc.finished),
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
    finished: doc.finished,
    createdAt: doc.createdAt,
  };
}

function encodeDoc(doc) {
  const bytes = new TextEncoder().encode(JSON.stringify(compactDoc(doc)));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodeDoc(token) {
  if (!token) return null;
  try {
    let base64 = token.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) base64 += "=";
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );
    return sanitizeDoc(JSON.parse(new TextDecoder().decode(bytes)));
  } catch (error) {
    return null;
  }
}

function readDocFromLocation() {
  const hash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  return decodeDoc(params.get(LINK_PARAM));
}

function docLink(doc) {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#${LINK_PARAM}=${encodeDoc(doc)}`;
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
    /* 로컬 저장 실패가 그리기 자체를 막지 않게 한다 */
  }
}

function nodesForRoot(rootId) {
  return loadStoredNodes().filter((node) => node.rootId === rootId);
}

function nextActor(doc) {
  const lastStroke = doc.strokes[doc.strokes.length - 1];
  return lastStroke?.actor === "A" ? "B" : "A";
}

function actorNameFromDoc(doc, actor) {
  const previous = [...doc.strokes].reverse().find((stroke) => stroke.actor === actor);
  return previous?.name || (actor === "A" ? "첫 친구" : "다음 친구");
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

function docAtStrokeCount(doc, count) {
  const bounded = Math.max(0, Math.min(doc.strokes.length, count));
  const strokes = doc.strokes.slice(0, bounded);
  const id = bounded === 0 ? doc.rootId : strokes[bounded - 1].id;
  const parentId =
    bounded === 0
      ? null
      : bounded === 1
        ? doc.rootId
        : strokes[bounded - 2].id;
  return {
    ...doc,
    id,
    parentId,
    strokes,
    finished: false,
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
    const midpointX = (current[0] + next[0]) / 2;
    const midpointY = (current[1] + next[1]) / 2;
    context.quadraticCurveTo(current[0], current[1], midpointX, midpointY);
  }
  const last = scaled[scaled.length - 1];
  context.lineTo(last[0], last[1]);
  context.strokeStyle = color;
  context.lineWidth = width;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.stroke();
  context.restore();
}

function drawWaveUnderlay(context, tone) {
  context.strokeStyle = tone;
  context.lineWidth = 4;
  context.beginPath();
  context.arc(590, 170, 76, Math.PI * 0.92, Math.PI * 2.08);
  context.stroke();

  [590, 650, 714].forEach((y, index) => {
    context.beginPath();
    context.moveTo(-45, y);
    context.bezierCurveTo(95, y - 42, 190, y + 42, 330, y);
    context.bezierCurveTo(465, y - 40, 585, y + 36, 770, y - 5);
    context.globalAlpha = 0.17 - index * 0.025;
    context.stroke();
  });

  context.globalAlpha = 0.09;
  context.fillStyle = tone;
  context.beginPath();
  context.moveTo(0, 742);
  context.bezierCurveTo(130, 700, 220, 780, 360, 738);
  context.bezierCurveTo(500, 695, 625, 760, 720, 716);
  context.lineTo(720, 900);
  context.lineTo(0, 900);
  context.closePath();
  context.fill();
}

function drawRainUnderlay(context, tone) {
  context.strokeStyle = tone;
  context.fillStyle = tone;
  context.lineWidth = 4;
  context.beginPath();
  context.arc(142, 184, 46, Math.PI, Math.PI * 2);
  context.arc(200, 170, 62, Math.PI, Math.PI * 2);
  context.arc(267, 188, 43, Math.PI, Math.PI * 2);
  context.stroke();

  const drops = [
    [92, 290],
    [206, 320],
    [334, 260],
    [452, 342],
    [570, 278],
    [654, 380],
    [145, 470],
    [385, 502],
    [596, 538],
  ];
  drops.forEach(([x, y], index) => {
    context.globalAlpha = index % 2 ? 0.1 : 0.16;
    context.beginPath();
    context.moveTo(x + 18, y - 28);
    context.lineTo(x - 18, y + 28);
    context.stroke();
  });

  context.globalAlpha = 0.12;
  context.beginPath();
  context.ellipse(220, 724, 150, 35, -0.08, 0, Math.PI * 2);
  context.stroke();
}

function drawNightUnderlay(context, tone) {
  context.strokeStyle = tone;
  context.fillStyle = tone;
  context.lineWidth = 4;

  context.beginPath();
  context.arc(570, 180, 76, 0.32, Math.PI * 1.62);
  context.arc(602, 150, 67, Math.PI * 1.57, 0.45, true);
  context.stroke();

  const stars = [
    [110, 140, 6],
    [330, 115, 5],
    [646, 345, 6],
    [468, 430, 4],
    [128, 500, 4],
  ];
  stars.forEach(([x, y, radius], index) => {
    context.globalAlpha = index % 2 ? 0.12 : 0.2;
    context.beginPath();
    context.moveTo(x - radius * 2, y);
    context.lineTo(x + radius * 2, y);
    context.moveTo(x, y - radius * 2);
    context.lineTo(x, y + radius * 2);
    context.stroke();
  });

  context.globalAlpha = 0.13;
  [650, 710].forEach((y) => {
    context.beginPath();
    context.moveTo(35, y);
    context.bezierCurveTo(185, y - 45, 315, y + 35, 460, y - 6);
    context.bezierCurveTo(550, y - 30, 625, y - 20, 735, y - 44);
    context.stroke();
  });
}

function drawSunUnderlay(context, tone) {
  context.strokeStyle = tone;
  context.fillStyle = tone;
  context.lineWidth = 4;
  context.beginPath();
  context.arc(586, 184, 72, 0, Math.PI * 2);
  context.stroke();

  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI * 2 * index) / 8;
    context.globalAlpha = 0.12;
    context.beginPath();
    context.moveTo(
      586 + Math.cos(angle) * 98,
      184 + Math.sin(angle) * 98,
    );
    context.lineTo(
      586 + Math.cos(angle) * 122,
      184 + Math.sin(angle) * 122,
    );
    context.stroke();
  }

  context.globalAlpha = 0.11;
  context.beginPath();
  context.moveTo(-30, 620);
  context.bezierCurveTo(90, 544, 160, 590, 205, 720);
  context.bezierCurveTo(118, 670, 72, 706, 10, 810);
  context.stroke();
  context.beginPath();
  context.moveTo(35, 650);
  context.quadraticCurveTo(120, 604, 170, 622);
  context.moveTo(26, 714);
  context.quadraticCurveTo(108, 672, 152, 698);
  context.stroke();
}

function drawSceneUnderlay(context, doc) {
  const palette = PALETTES[doc.palette];
  const prompt = THEMES[doc.prompt];
  const tone = palette.dark ? "#f6f2ff" : "#285f63";
  context.save();
  context.globalAlpha = palette.dark ? 0.2 : 0.15;
  context.lineCap = "round";
  context.lineJoin = "round";

  if (prompt.id === "wave") drawWaveUnderlay(context, tone);
  if (prompt.id === "rain") drawRainUnderlay(context, tone);
  if (prompt.id === "night") drawNightUnderlay(context, tone);
  if (prompt.id === "free") drawSunUnderlay(context, tone);

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
    const themeImage = THEME_IMAGES[doc.prompt] ?? THEME_IMAGES[0];
    themeImage?.addEventListener(
      "load",
      () => renderArtwork(canvas, doc, options),
      { once: true },
    );
  }

  const palette = PALETTES[doc.palette];
  const strokeLimit =
    options.strokeLimit === undefined
      ? doc.strokes.length
      : Math.max(0, Math.min(doc.strokes.length, options.strokeLimit));

  doc.strokes.slice(0, strokeLimit).forEach((stroke) => {
    drawSmoothLine(context, stroke.points, palette.strokes[stroke.color]);
  });

  if (options.draftPoints?.length > 1) {
    const colorIndex = Number.isInteger(options.draftColorIndex)
      ? Math.max(
          0,
          Math.min(palette.strokes.length - 1, options.draftColorIndex),
        )
      : doc.strokes.length % palette.strokes.length;
    drawSmoothLine(
      context,
      options.draftPoints,
      palette.strokes[colorIndex],
      19,
    );
  }

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
    const note = document.createElement("span");
    note.textContent = theme.note;
    copy.append(title, note);
    card.append(preview, copy);
    label.append(input, card);
    group.append(label);
  });
}

function buildColorOptions(palette) {
  const group = document.querySelector("#colorGroup");
  group.replaceChildren();
  palette.strokes.forEach((color, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `color-button${index === state.strokeColor ? " is-selected" : ""}`;
    button.style.setProperty("--pen-color", color);
    button.setAttribute("aria-label", `${index + 1}번째 펜 색`);
    button.setAttribute(
      "aria-pressed",
      index === state.strokeColor ? "true" : "false",
    );
    button.addEventListener("click", () => {
      state.strokeColor = index;
      buildColorOptions(palette);
      if (state.currentDoc) {
        renderArtwork(canvases.draw, state.currentDoc, {
          draftPoints: state.draftPoints,
          draftColorIndex: state.strokeColor,
        });
      }
    });
    group.append(button);
  });
}

function renderInvite() {
  renderArtwork(canvases.invite, state.currentDoc);
  const count = state.currentDoc.strokes.length;
  document.querySelector("#inviteEyebrow").textContent =
    count === 0 ? "새 배경이 도착했어요" : `${count}개의 한 붓이 도착했어요`;
  document.querySelector("#inviteTitle").innerHTML =
    count === 0
      ? "원하는 곳에<br />내 한 붓을 그려주세요"
      : "친구의 그림 위에<br />내 한 붓을 더해주세요";
  showScreen(screens.invite);
}

function renderDraw() {
  const count = state.currentDoc.strokes.length;
  const palette = PALETTES[state.currentDoc.palette];
  state.draftPoints = [];
  state.drawing = false;
  state.strokeColor = count % palette.strokes.length;
  renderArtwork(canvases.draw, state.currentDoc);
  buildColorOptions(palette);

  document.querySelector("#drawEyebrow").textContent =
    THEMES[state.currentDoc.prompt].name;
  document.querySelector("#drawTitle").textContent = "원하는 곳에 한 붓 그려요";
  document.querySelector("#drawGuide").textContent =
    count === 0
      ? "손가락을 떼기 전까지 한 번에 그려요."
      : "앞의 그림은 그대로 두고, 한 붓만 더해요.";

  const turnChip = document.querySelector("#turnChip");
  turnChip.textContent = `${count + 1}번째 선`;

  document.querySelector("#undoButton").disabled = true;
  document.querySelector("#commitButton").disabled = true;
  document.querySelector("#drawStatus").textContent =
    "캔버스 어디서든 시작할 수 있어요.";
  showScreen(screens.draw);
}

function directChildren(parentId, rootId) {
  return nodesForRoot(rootId).filter((node) => node.parentId === parentId);
}

function branchTips(parentDoc) {
  const nodes = nodesForRoot(parentDoc.rootId);
  const children = nodes.filter((node) => node.parentId === parentDoc.id);
  return children.map((child) => {
    const seen = new Set([child.id]);
    let frontier = [child];
    let tip = child;
    while (frontier.length > 0) {
      const current = frontier.shift();
      if (
        current.strokes.length > tip.strokes.length ||
        (current.strokes.length === tip.strokes.length &&
          current.createdAt > tip.createdAt)
      ) {
        tip = current;
      }
      nodes
        .filter((node) => node.parentId === current.id && !seen.has(node.id))
        .forEach((node) => {
          seen.add(node.id);
          frontier.push(node);
        });
    }
    return tip;
  });
}

function renderHandoff() {
  renderArtwork(canvases.handoff, state.currentDoc);
  document.querySelector("#shareBox").classList.add("hidden");
  document.querySelector("#handoffStatus").textContent = "";
  document.querySelector("#copyStatus").textContent = "";
  showScreen(screens.handoff);
}

function addHistoryButton(container, count, selected) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `history-node${selected ? " is-selected" : ""}`;
  button.dataset.count = String(count);
  button.setAttribute(
    "aria-pressed",
    selected ? "true" : "false",
  );

  const dot = document.createElement("span");
  const color =
    count === 0
      ? "#ffcc55"
      : PALETTES[state.currentDoc.palette].strokes[
          state.currentDoc.strokes[count - 1].color
        ];
  button.style.setProperty("--node-color", color);
  const text = document.createTextNode(count === 0 ? "시작점" : `${count}번째`);
  button.append(dot, text);
  button.addEventListener("click", () => selectHistoryCount(count));
  container.append(button);
}

function selectHistoryCount(count) {
  state.selectedHistoryCount = count;
  state.selectedHistoryDoc = docAtStrokeCount(state.currentDoc, count);
  renderArtwork(canvases.history, state.selectedHistoryDoc);

  document.querySelectorAll(".history-node").forEach((button) => {
    const isSelected = Number(button.dataset.count) === count;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", isSelected ? "true" : "false");
  });

  const caption = document.querySelector("#snapshotCaption");
  caption.textContent =
    count === 0
      ? "아직 아무 선도 없는 배경에서 갈라져요."
      : `${count}번째 선까지 똑같이 보고, 다음 사람부터 서로 다르게 이어가요.`;

  const tips = branchTips(state.selectedHistoryDoc);
  const compareButton = document.querySelector("#compareBranchesButton");
  compareButton.classList.toggle("hidden", tips.length < 2);
  compareButton.textContent = `여기서 갈라진 ${tips.length}개 결과 비교하기`;
}

function renderHistory() {
  const list = document.querySelector("#historyList");
  list.replaceChildren();
  const defaultCount = Math.max(0, state.currentDoc.strokes.length - 1);
  for (let count = 0; count <= state.currentDoc.strokes.length; count += 1) {
    addHistoryButton(list, count, count === defaultCount);
  }
  selectHistoryCount(defaultCount);
  showScreen(screens.history);
}

function samplePointList(points) {
  return points.map(([x, y]) => [Math.round(x * 1000), Math.round(y * 1000)]);
}

function sampleDocs() {
  const rootId = "sample-root";
  const common = [
    {
      id: "sample-one",
      actor: "A",
      name: "해",
      color: 0,
      points: samplePointList([
        [0.28, 0.21],
        [0.35, 0.19],
        [0.41, 0.27],
        [0.48, 0.29],
        [0.54, 0.37],
      ]),
    },
    {
      id: "sample-two",
      actor: "B",
      name: "파도",
      color: 1,
      points: samplePointList([
        [0.54, 0.37],
        [0.61, 0.31],
        [0.68, 0.37],
        [0.73, 0.46],
        [0.67, 0.54],
      ]),
    },
  ];
  const branchA = [
    ...common,
    {
      id: "sample-a-three",
      actor: "A",
      name: "해",
      color: 2,
      points: samplePointList([
        [0.67, 0.54],
        [0.55, 0.57],
        [0.48, 0.66],
        [0.34, 0.67],
        [0.25, 0.74],
      ]),
    },
    {
      id: "sample-a-four",
      actor: "B",
      name: "파도",
      color: 3,
      points: samplePointList([
        [0.25, 0.74],
        [0.35, 0.81],
        [0.47, 0.76],
        [0.6, 0.82],
        [0.76, 0.77],
      ]),
    },
  ];
  const branchB = [
    ...common,
    {
      id: "sample-b-three",
      actor: "A",
      name: "별",
      color: 2,
      points: samplePointList([
        [0.67, 0.54],
        [0.76, 0.61],
        [0.69, 0.7],
        [0.59, 0.66],
        [0.61, 0.57],
      ]),
    },
    {
      id: "sample-b-four",
      actor: "B",
      name: "바람",
      color: 3,
      points: samplePointList([
        [0.61, 0.57],
        [0.52, 0.49],
        [0.4, 0.55],
        [0.36, 0.68],
        [0.48, 0.78],
      ]),
    },
  ];
  return [
    {
      version: FORMAT_VERSION,
      id: "sample-a-four",
      rootId,
      parentId: "sample-two",
      palette: 0,
      prompt: 0,
      strokes: branchA,
      finished: true,
      createdAt: 1,
    },
    {
      version: FORMAT_VERSION,
      id: "sample-b-four",
      rootId,
      parentId: "sample-two",
      palette: 0,
      prompt: 0,
      strokes: branchB,
      finished: true,
      createdAt: 2,
    },
  ];
}

function renderCompare(docs, fromHistory = false) {
  const grid = document.querySelector("#compareGrid");
  grid.replaceChildren();
  docs.slice(0, 4).forEach((doc, index) => {
    const card = document.createElement("article");
    card.className = "compare-card";

    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    renderArtwork(canvas, doc);

    const title = document.createElement("p");
    title.textContent = `여름 가지 ${String.fromCharCode(65 + index)}`;
    const authors = [...new Set(doc.strokes.map((stroke) => stroke.name))];
    const note = document.createElement("span");
    note.textContent =
      `${withParticle(authors.join(" · "), "이", "가")} 이어온 ${doc.strokes.length}개의 선`;
    card.append(canvas, title, note);
    grid.append(card);
  });

  state.compareReturnToHistory = fromHistory;
  document.querySelector("#backToHistoryButton").classList.toggle(
    "hidden",
    !fromHistory,
  );
  document.querySelector("#compareStartButton").textContent = fromHistory
    ? "새 한 줄 시작하기"
    : "나도 첫 선 만들기";
  showScreen(screens.compare);
}

function openShareBox(doc) {
  state.shareDoc = doc;
  const link = docLink(doc);
  document.querySelector("#shareLink").value = link;
  document.querySelector("#shareBox").classList.remove("hidden");
  document.querySelector("#copyStatus").textContent =
    "링크를 길게 눌러 복사해 친구에게 보내주세요.";
  document.querySelector("#shareBox").scrollIntoView({
    block: "nearest",
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
}

async function copyLink(doc) {
  const link = docLink(doc);
  try {
    await navigator.clipboard.writeText(link);
    showToast("토스 링크를 복사했어요.");
    return true;
  } catch (error) {
    return false;
  }
}

function finishCurrentArtwork() {
  if (!state.currentDoc || state.currentDoc.strokes.length < 4) return;
  state.currentDoc = {
    ...state.currentDoc,
    finished: true,
    createdAt: Date.now(),
  };
  saveNode(state.currentDoc);
  window.history.replaceState(
    null,
    "",
    `#${LINK_PARAM}=${encodeDoc(state.currentDoc)}`,
  );
  renderFinal();
}

function renderFinal() {
  const authors = [
    ...new Set(state.currentDoc.strokes.map((stroke) => stroke.name)),
  ];
  document.querySelector("#finalCaption").textContent =
    `${joinNames(authors)}의 선이 ${THEMES[state.currentDoc.prompt].name}에서 한 장으로 이어졌어요.`;
  showScreen(screens.final);
  playReplay();
}

function playReplay() {
  window.clearInterval(state.replayTimer);
  const badge = document.querySelector("#replayBadge");
  if (prefersReducedMotion()) {
    renderArtwork(canvases.final, state.currentDoc);
    badge.textContent = "완성";
    return;
  }

  let count = 0;
  badge.textContent = "다시 그리는 중";
  renderArtwork(canvases.final, state.currentDoc, {
    strokeLimit: 0,
  });
  state.replayTimer = window.setInterval(() => {
    count += 1;
    renderArtwork(canvases.final, state.currentDoc, {
      strokeLimit: count,
    });
    if (count >= state.currentDoc.strokes.length) {
      window.clearInterval(state.replayTimer);
      badge.textContent = "완성";
    }
  }, 470);
}

function saveArtwork() {
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = CANVAS_WIDTH;
  exportCanvas.height = CANVAS_HEIGHT;
  renderArtwork(exportCanvas, state.currentDoc);
  exportCanvas.toBlob((blob) => {
    if (!blob) {
      showToast("이미지를 만들지 못했어요.");
      return;
    }
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "한-줄-여름.png";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    showToast("완성 그림을 저장했어요.");
  }, "image/png");
}

function beginNew() {
  window.clearInterval(state.replayTimer);
  state.currentDoc = null;
  state.incoming = false;
  state.actor = "A";
  state.actorName = "여름 친구";
  state.names = { A: "", B: "" };
  state.draftPoints = [];
  state.palette = THEMES[0].palette;
  state.prompt = 0;
  state.strokeColor = 0;
  buildThemeOptions();
  document.querySelector("#shareBox").classList.add("hidden");
  window.history.replaceState(null, "", window.location.pathname);
  showScreen(screens.setup);
}

function returnHome() {
  window.clearInterval(state.replayTimer);
  showScreen(screens.home);
}

function loadFromLocation() {
  const incomingDoc = readDocFromLocation();
  if (!incomingDoc) {
    showScreen(screens.home);
    return;
  }

  state.currentDoc = incomingDoc;
  state.incoming = true;
  state.actor = nextActor(incomingDoc);
  state.actorName = state.actor === "A" ? "첫 친구" : "다음 친구";
  state.names.A = actorNameFromDoc(incomingDoc, "A");
  state.names.B = actorNameFromDoc(incomingDoc, "B");
  saveNode(incomingDoc);

  renderInvite();
}

function eventPoint(event) {
  const rect = canvases.draw.getBoundingClientRect();
  return [
    Math.round(((event.clientX - rect.left) / rect.width) * 1000),
    Math.round(((event.clientY - rect.top) / rect.height) * 1000),
  ];
}

function pointDistance(first, second) {
  return Math.hypot(first[0] - second[0], first[1] - second[1]);
}

function beginStroke(event) {
  if (!state.currentDoc || event.button > 0) return;
  if (state.draftPoints.length >= 3) {
    showToast("한 번에 한 붓만 그릴 수 있어요. 지우고 다시 그려주세요.");
    return;
  }
  const point = eventPoint(event);
  state.drawing = true;
  state.draftPoints = [point];
  canvases.draw.setPointerCapture(event.pointerId);
  renderArtwork(canvases.draw, state.currentDoc, {
    draftPoints: state.draftPoints,
    draftColorIndex: state.strokeColor,
  });
  document.querySelector("#drawStatus").textContent =
    "손가락을 떼면 이 한 붓이 끝나요.";
}

function extendStroke(event) {
  if (!state.drawing) return;
  const point = eventPoint(event);
  const previous = state.draftPoints[state.draftPoints.length - 1];
  if (pointDistance(point, previous) < 8) return;

  if (state.draftPoints.length >= MAX_POINTS) {
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
    ? "한 붓이 준비됐어요. 이제 다른 사람에게 토스해요."
    : "조금 더 길게 그려주세요.";
}

function resetDraftStroke() {
  state.draftPoints = [];
  state.drawing = false;
  renderArtwork(canvases.draw, state.currentDoc);
  document.querySelector("#undoButton").disabled = true;
  document.querySelector("#commitButton").disabled = true;
  document.querySelector("#drawStatus").textContent =
    "내 한 붓을 지웠어요. 캔버스 어디서든 다시 시작하세요.";
}

function commitDraftStroke() {
  if (state.draftPoints.length < 3 || !state.currentDoc) return;
  const nodeId = randomId();
  const color = state.strokeColor;
  const stroke = {
    id: nodeId,
    actor: state.actor,
    name: safeName(state.actorName),
    color,
    points: state.draftPoints.slice(0, MAX_POINTS),
  };
  const child = {
    ...state.currentDoc,
    id: nodeId,
    parentId: state.currentDoc.id,
    strokes: state.currentDoc.strokes.concat(stroke),
    finished: false,
    createdAt: Date.now(),
  };
  state.currentDoc = child;
  state.names[state.actor] = stroke.name;
  state.draftPoints = [];
  saveNode(child);
  window.history.replaceState(
    null,
    "",
    `#${LINK_PARAM}=${encodeDoc(child)}`,
  );
  renderHandoff();
}

buildThemeOptions();

document.querySelector("#startButton").addEventListener("click", beginNew);
document.querySelector("#homeButton").addEventListener("click", returnHome);

document.querySelector("#createCanvasButton").addEventListener("click", () => {
  state.actor = "A";
  state.actorName = "나";
  state.names.A = "나";
  state.currentDoc = createRootDoc();
  saveNode(state.currentDoc);
  renderDraw();
});

document.querySelector("#acceptInviteButton").addEventListener("click", () => {
  state.actorName = state.actor === "A" ? "첫 친구" : "다음 친구";
  state.names[state.actor] = state.actorName;
  renderDraw();
});

canvases.draw.addEventListener("pointerdown", beginStroke);
canvases.draw.addEventListener("pointermove", extendStroke);
canvases.draw.addEventListener("pointerup", endStroke);
canvases.draw.addEventListener("pointercancel", endStroke);

document.querySelector("#undoButton").addEventListener("click", resetDraftStroke);
document
  .querySelector("#commitButton")
  .addEventListener("click", commitDraftStroke);

document
  .querySelector("#makeShareLinkButton")
  .addEventListener("click", async () => {
    const copied = await copyLink(state.currentDoc);
    document.querySelector("#handoffStatus").textContent = copied
      ? "링크를 복사했어요. 친구에게 보내주세요."
      : "자동 복사가 되지 않아 링크를 직접 보여드려요.";
    document.querySelector("#shareBox").classList.toggle("hidden", copied);
    if (!copied) {
      openShareBox(state.currentDoc);
      document.querySelector("#shareLink").select();
    }
  });

document.querySelector("#copyButton").addEventListener("click", async () => {
  const doc = state.shareDoc || state.currentDoc;
  const copied = await copyLink(doc);
  document.querySelector("#copyStatus").textContent = copied
    ? "링크를 복사했어요. 친구에게 보내주세요."
    : "링크를 길게 눌러 복사해 주세요.";
  if (!copied) document.querySelector("#shareLink").select();
});

window.addEventListener("hashchange", loadFromLocation);

loadFromLocation();
