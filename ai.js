const GomokuAI = (() => {
  const SIZE = 15;
  const EMPTY = 0;
  const HUMAN = 1;
  const AI = 2;
  const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
  const WIN = 10_000_000;
  const EXACT = 0;
  const LOWER = 1;
  const UPPER = 2;
  const MAX_TABLE_SIZE = 80_000;
  const table = new Map();
  const zobrist = createZobrist();

  function findBestMove(board, options = {}) {
    const model = options.model || "tactical";
    const depth = Number(options.depth || 2);

    if (model === "greedy") return greedyMove(board);
    if (model === "tactical") return tacticalMove(board, depth + 1);
    return searchMove(board, depth);
  }

  function greedyMove(board) {
    const opening = openingMove(board);
    if (opening) return opening;

    const candidates = generateCandidates(board);
    if (candidates.length === 0) return { r: 7, c: 7 };

    const forced = findImmediateTactic(board, candidates);
    if (forced) return forced;

    return candidates
      .map(m => ({ ...m, score: localMoveScore(board, m.r, m.c, AI) + localMoveScore(board, m.r, m.c, HUMAN) * 1.15 }))
      .sort((a, b) => b.score - a.score)[0];
  }

  function searchMove(board, depth) {
    const opening = openingMove(board);
    if (opening) return opening;

    const candidates = generateCandidates(board);
    if (candidates.length === 0) return { r: 7, c: 7 };

    const forced = findImmediateTactic(board, candidates);
    if (forced) return forced;

    return iterativeSearch(board, Math.max(1, depth), false);
  }

  function tacticalMove(board, depth) {
    const opening = openingMove(board);
    if (opening) return opening;

    const candidates = generateCandidates(board);
    if (candidates.length === 0) return { r: 7, c: 7 };

    const forced = findImmediateTactic(board, candidates);
    if (forced) return forced;

    const winByThreat = findWinningThreat(board, candidates);
    if (winByThreat) return winByThreat;

    const dangerous = findMustBlockThreat(board, candidates);
    if (dangerous) return dangerous;

    return iterativeSearch(board, Math.max(2, depth), true);
  }

  function iterativeSearch(board, maxDepth, tactical) {
    let best = null;
    let bestScore = -Infinity;
    const started = performance.now ? performance.now() : Date.now();
    const timeLimit = tactical ? 900 : 520;

    for (let depth = 1; depth <= maxDepth; depth++) {
      const result = rootSearch(board, depth, tactical, started, timeLimit);
      if (result.timeout) break;
      if (result.move) {
        best = result.move;
        bestScore = result.score;
      }
    }

    if (best) return best;
    return greedyMove(board);
  }

  function rootSearch(board, depth, tactical, started, timeLimit) {
    const candidates = generateCandidates(board);
    const limit = tactical ? (depth >= 4 ? 26 : 22) : (depth >= 3 ? 18 : 14);
    const ordered = orderCandidates(board, candidates, AI, limit, tactical);
    let best = ordered[0] || candidates[0];
    let bestScore = -Infinity;
    let alpha = -Infinity;
    let timeout = false;

    for (const m of ordered) {
      if (isTimeout(started, timeLimit)) {
        timeout = true;
        break;
      }

      board[m.r][m.c] = AI;
      const score = isWin(board, m.r, m.c, AI)
        ? WIN
        : -negamax(board, depth - 1, -Infinity, -alpha, HUMAN, tactical, started, timeLimit, 1);
      board[m.r][m.c] = EMPTY;

      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
      alpha = Math.max(alpha, score);
    }

    return { move: best, score: bestScore, timeout };
  }

  function negamax(board, depth, alpha, beta, player, tactical, started, timeLimit, ply) {
    if (isTimeout(started, timeLimit)) return evaluate(board, player, tactical);

    const alphaStart = alpha;
    const key = hashBoard(board) + `:${depth}:${player}:${tactical ? 1 : 0}`;
    const hit = table.get(key);
    if (hit && hit.depth >= depth) {
      if (hit.flag === EXACT) return hit.score;
      if (hit.flag === LOWER) alpha = Math.max(alpha, hit.score);
      if (hit.flag === UPPER) beta = Math.min(beta, hit.score);
      if (alpha >= beta) return hit.score;
    }

    if (depth === 0) return quiescence(board, alpha, beta, player, tactical, ply);

    const opponent = player === AI ? HUMAN : AI;
    const candidates = generateCandidates(board);
    if (candidates.length === 0) return 0;

    const playerWin = findImmediateForPlayer(board, candidates, player);
    if (playerWin) return WIN - ply;

    const opponentWin = findImmediateForPlayer(board, candidates, opponent);
    if (opponentWin && depth <= 1) return -WIN + ply;

    const limit = tactical ? (depth >= 3 ? 18 : 14) : (depth >= 2 ? 12 : 10);
    const ordered = orderCandidates(board, candidates, player, limit, tactical);

    let best = -Infinity;
    for (const m of ordered) {
      board[m.r][m.c] = player;
      const score = isWin(board, m.r, m.c, player)
        ? WIN - ply
        : -negamax(board, depth - 1, -beta, -alpha, opponent, tactical, started, timeLimit, ply + 1);
      board[m.r][m.c] = EMPTY;

      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
      if (alpha >= beta) break;
    }

    let flag = EXACT;
    if (best <= alphaStart) flag = UPPER;
    else if (best >= beta) flag = LOWER;
    saveTable(key, { depth, score: best, flag });

    return best;
  }

  function quiescence(board, alpha, beta, player, tactical, ply) {
    const stand = evaluate(board, player, tactical);
    if (stand >= beta) return beta;
    alpha = Math.max(alpha, stand);

    const candidates = generateCandidates(board);
    const forcing = candidates.filter(m => {
      const s1 = moveThreatScore(board, m.r, m.c, player);
      const s2 = moveThreatScore(board, m.r, m.c, player === AI ? HUMAN : AI);
      return s1 >= 120_000 || s2 >= 180_000;
    }).slice(0, 10);

    if (ply > 4 || forcing.length === 0) return alpha;

    const opponent = player === AI ? HUMAN : AI;
    const ordered = orderCandidates(board, forcing, player, 8, tactical);
    for (const m of ordered) {
      board[m.r][m.c] = player;
      const score = isWin(board, m.r, m.c, player)
        ? WIN - ply
        : -quiescence(board, -beta, -alpha, opponent, tactical, ply + 1);
      board[m.r][m.c] = EMPTY;
      if (score >= beta) return beta;
      alpha = Math.max(alpha, score);
    }

    return alpha;
  }

  function findImmediateTactic(board, candidates) {
    for (const m of candidates) {
      board[m.r][m.c] = AI;
      const win = isWin(board, m.r, m.c, AI);
      board[m.r][m.c] = EMPTY;
      if (win) return m;
    }

    for (const m of candidates) {
      board[m.r][m.c] = HUMAN;
      const humanWin = isWin(board, m.r, m.c, HUMAN);
      board[m.r][m.c] = EMPTY;
      if (humanWin) return m;
    }

    const humanFours = candidates.filter(m => createsFour(board, m.r, m.c, HUMAN));
    if (humanFours.length > 0) return bestByThreat(board, humanFours, HUMAN);

    return null;
  }

  function findWinningThreat(board, candidates) {
    const mine = candidates.filter(m => {
      board[m.r][m.c] = AI;
      const threat = threatClass(board, m.r, m.c, AI);
      board[m.r][m.c] = EMPTY;
      return threat >= 5;
    });
    return mine.length ? bestByThreat(board, mine, AI) : null;
  }

  function findMustBlockThreat(board, candidates) {
    const dangerous = candidates.filter(m => {
      board[m.r][m.c] = HUMAN;
      const threat = threatClass(board, m.r, m.c, HUMAN);
      board[m.r][m.c] = EMPTY;
      return threat >= 5;
    });
    return dangerous.length ? bestByThreat(board, dangerous, HUMAN) : null;
  }

  function bestByThreat(board, moves, player) {
    return moves
      .map(m => ({ ...m, score: moveThreatScore(board, m.r, m.c, player) + localMoveScore(board, m.r, m.c, player) }))
      .sort((a, b) => b.score - a.score)[0];
  }

  function threatClass(board, r, c, player) {
    let openFour = 0;
    let four = 0;
    let openThree = 0;

    for (const [dr, dc] of DIRS) {
      const info = lineInfo(board, r, c, dr, dc, player);
      if (info.count >= 5) return 10;
      if (info.count === 4 && info.open === 2) openFour++;
      if (info.count >= 4 && info.open >= 1) four++;
      if (info.count === 3 && info.open === 2) openThree++;
    }

    if (four >= 2) return 7;          // double four
    if (four >= 1 && openThree >= 1) return 6; // four-three
    if (openThree >= 2) return 5;     // double open three
    if (openFour >= 1) return 4;
    if (four >= 1) return 3;
    if (openThree >= 1) return 2;
    return 0;
  }

  function findImmediateForPlayer(board, candidates, player) {
    for (const m of candidates) {
      board[m.r][m.c] = player;
      const win = isWin(board, m.r, m.c, player);
      board[m.r][m.c] = EMPTY;
      if (win) return m;
    }
    return null;
  }

  function orderCandidates(board, candidates, player, limit, tactical = false) {
    const opponent = player === AI ? HUMAN : AI;
    return candidates
      .map(m => {
        const attack = localMoveScore(board, m.r, m.c, player);
        const defense = localMoveScore(board, m.r, m.c, opponent);
        const myThreat = moveThreatScore(board, m.r, m.c, player);
        const oppThreat = moveThreatScore(board, m.r, m.c, opponent);
        return {
          ...m,
          score:
            attack * 1.0 +
            defense * 1.25 +
            myThreat * (tactical ? 0.55 : 0.3) +
            oppThreat * (tactical ? 0.85 : 0.45) +
            centerScore(m.r, m.c)
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  function openingMove(board) {
    const moves = getPlayedMoves(board);
    if (moves.length === 0) return { r: 7, c: 7 };

    if (moves.length === 1 && board[7][7] === HUMAN) {
      return firstEmpty(board, [[7, 8], [8, 7], [6, 7], [7, 6], [8, 8], [6, 6]]);
    }

    if (moves.length <= 3) {
      const centerish = [[7, 7], [7, 8], [8, 7], [6, 7], [7, 6], [8, 8], [6, 6], [6, 8], [8, 6]];
      const move = firstEmpty(board, centerish);
      if (move && hasNeighbor(board, move.r, move.c, 2)) return move;
    }

    return null;
  }

  function getPlayedMoves(board) {
    const moves = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] !== EMPTY) moves.push({ r, c, player: board[r][c] });
      }
    }
    return moves;
  }

  function firstEmpty(board, coords) {
    for (const [r, c] of coords) {
      if (inside(r, c) && board[r][c] === EMPTY) return { r, c };
    }
    return null;
  }

  function generateCandidates(board) {
    const set = new Set();
    let hasStone = false;

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] !== EMPTY) {
          hasStone = true;
          for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
              const nr = r + dr;
              const nc = c + dc;
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

  function evaluate(board, playerPerspective, tactical = false) {
    const aiScore = totalScore(board, AI, tactical);
    const humanScore = totalScore(board, HUMAN, tactical);
    const raw = aiScore - humanScore * 1.16;
    return playerPerspective === AI ? raw : -raw;
  }

  function totalScore(board, player, tactical = false) {
    let score = 0;

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] === player) {
          for (const [dr, dc] of DIRS) {
            const prevR = r - dr;
            const prevC = c - dc;
            if (inside(prevR, prevC) && board[prevR][prevC] === player) continue;
            score += lineScore(board, r, c, dr, dc, player);
          }
        }
      }
    }

    if (tactical) score += boardThreatScore(board, player);
    return score;
  }

  function boardThreatScore(board, player) {
    let score = 0;
    const candidates = generateCandidates(board);

    for (const m of candidates) {
      score += moveThreatScore(board, m.r, m.c, player) * 0.06;
    }

    return score;
  }

  function moveThreatScore(board, r, c, player) {
    if (board[r][c] !== EMPTY) return 0;

    board[r][c] = player;
    let score = 0;

    if (isWin(board, r, c, player)) score += WIN;

    const cls = threatClass(board, r, c, player);
    if (cls >= 7) score += 1_600_000;
    else if (cls >= 6) score += 1_100_000;
    else if (cls >= 5) score += 820_000;
    else if (cls >= 4) score += 560_000;
    else if (cls >= 3) score += 160_000;
    else if (cls >= 2) score += 45_000;

    board[r][c] = EMPTY;
    return score;
  }

  function createsFour(board, r, c, player) {
    return DIRS.some(([dr, dc]) => {
      const info = lineInfo(board, r, c, dr, dc, player);
      return info.count >= 4 && info.open >= 1;
    });
  }

  function lineInfo(board, r, c, dr, dc, player) {
    let count = 1;
    let open = 0;

    let nr = r + dr;
    let nc = c + dc;
    while (inside(nr, nc) && board[nr][nc] === player) {
      count++;
      nr += dr;
      nc += dc;
    }
    if (inside(nr, nc) && board[nr][nc] === EMPTY) open++;

    nr = r - dr;
    nc = c - dc;
    while (inside(nr, nc) && board[nr][nc] === player) {
      count++;
      nr -= dr;
      nc -= dc;
    }
    if (inside(nr, nc) && board[nr][nc] === EMPTY) open++;

    return { count, open };
  }

  function lineScore(board, r, c, dr, dc, player) {
    let len = 0;
    let nr = r;
    let nc = c;

    while (inside(nr, nc) && board[nr][nc] === player) {
      len++;
      nr += dr;
      nc += dc;
    }

    const open1 = inside(nr, nc) && board[nr][nc] === EMPTY;
    const br = r - dr;
    const bc = c - dc;
    const open2 = inside(br, bc) && board[br][bc] === EMPTY;
    const open = Number(open1) + Number(open2);

    if (len >= 5) return WIN;
    if (len === 4 && open === 2) return 1_400_000;
    if (len === 4 && open === 1) return 260_000;
    if (len === 3 && open === 2) return 75_000;
    if (len === 3 && open === 1) return 9_000;
    if (len === 2 && open === 2) return 2_200;
    if (len === 2 && open === 1) return 350;
    if (len === 1 && open === 2) return 40;
    return 0;
  }

  function localMoveScore(board, r, c, player) {
    if (board[r][c] !== EMPTY) return -Infinity;

    board[r][c] = player;
    let score = 0;

    if (isWin(board, r, c, player)) score += WIN;
    for (const [dr, dc] of DIRS) {
      score += localLineScore(board, r, c, dr, dc, player);
    }

    board[r][c] = EMPTY;
    return score;
  }

  function localLineScore(board, r, c, dr, dc, player) {
    const info = lineInfo(board, r, c, dr, dc, player);
    const count = info.count;
    const open = info.open;

    if (count >= 5) return WIN;
    if (count === 4 && open === 2) return 1_400_000;
    if (count === 4 && open === 1) return 280_000;
    if (count === 3 && open === 2) return 85_000;
    if (count === 3 && open === 1) return 10_000;
    if (count === 2 && open === 2) return 2_600;
    if (count === 2 && open === 1) return 450;
    return 60 + centerScore(r, c);
  }

  function isWin(board, r, c, player) {
    for (const [dr, dc] of DIRS) {
      let count = 1;
      count += countDir(board, r, c, dr, dc, player);
      count += countDir(board, r, c, -dr, -dc, player);
      if (count >= 5) return true;
    }
    return false;
  }

  function countDir(board, r, c, dr, dc, player) {
    let n = 0;
    let nr = r + dr;
    let nc = c + dc;

    while (inside(nr, nc) && board[nr][nc] === player) {
      n++;
      nr += dr;
      nc += dc;
    }

    return n;
  }

  function hasNeighbor(board, r, c, distance) {
    for (let dr = -distance; dr <= distance; dr++) {
      for (let dc = -distance; dc <= distance; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (inside(nr, nc) && board[nr][nc] !== EMPTY) return true;
      }
    }
    return false;
  }

  function centerScore(r, c) {
    return 22 - Math.abs(7 - r) - Math.abs(7 - c);
  }

  function inside(r, c) {
    return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  }

  function hashBoard(board) {
    let h1 = 2166136261;
    let h2 = 16777619;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const p = board[r][c];
        if (p !== EMPTY) {
          const z = zobrist[r][c][p];
          h1 ^= z[0];
          h2 ^= z[1];
        }
      }
    }
    return `${h1 >>> 0}:${h2 >>> 0}`;
  }

  function createZobrist() {
    let seed = 0x9e3779b9;
    const rand = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return seed >>> 0;
    };

    return Array.from({ length: SIZE }, () =>
      Array.from({ length: SIZE }, () => [
        [0, 0],
        [rand(), rand()],
        [rand(), rand()]
      ])
    );
  }

  function saveTable(key, value) {
    if (table.size > MAX_TABLE_SIZE) table.clear();
    table.set(key, value);
  }

  function isTimeout(started, limit) {
    const now = performance.now ? performance.now() : Date.now();
    return now - started > limit;
  }

  return { findBestMove };
})();
