const SIZE = 15;
const EMPTY = 0;
const HUMAN = 1; // black
const AI = 2;    // white
const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

const startScreen = document.getElementById("startScreen");
const gameScreen = document.getElementById("gameScreen");
const resultModal = document.getElementById("resultModal");
const resultLabel = document.getElementById("resultLabel");
const resultTitle = document.getElementById("resultTitle");
const resultMessage = document.getElementById("resultMessage");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const homeBtn = document.getElementById("homeBtn");
const backBtn = document.getElementById("backBtn");
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const resetBtn = document.getElementById("resetBtn");
const aiModelEl = document.getElementById("aiModel");
const difficultyEl = document.getElementById("difficulty");
const firstPlayerEl = document.getElementById("firstPlayer");

let board = createBoard();
let gameOver = false;
let turn = HUMAN;
let lastMove = null;
let thinking = false;
let gameStarted = false;
let aiJobId = 0;
let aiWorker = createAiWorker();

function createBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
}

function createAiWorker() {
  if (!window.Worker) return null;

  const worker = new Worker("./ai-worker.js");
  worker.onmessage = event => {
    const { id, move, error } = event.data;
    if (id !== aiJobId || !thinking || !gameStarted || gameOver) return;

    if (error) {
      console.error("AI worker error:", error);
      statusEl.textContent = "AI 계산 중 오류가 발생했습니다.";
      thinking = false;
      turn = HUMAN;
      return;
    }

    if (move) place(move.r, move.c, AI);

    thinking = false;
    if (!gameOver) {
      turn = HUMAN;
      statusEl.textContent = "당신의 차례입니다. 흑은 장목, 쌍삼, 쌍사가 금수입니다.";
    }
  };
  worker.onerror = error => {
    console.error("AI worker failed:", error);
    statusEl.textContent = "AI Worker를 불러오지 못했습니다.";
    thinking = false;
    turn = HUMAN;
  };

  return worker;
}

function setVisible(element, visible) {
  element.hidden = !visible;
}

function resizeCanvasForDpr() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function cellMetrics() {
  const rect = canvas.getBoundingClientRect();
  const padding = rect.width * 0.045;
  const gap = (rect.width - padding * 2) / (SIZE - 1);
  return { rect, padding, gap };
}

function draw() {
  const { rect, padding, gap } = cellMetrics();
  if (!rect.width || !rect.height) return;

  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = "#cf984d";
  ctx.fillRect(0, 0, rect.width, rect.height);

  ctx.strokeStyle = "rgba(45, 29, 16, 0.72)";
  ctx.lineWidth = 1;

  for (let i = 0; i < SIZE; i++) {
    const p = padding + i * gap;

    ctx.beginPath();
    ctx.moveTo(padding, p);
    ctx.lineTo(padding + gap * (SIZE - 1), p);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(p, padding);
    ctx.lineTo(p, padding + gap * (SIZE - 1));
    ctx.stroke();
  }

  const stars = [[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]];
  for (const [r, c] of stars) drawStar(c, r, gap * 0.09);

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== EMPTY) drawStone(c, r, board[r][c], gap);
    }
  }

  if (lastMove) drawLastMove(lastMove.c, lastMove.r, gap);
}

function drawStar(c, r, radius) {
  const { padding, gap } = cellMetrics();
  ctx.beginPath();
  ctx.arc(padding + c * gap, padding + r * gap, radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(45, 29, 16, 0.72)";
  ctx.fill();
}

function drawStone(c, r, player, gap) {
  const { padding } = cellMetrics();
  const x = padding + c * gap;
  const y = padding + r * gap;
  const radius = gap * 0.42;
  const grad = ctx.createRadialGradient(x - radius * 0.32, y - radius * 0.32, radius * 0.1, x, y, radius);

  if (player === HUMAN) {
    grad.addColorStop(0, "#555");
    grad.addColorStop(1, "#050505");
  } else {
    grad.addColorStop(0, "#fff");
    grad.addColorStop(1, "#d9d9d9");
  }

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = player === HUMAN ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.25)";
  ctx.stroke();
}

function drawLastMove(c, r, gap) {
  const { padding } = cellMetrics();
  const x = padding + c * gap;
  const y = padding + r * gap;
  ctx.beginPath();
  ctx.arc(x, y, gap * 0.13, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(214, 58, 58, 0.9)";
  ctx.fill();
}

function canvasToCell(e) {
  const { rect, padding, gap } = cellMetrics();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const c = Math.round((x - padding) / gap);
  const r = Math.round((y - padding) / gap);

  if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return null;

  const px = padding + c * gap;
  const py = padding + r * gap;
  if (Math.hypot(x - px, y - py) > gap * 0.48) return null;

  return { r, c };
}

function place(r, c, player) {
  if (gameOver || board[r][c] !== EMPTY) return false;

  board[r][c] = player;
  lastMove = { r, c };
  draw();

  if (RenjuRules.isWin(board, r, c, player)) {
    gameOver = true;
    const result = player === HUMAN ? "win" : "lose";
    statusEl.textContent = player === HUMAN ? "승리했습니다." : "AI가 승리했습니다.";
    showResult(result);
    return true;
  }

  if (isFull()) {
    gameOver = true;
    statusEl.textContent = "무승부입니다.";
    showResult("draw");
    return true;
  }

  return true;
}

function showResult(result) {
  const resultText = {
    win: ["Victory", "승리했습니다", "렌주룰 기준으로 흑이 정확히 5목을 완성했습니다."],
    lose: ["Defeat", "패배했습니다", "AI가 먼저 5목 이상을 완성했습니다."],
    draw: ["Draw", "무승부입니다", "더 이상 둘 수 있는 자리가 없습니다."]
  }[result];

  resultLabel.textContent = resultText[0];
  resultTitle.textContent = resultText[1];
  resultMessage.textContent = resultText[2];
  setVisible(resultModal, true);
  resultModal.setAttribute("aria-hidden", "false");
}

function hideResult() {
  setVisible(resultModal, false);
  resultModal.setAttribute("aria-hidden", "true");
}

function showStart() {
  gameStarted = false;
  cancelAiJob();
  hideResult();
  setVisible(gameScreen, false);
  setVisible(startScreen, true);
}

function showGame() {
  gameStarted = true;
  hideResult();
  setVisible(startScreen, false);
  setVisible(gameScreen, true);
  requestAnimationFrame(() => {
    resizeCanvasForDpr();
    reset();
  });
}

function isFull() {
  return board.every(row => row.every(v => v !== EMPTY));
}

function onHumanMove(e) {
  if (!gameStarted || thinking || gameOver || turn !== HUMAN) return;

  const cell = canvasToCell(e);
  if (!cell) return;

  const reason = RenjuRules.forbiddenReason(board, cell.r, cell.c, HUMAN);
  if (reason) {
    statusEl.textContent = `${reason} 다른 곳에 두세요.`;
    return;
  }

  if (!place(cell.r, cell.c, HUMAN)) return;
  if (gameOver) return;

  turn = AI;
  statusEl.textContent = "AI가 생각 중입니다...";
  thinking = true;
  setTimeout(aiMove, 40);
}

function aiMove() {
  if (!gameStarted || gameOver) return;

  if (!aiWorker) {
    statusEl.textContent = "이 브라우저는 AI Worker를 지원하지 않습니다.";
    thinking = false;
    turn = HUMAN;
    return;
  }

  aiJobId += 1;
  aiWorker.postMessage({
    id: aiJobId,
    board: board.map(row => row.slice()),
    depth: Number(difficultyEl.value),
    model: aiModelEl.value
  });
}

function cancelAiJob() {
  aiJobId += 1;
  thinking = false;
}

function reset() {
  cancelAiJob();
  board = createBoard();
  gameOver = false;
  lastMove = null;
  hideResult();

  if (firstPlayerEl.value === "ai") {
    turn = AI;
    statusEl.textContent = "AI가 먼저 둡니다. 흑은 장목, 쌍삼, 쌍사가 금수입니다.";
    draw();
    thinking = true;
    setTimeout(aiMove, 120);
  } else {
    turn = HUMAN;
    statusEl.textContent = "흑돌을 두세요. 흑은 장목, 쌍삼, 쌍사가 금수입니다.";
    draw();
  }
}

canvas.addEventListener("click", onHumanMove);
canvas.addEventListener("touchstart", e => {
  e.preventDefault();
  onHumanMove(e);
}, { passive: false });
startBtn.addEventListener("click", showGame);
restartBtn.addEventListener("click", reset);
homeBtn.addEventListener("click", showStart);
backBtn.addEventListener("click", showStart);
resetBtn.addEventListener("click", reset);
window.addEventListener("resize", resizeCanvasForDpr);

showStart();
