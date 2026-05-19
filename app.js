const SIZE = 15;
const EMPTY = 0;
const HUMAN = 1; // black
const AI = 2;    // white
const DIRS = [[1,0], [0,1], [1,1], [1,-1]];

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const resetBtn = document.getElementById("resetBtn");
const difficultyEl = document.getElementById("difficulty");
const firstPlayerEl = document.getElementById("firstPlayer");

let board = createBoard();
let gameOver = false;
let turn = HUMAN;
let lastMove = null;
let thinking = false;

function createBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
}

function resizeCanvasForDpr() {
  const rect = canvas.getBoundingClientRect();
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

  const stars = [[3,3], [3,11], [7,7], [11,3], [11,11]];
  for (const [r, c] of stars) {
    drawStar(c, r, gap * 0.09);
  }

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

  if (isWin(r, c, player)) {
    gameOver = true;
    statusEl.textContent = player === HUMAN ? "승리했습니다." : "AI가 승리했습니다.";
    return true;
  }

  if (isFull()) {
    gameOver = true;
    statusEl.textContent = "무승부입니다.";
    return true;
  }

  return true;
}

function isFull() {
  return board.every(row => row.every(v => v !== EMPTY));
}

function isWin(r, c, player) {
  for (const [dr, dc] of DIRS) {
    let count = 1;
    count += countDir(r, c, dr, dc, player);
    count += countDir(r, c, -dr, -dc, player);
    if (count >= 5) return true;
  }
  return false;
}

function countDir(r, c, dr, dc, player) {
  let n = 0;
  let nr = r + dr, nc = c + dc;
  while (inside(nr, nc) && board[nr][nc] === player) {
    n++;
    nr += dr; nc += dc;
  }
  return n;
}

function inside(r, c) {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

canvas.addEventListener("click", onHumanMove);
canvas.addEventListener("touchstart", e => {
  e.preventDefault();
  onHumanMove(e);
}, { passive: false });

function onHumanMove(e) {
  if (thinking || gameOver || turn !== HUMAN) return;
  const cell = canvasToCell(e);
  if (!cell) return;
  if (!place(cell.r, cell.c, HUMAN)) return;
  if (gameOver) return;
  turn = AI;
  statusEl.textContent = "AI가 생각 중입니다...";
  thinking = true;
  setTimeout(aiMove, 40);
}

function aiMove() {
  const depth = Number(difficultyEl.value);
  const move = findBestMove(depth);
  if (move) place(move.r, move.c, AI);

  thinking = false;
  if (!gameOver) {
    turn = HUMAN;
    statusEl.textContent = "당신의 차례입니다.";
  }
}

function findBestMove(depth) {
  const candidates = generateCandidates();
  if (candidates.length === 0) return { r: 7, c: 7 };

  for (const m of candidates) {
    board[m.r][m.c] = AI;
    const win = isWin(m.r, m.c, AI);
    board[m.r][m.c] = EMPTY;
    if (win) return m;
  }
  for (const m of candidates) {
    board[m.r][m.c] = HUMAN;
    const humanWin = isWin(m.r, m.c, HUMAN);
    board[m.r][m.c] = EMPTY;
    if (humanWin) return m;
  }

  let best = candidates[0];
  let bestScore = -Infinity;
  const limit = depth === 3 ? 18 : depth === 2 ? 14 : 10;
  const ordered = candidates
    .map(m => ({ ...m, score: localMoveScore(m.r, m.c, AI) + localMoveScore(m.r, m.c, HUMAN) * 0.9 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  for (const m of ordered) {
    board[m.r][m.c] = AI;
    const score = -negamax(depth - 1, -Infinity, Infinity, HUMAN);
    board[m.r][m.c] = EMPTY;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

function negamax(depth, alpha, beta, player) {
  const opponent = player === AI ? HUMAN : AI;
  if (depth === 0) return evaluate(player);

  const candidates = generateCandidates();
  if (candidates.length === 0) return 0;

  const limit = depth >= 2 ? 12 : 10;
  const ordered = candidates
    .map(m => ({ ...m, score: localMoveScore(m.r, m.c, player) + localMoveScore(m.r, m.c, opponent) * 0.8 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  let best = -Infinity;
  for (const m of ordered) {
    board[m.r][m.c] = player;
    let score;
    if (isWin(m.r, m.c, player)) {
      score = 10_000_000;
    } else {
      score = -negamax(depth - 1, -beta, -alpha, opponent);
    }
    board[m.r][m.c] = EMPTY;

    best = Math.max(best, score);
    alpha = Math.max(alpha, score);
    if (alpha >= beta) break;
  }
  return best;
}

function generateCandidates() {
  const set = new Set();
  let hasStone = false;

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== EMPTY) {
        hasStone = true;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const nr = r + dr, nc = c + dc;
            if (inside(nr, nc) && board[nr][nc] === EMPTY) set.add(`${nr},${nc}`);
          }
        }
      }
    }
  }

  if (!hasStone) return [{ r: 7, c: 7 }];
  return [...set].map(s => {
    const [r, c] = s.split(",").map(Number);
    return { r, c };
  });
}

function evaluate(playerPerspective) {
  const aiScore = totalScore(AI);
  const humanScore = totalScore(HUMAN);
  const raw = aiScore - humanScore * 1.08;
  return playerPerspective === AI ? raw : -raw;
}

function totalScore(player) {
  let score = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === player) {
        for (const [dr, dc] of DIRS) {
          const prevR = r - dr, prevC = c - dc;
          if (inside(prevR, prevC) && board[prevR][prevC] === player) continue;
          score += lineScore(r, c, dr, dc, player);
        }
      }
    }
  }
  return score;
}

function lineScore(r, c, dr, dc, player) {
  let len = 0;
  let nr = r, nc = c;
  while (inside(nr, nc) && board[nr][nc] === player) {
    len++;
    nr += dr; nc += dc;
  }

  const open1 = inside(nr, nc) && board[nr][nc] === EMPTY;
  const br = r - dr, bc = c - dc;
  const open2 = inside(br, bc) && board[br][bc] === EMPTY;
  const open = Number(open1) + Number(open2);

  if (len >= 5) return 10_000_000;
  if (len === 4 && open === 2) return 1_000_000;
  if (len === 4 && open === 1) return 180_000;
  if (len === 3 && open === 2) return 45_000;
  if (len === 3 && open === 1) return 5_000;
  if (len === 2 && open === 2) return 1_200;
  if (len === 2 && open === 1) return 200;
  if (len === 1 && open === 2) return 30;
  return 0;
}

function localMoveScore(r, c, player) {
  board[r][c] = player;
  let score = 0;
  if (isWin(r, c, player)) score += 10_000_000;
  for (const [dr, dc] of DIRS) {
    score += localLineScore(r, c, dr, dc, player);
  }
  board[r][c] = EMPTY;
  return score;
}

function localLineScore(r, c, dr, dc, player) {
  let count = 1;
  let open = 0;

  let nr = r + dr, nc = c + dc;
  while (inside(nr, nc) && board[nr][nc] === player) {
    count++;
    nr += dr; nc += dc;
  }
  if (inside(nr, nc) && board[nr][nc] === EMPTY) open++;

  nr = r - dr; nc = c - dc;
  while (inside(nr, nc) && board[nr][nc] === player) {
    count++;
    nr -= dr; nc -= dc;
  }
  if (inside(nr, nc) && board[nr][nc] === EMPTY) open++;

  if (count >= 5) return 10_000_000;
  if (count === 4 && open === 2) return 1_000_000;
  if (count === 4 && open === 1) return 200_000;
  if (count === 3 && open === 2) return 50_000;
  if (count === 3 && open === 1) return 5_000;
  if (count === 2 && open === 2) return 1_500;
  return 50;
}

function reset() {
  board = createBoard();
  gameOver = false;
  lastMove = null;
  thinking = false;

  if (firstPlayerEl.value === "ai") {
    turn = AI;
    statusEl.textContent = "AI가 먼저 둡니다.";
    draw();
    setTimeout(aiMove, 120);
  } else {
    turn = HUMAN;
    statusEl.textContent = "흑돌을 두세요. 당신이 먼저 시작합니다.";
    draw();
  }
}

resetBtn.addEventListener("click", reset);
difficultyEl.addEventListener("change", reset);
firstPlayerEl.addEventListener("change", reset);
window.addEventListener("resize", resizeCanvasForDpr);

resizeCanvasForDpr();
reset();
