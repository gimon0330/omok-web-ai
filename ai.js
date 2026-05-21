const GomokuAI = (() => {
  const SIZE = 15;
  const EMPTY = 0;
  const HUMAN = 1;
  const AI = 2;
  const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
  const WIN = 10_000_000;

  function findBestMove(board, options = {}) {
    const model = options.model || "search";
    const depth = Number(options.depth || 2);

    if (model === "greedy") return greedyMove(board);
    if (model === "tactical") return tacticalMove(board, depth + 1);
    return searchMove(board, depth);
  }

  function greedyMove(board) {
    const candidates = generateCandidates(board);
    if (candidates.length === 0) return { r: 7, c: 7 };

    const forced = findImmediateTactic(board, candidates);
    if (forced) return forced;

    return candidates
      .map(m => ({ ...m, score: localMoveScore(board, m.r, m.c, AI) + localMoveScore(board, m.r, m.c, HUMAN) * 1.05 }))
      .sort((a, b) => b.score - a.score)[0];
  }

  function searchMove(board, depth) {
    const candidates = generateCandidates(board);
    if (candidates.length === 0) return { r: 7, c: 7 };

    const forced = findImmediateTactic(board, candidates);
    if (forced) return forced;

    let best = candidates[0];
    let bestScore = -Infinity;
    const limit = depth === 3 ? 18 : depth === 2 ? 14 : 10;
    const ordered = orderCandidates(board, candidates, AI, limit);

    for (const m of ordered) {
      board[m.r][m.c] = AI;
      const score = -negamax(board, depth - 1, -Infinity, Infinity, HUMAN);
      board[m.r][m.c] = EMPTY;
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }

    return best;
  }

  function tacticalMove(board, depth) {
    const candidates = generateCandidates(board);
    if (candidates.length === 0) return { r: 7, c: 7 };

    const forced = findImmediateTactic(board, candidates);
    if (forced) return forced;

    const winningThreat = findDoubleThreat(board, AI, candidates);
    if (winningThreat) return winningThreat;

    const blockDoubleThreat = findDoubleThreat(board, HUMAN, candidates);
    if (blockDoubleThreat) return blockDoubleThreat;

    let best = candidates[0];
    let bestScore = -Infinity;
    const limit = depth >= 4 ? 22 : 18;
    const ordered = orderCandidates(board, candidates, AI, limit);

    for (const m of ordered) {
      board[m.r][m.c] = AI;
      const score = -negamax(board, depth - 1, -Infinity, Infinity, HUMAN, true);
      board[m.r][m.c] = EMPTY;

      const tacticalBonus = moveThreatScore(board, m.r, m.c, AI) + moveThreatScore(board, m.r, m.c, HUMAN) * 1.2;
      const finalScore = score + tacticalBonus;

      if (finalScore > bestScore) {
        bestScore = finalScore;
        best = m;
      }
    }

    return best;
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

    const humanOpenFours = candidates.filter(m => createsOpenFour(board, m.r, m.c, HUMAN));
    if (humanOpenFours.length > 0) {
      return humanOpenFours
        .map(m => ({ ...m, score: localMoveScore(board, m.r, m.c, HUMAN) }))
        .sort((a, b) => b.score - a.score)[0];
    }

    return null;
  }

  function findDoubleThreat(board, player, candidates) {
    const moves = [];

    for (const m of candidates) {
      board[m.r][m.c] = player;
      const threats = countStrongThreats(board, m.r, m.c, player);
      board[m.r][m.c] = EMPTY;

      if (threats >= 2) {
        moves.push({ ...m, score: moveThreatScore(board, m.r, m.c, player) });
      }
    }

    if (moves.length === 0) return null;
    return moves.sort((a, b) => b.score - a.score)[0];
  }

  function negamax(board, depth, alpha, beta, player, tactical = false) {
    const opponent = player === AI ? HUMAN : AI;
    if (depth === 0) return evaluate(board, player, tactical);

    const candidates = generateCandidates(board);
    if (candidates.length === 0) return 0;

    const forced = findImmediateForPlayer(board, candidates, player);
    if (forced) return WIN - (4 - depth) * 1000;

    const opponentForced = findImmediateForPlayer(board, candidates, opponent);
    if (opponentForced && depth <= 1) return -WIN + 1000;

    const limit = tactical ? (depth >= 2 ? 16 : 12) : (depth >= 2 ? 12 : 10);
    const ordered = orderCandidates(board, candidates, player, limit);

    let best = -Infinity;
    for (const m of ordered) {
      board[m.r][m.c] = player;
      let score;
      if (isWin(board, m.r, m.c, player)) {
        score = WIN;
      } else {
        score = -negamax(board, depth - 1, -beta, -alpha, opponent, tactical);
      }
      board[m.r][m.c] = EMPTY;

      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
      if (alpha >= beta) break;
    }

    return best;
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

  function orderCandidates(board, candidates, player, limit) {
    const opponent = player === AI ? HUMAN : AI;
    return candidates
      .map(m => ({
        ...m,
        score:
          localMoveScore(board, m.r, m.c, player) * 1.0 +
          localMoveScore(board, m.r, m.c, opponent) * 1.15 +
          centerScore(m.r, m.c) +
          moveThreatScore(board, m.r, m.c, player) * 0.35
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
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
    const raw = aiScore - humanScore * 1.12;
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
      score += moveThreatScore(board, m.r, m.c, player) * 0.08;
    }

    return score;
  }

  function moveThreatScore(board, r, c, player) {
    if (board[r][c] !== EMPTY) return 0;

    board[r][c] = player;
    let score = 0;

    if (isWin(board, r, c, player)) score += WIN;

    const threats = countStrongThreats(board, r, c, player);
    if (threats >= 2) score += 700_000;
    if (createsOpenFour(board, r, c, player)) score += 500_000;
    if (createsFour(board, r, c, player)) score += 120_000;
    if (createsOpenThree(board, r, c, player)) score += 35_000;

    board[r][c] = EMPTY;
    return score;
  }

  function countStrongThreats(board, r, c, player) {
    let threats = 0;

    for (const [dr, dc] of DIRS) {
      const info = lineInfo(board, r, c, dr, dc, player);
      if (info.count >= 4 && info.open >= 1) threats += 2;
      else if (info.count === 3 && info.open === 2) threats += 1;
    }

    return threats;
  }

  function createsOpenFour(board, r, c, player) {
    return DIRS.some(([dr, dc]) => {
      const info = lineInfo(board, r, c, dr, dc, player);
      return info.count === 4 && info.open === 2;
    });
  }

  function createsFour(board, r, c, player) {
    return DIRS.some(([dr, dc]) => {
      const info = lineInfo(board, r, c, dr, dc, player);
      return info.count >= 4 && info.open >= 1;
    });
  }

  function createsOpenThree(board, r, c, player) {
    return DIRS.some(([dr, dc]) => {
      const info = lineInfo(board, r, c, dr, dc, player);
      return info.count === 3 && info.open === 2;
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
    if (len === 4 && open === 2) return 1_200_000;
    if (len === 4 && open === 1) return 220_000;
    if (len === 3 && open === 2) return 55_000;
    if (len === 3 && open === 1) return 7_000;
    if (len === 2 && open === 2) return 1_600;
    if (len === 2 && open === 1) return 250;
    if (len === 1 && open === 2) return 35;
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
    if (count === 4 && open === 2) return 1_200_000;
    if (count === 4 && open === 1) return 240_000;
    if (count === 3 && open === 2) return 65_000;
    if (count === 3 && open === 1) return 8_000;
    if (count === 2 && open === 2) return 2_000;
    if (count === 2 && open === 1) return 300;
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

  function centerScore(r, c) {
    return 18 - Math.abs(7 - r) - Math.abs(7 - c);
  }

  function inside(r, c) {
    return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  }

  return { findBestMove };
})();
