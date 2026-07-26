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

const PROMPTS = [
  { id: "wave", name: "바다 냄새", note: "파도처럼 이어보기", seed: [205, 190] },
  { id: "rain", name: "소나기 소리", note: "빗방울처럼 이어보기", seed: [510, 190] },
  { id: "night", name: "여름밤 공기", note: "느리게 이어보기", seed: [190, 680] },
  { id: "free", name: "아무 말 없는 여름", note: "마음 가는 대로", seed: [360, 430] },
];

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
  history: document.querySelector("#historyScreen"),
  compare: document.querySelector("#compareScreen"),
  final: document.querySelector("#finalScreen"),
};

const canvases = {
  draw: document.querySelector("#drawCanvas"),
  invite: document.querySelector("#inviteCanvas"),
  handoff: document.querySelector("#handoffCanvas"),
  history: document.querySelector("#historyCanvas"),
  final: document.querySelector("#finalCanvas"),
};

const state = {
  currentDoc: null,
  incoming: false,
  actor: "A",
  actorName: "여름 친구",
  names: { A: "", B: "" },
  palette: 0,
  prompt: 0,
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
      ? Math.max(0, Math.min(PROMPTS.length - 1, doc.prompt))
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

function seedPoint(doc) {
  const [x, y] = PROMPTS[doc.prompt].seed;
  return [Math.round((x / CANVAS_WIDTH) * 1000), Math.round((y / CANVAS_HEIGHT) * 1000)];
}

function endpointOf(doc, points = null) {
  if (points && points.length > 0) return points[points.length - 1];
  const lastStroke = doc.strokes[doc.strokes.length - 1];
  if (lastStroke) return lastStroke.points[lastStroke.points.length - 1];
  return seedPoint(doc);
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

function paintBackground(context, doc) {
  const palette = PALETTES[doc.palette];
  const gradient = context.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  gradient.addColorStop(0, palette.background[0]);
  gradient.addColorStop(1, palette.background[1]);
  context.fillStyle = gradient;
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  context.save();
  context.globalAlpha = palette.dark ? 0.15 : 0.11;
  context.strokeStyle = palette.dark ? "#ffffff" : "#17363a";
  context.lineWidth = 2;
  for (let y = 85; y < CANVAS_HEIGHT; y += 90) {
    context.beginPath();
    context.moveTo(-30, y);
    context.bezierCurveTo(140, y - 32, 260, y + 32, 430, y);
    context.bezierCurveTo(555, y - 24, 635, y + 20, 760, y - 4);
    context.stroke();
  }
  context.restore();

  const [seedX, seedY] = toCanvasPoint(seedPoint(doc));
  context.save();
  context.fillStyle = palette.dark ? "#fff0a8" : "#ffcc55";
  context.beginPath();
  context.arc(seedX, seedY, 20, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#17363a";
  context.lineWidth = 4;
  context.stroke();
  context.restore();

  context.save();
  context.fillStyle = palette.dark
    ? "rgba(255,255,255,0.72)"
    : "rgba(23,54,58,0.6)";
  context.font = "800 21px sans-serif";
  context.fillText("한 줄 여름", 36, CANVAS_HEIGHT - 54);
  context.font = "650 16px sans-serif";
  context.fillText(PROMPTS[doc.prompt].name, 36, CANVAS_HEIGHT - 29);
  context.restore();
}

function renderArtwork(canvas, doc, options = {}) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  paintBackground(context, doc);

  const palette = PALETTES[doc.palette];
  const strokeLimit =
    options.strokeLimit === undefined
      ? doc.strokes.length
      : Math.max(0, Math.min(doc.strokes.length, options.strokeLimit));

  doc.strokes.slice(0, strokeLimit).forEach((stroke) => {
    drawSmoothLine(context, stroke.points, palette.strokes[stroke.color]);
  });

  if (options.draftPoints?.length > 1) {
    const colorIndex = doc.strokes.length % palette.strokes.length;
    drawSmoothLine(
      context,
      options.draftPoints,
      palette.strokes[colorIndex],
      19,
    );
  }

  if (options.showEndpoint !== false) {
    const point = endpointOf(doc, options.draftPoints);
    const [x, y] = toCanvasPoint(point);
    context.save();
    context.fillStyle = "#fffef9";
    context.strokeStyle = "#17363a";
    context.lineWidth = 4;
    context.beginPath();
    context.arc(x, y, 10, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.restore();
  }
}

function updateEndpointGuide() {
  const guide = document.querySelector("#endpointGuide");
  const point = endpointOf(state.currentDoc, state.draftPoints);
  guide.style.left = `${point[0] / 10}%`;
  guide.style.top = `${point[1] / 10}%`;
  guide.classList.toggle("hidden", state.drawing);
}

function buildPaletteOptions() {
  const group = document.querySelector("#paletteGroup");
  group.replaceChildren();
  PALETTES.forEach((palette, index) => {
    const label = document.createElement("label");
    label.className = "palette-option";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "palette";
    input.value = String(index);
    input.checked = index === state.palette;
    input.setAttribute("aria-label", `${palette.name}, ${palette.note}`);
    input.addEventListener("change", () => {
      state.palette = index;
    });

    const card = document.createElement("span");
    card.className = "palette-card";
    card.style.background = `linear-gradient(135deg, ${palette.background[0]}, ${palette.background[1]})`;

    const title = document.createElement("strong");
    title.textContent = palette.name;
    const note = document.createElement("span");
    note.textContent = palette.note;
    card.append(title, note);
    label.append(input, card);
    group.append(label);
  });
}

function buildPromptOptions() {
  const group = document.querySelector("#promptGroup");
  group.replaceChildren();
  PROMPTS.forEach((prompt, index) => {
    const label = document.createElement("label");
    label.className = "prompt-option";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "prompt";
    input.value = String(index);
    input.checked = index === state.prompt;
    input.setAttribute("aria-label", `${prompt.name}, ${prompt.note}`);
    input.addEventListener("change", () => {
      state.prompt = index;
    });

    const card = document.createElement("span");
    card.className = "prompt-card";
    const title = document.createElement("strong");
    title.textContent = prompt.name;
    const note = document.createElement("span");
    note.textContent = prompt.note;
    card.append(title, note);
    label.append(input, card);
    group.append(label);
  });
}

function renderInvite() {
  renderArtwork(canvases.invite, state.currentDoc);
  const count = state.currentDoc.strokes.length;
  document.querySelector("#inviteEyebrow").textContent =
    count === 0 ? "첫 점이 도착했어요" : `${count}개의 선이 도착했어요`;
  document.querySelector("#inviteTitle").innerHTML =
    count === 0
      ? "작은 점에서 시작해<br />내 여름을 이어주세요"
      : "친구가 남긴 끝에서<br />내 여름을 이어주세요";
  document.querySelector("#guestName").value = "";
  showScreen(screens.invite);
}

function renderDraw() {
  const count = state.currentDoc.strokes.length;
  const palette = PALETTES[state.currentDoc.palette];
  state.draftPoints = [];
  state.drawing = false;
  renderArtwork(canvases.draw, state.currentDoc);

  document.querySelector("#drawEyebrow").textContent =
    count === 0 ? "첫 번째 선" : `${count + 1}번째 선`;
  document.querySelector("#drawTitle").textContent =
    count === 0 ? "빛나는 점에서 시작해요" : "친구의 끝에서 이어주세요";
  document.querySelector("#drawGuide").textContent =
    count === 0
      ? "한 손가락으로 선 하나를 그려주세요."
      : "앞의 선은 지워지지 않아요. 내 선만 다시 그릴 수 있어요.";

  const turnChip = document.querySelector("#turnChip");
  turnChip.textContent = `${safeName(state.actorName)}의 색`;
  turnChip.style.background =
    palette.strokes[count % palette.strokes.length];
  turnChip.style.color =
    state.currentDoc.palette === 3 && count % palette.strokes.length !== 0
      ? "#17363a"
      : "#17363a";

  document.querySelector("#undoButton").disabled = true;
  document.querySelector("#commitButton").disabled = true;
  document.querySelector("#drawStatus").textContent =
    "빛나는 끝점 가까이에서 손가락을 대주세요.";
  updateEndpointGuide();
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
  const count = state.currentDoc.strokes.length;
  renderArtwork(canvases.handoff, state.currentDoc);
  document.querySelector("#handoffEyebrow").textContent =
    `${safeName(state.actorName)}의 선이 이어졌어요`;
  document.querySelector("#handoffTitle").innerHTML =
    count < 4
      ? "이 선을 어디로<br />건네볼까요?"
      : "완성할까요,<br />더 멀리 건넬까요?";
  document.querySelector("#strokeCount").textContent = `${count}개`;

  const siblings =
    state.currentDoc.parentId === null
      ? 1
      : Math.max(
          1,
          directChildren(
            state.currentDoc.parentId,
            state.currentDoc.rootId,
          ).length,
        );
  document.querySelector("#branchCount").textContent = `${siblings}개`;

  const canFinish =
    count >= 4 &&
    new Set(state.currentDoc.strokes.map((stroke) => stroke.actor)).size >= 2;
  const finishButton = document.querySelector("#finishButton");
  finishButton.disabled = !canFinish;
  finishButton.textContent = canFinish
    ? "이 그림 완성하기"
    : "두 사람이 두 번씩 그리면 완성할 수 있어요";

  document.querySelector("#shareBox").classList.add("hidden");
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
      ? "아직 아무 선도 없는 첫 점에서 갈라져요."
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
    renderArtwork(canvas, doc, { showEndpoint: false });

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
    "같은 링크를 여러 사람에게 보내면 각각 새 가지가 생겨요.";
  document.querySelector("#shareBox").scrollIntoView({
    block: "nearest",
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
}

async function copyLink(doc) {
  const link = docLink(doc);
  try {
    await navigator.clipboard.writeText(link);
    showToast("중간 선 링크를 복사했어요.");
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
    `${joinNames(authors)}의 선이 ${PROMPTS[state.currentDoc.prompt].name}에서 한 장으로 이어졌어요.`;
  showScreen(screens.final);
  playReplay();
}

function playReplay() {
  window.clearInterval(state.replayTimer);
  const badge = document.querySelector("#replayBadge");
  if (prefersReducedMotion()) {
    renderArtwork(canvases.final, state.currentDoc, { showEndpoint: false });
    badge.textContent = "완성";
    return;
  }

  let count = 0;
  badge.textContent = "다시 그리는 중";
  renderArtwork(canvases.final, state.currentDoc, {
    strokeLimit: 0,
    showEndpoint: false,
  });
  state.replayTimer = window.setInterval(() => {
    count += 1;
    renderArtwork(canvases.final, state.currentDoc, {
      strokeLimit: count,
      showEndpoint: false,
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
  renderArtwork(exportCanvas, state.currentDoc, { showEndpoint: false });
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
  state.palette = 0;
  state.prompt = 0;
  buildPaletteOptions();
  buildPromptOptions();
  document.querySelector("#creatorName").value = "";
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
  state.names.A = actorNameFromDoc(incomingDoc, "A");
  state.names.B = actorNameFromDoc(incomingDoc, "B");
  saveNode(incomingDoc);

  if (incomingDoc.finished) {
    renderFinal();
  } else {
    renderInvite();
  }
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
  const point = eventPoint(event);
  const endpoint = endpointOf(state.currentDoc);
  if (pointDistance(point, endpoint) > 105) {
    document.querySelector("#drawStatus").textContent =
      "빛나는 끝점에 조금 더 가까이 대주세요.";
    showToast("빛나는 끝점에서 시작해 주세요.");
    return;
  }

  state.drawing = true;
  state.draftPoints = [endpoint, point];
  canvases.draw.setPointerCapture(event.pointerId);
  updateEndpointGuide();
  renderArtwork(canvases.draw, state.currentDoc, {
    draftPoints: state.draftPoints,
  });
  document.querySelector("#drawStatus").textContent =
    "손가락을 떼면 내 한 획이 준비돼요.";
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
    ? "좋아요. 다시 그리거나 이 선을 건넬 수 있어요."
    : "조금 더 길게 그려주세요.";
  updateEndpointGuide();
}

function resetDraftStroke() {
  state.draftPoints = [];
  state.drawing = false;
  renderArtwork(canvases.draw, state.currentDoc);
  document.querySelector("#undoButton").disabled = true;
  document.querySelector("#commitButton").disabled = true;
  document.querySelector("#drawStatus").textContent =
    "내 선만 지웠어요. 빛나는 끝점에서 다시 시작해 주세요.";
  updateEndpointGuide();
}

function commitDraftStroke() {
  if (state.draftPoints.length < 3 || !state.currentDoc) return;
  const nodeId = randomId();
  const color = state.currentDoc.strokes.length % 4;
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

buildPaletteOptions();
buildPromptOptions();

document.querySelector("#startButton").addEventListener("click", beginNew);
document.querySelector("#compareStartButton").addEventListener("click", beginNew);
document.querySelector("#exampleButton").addEventListener("click", () => {
  renderCompare(sampleDocs(), false);
});
document.querySelector("#homeButton").addEventListener("click", returnHome);
document.querySelector("#restartButton").addEventListener("click", beginNew);

document.querySelector("#createCanvasButton").addEventListener("click", () => {
  const name = safeName(document.querySelector("#creatorName").value);
  state.actor = "A";
  state.actorName = name;
  state.names.A = name;
  state.currentDoc = createRootDoc();
  saveNode(state.currentDoc);
  renderDraw();
});

document.querySelector("#acceptInviteButton").addEventListener("click", () => {
  const name = safeName(
    document.querySelector("#guestName").value,
    state.actor === "A" ? "첫 친구" : "다음 친구",
  );
  state.actorName = name;
  state.names[state.actor] = name;
  renderDraw();
});

document
  .querySelector("#inviteHistoryButton")
  .addEventListener("click", renderHistory);

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
  .addEventListener("click", () => openShareBox(state.currentDoc));

document.querySelector("#copyButton").addEventListener("click", async () => {
  const doc = state.shareDoc || state.currentDoc;
  const copied = await copyLink(doc);
  document.querySelector("#copyStatus").textContent = copied
    ? "링크를 복사했어요. 두 사람에게 보내면 두 갈래가 생겨요."
    : "아래 링크를 길게 눌러 복사해 주세요.";
  if (!copied) document.querySelector("#shareLink").select();
});

document
  .querySelector("#openShareLinkButton")
  .addEventListener("click", () => {
    const doc = state.shareDoc || state.currentDoc;
    window.open(docLink(doc), "_blank", "noopener,noreferrer");
  });

document.querySelector("#localContinueButton").addEventListener("click", () => {
  state.actor = nextActor(state.currentDoc);
  state.actorName =
    state.names[state.actor] || actorNameFromDoc(state.currentDoc, state.actor);
  renderDraw();
});

document.querySelector("#historyButton").addEventListener("click", renderHistory);
document.querySelector("#finishButton").addEventListener("click", finishCurrentArtwork);

document
  .querySelector("#shareSnapshotButton")
  .addEventListener("click", async () => {
    const doc = state.selectedHistoryDoc;
    const copied = await copyLink(doc);
    if (copied) {
      showToast("같은 중간 선 링크를 여러 사람에게 보내보세요.");
    } else {
      window.open(docLink(doc), "_blank", "noopener,noreferrer");
      showToast("새 탭에서 공유할 중간 선을 열었어요.");
    }
  });

document
  .querySelector("#compareBranchesButton")
  .addEventListener("click", () => {
    const tips = branchTips(state.selectedHistoryDoc);
    renderCompare(tips, true);
  });

document
  .querySelector("#backToHandoffButton")
  .addEventListener("click", renderHandoff);
document
  .querySelector("#backToHistoryButton")
  .addEventListener("click", renderHistory);

document.querySelector("#replayButton").addEventListener("click", playReplay);
document.querySelector("#saveButton").addEventListener("click", saveArtwork);
document
  .querySelector("#finalHistoryButton")
  .addEventListener("click", renderHistory);
document.querySelector("#finalNewButton").addEventListener("click", beginNew);

window.addEventListener("hashchange", loadFromLocation);

loadFromLocation();
