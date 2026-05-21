const GomokuAI = (() => {
  const SIZE = 15;
  const EMPTY = 0;
  const HUMAN = 1;
  const AI = 2;
  const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

  function findBestMove(board, depth) {
    const candidates = generateCandidates(board);
    if (candidates.length === 0) return { r: 7, c: 7 };

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

    let best = candidates[0];
    let bestScore = -Infinity;
    const limit = depth === 3 ? 18 : depth === 2 ? 14 : 10;
    const ordered = candidates
      .map(m => ({ ...m, score: localMoveScore(board, m.r, m.c, AI) + localMoveScore(board, m.r, m.c, HUMAN) * 0.9 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

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

  function negamax(board, depth, alpha, beta, player) {
    const opponent = player === AI ? HUMAN : AI;
    if (depth === 0) return evaluate(board, player);

    const candidates = generateCandidates(board);
    if (candidates.length === 0) return 0;

    const limit = depth >= 2 ? 12 : 10;
    const ordered = candidates
      .map(m => ({ ...m, score: localMoveScore(board, m.r, m.c, player) + localMoveScore(board, m.r, m.c, opponent) * 0.8 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    let best = -Infinity;
    for (const m of ordered) {
      board[m.r][m.c] = player;
      let score;
      if (isWin(board, m.r, m.c, player)) {
        score = 10_000_000;
      } else {
        score = -negamax(board, depth - 1, -beta, -alpha, opponent);
      }
      board[m.r][m.c] = EMPTY;

      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
      if (alpha >= beta) break;
    }

    return best;
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

  function evaluate(board, playerPerspective) {
    const aiScore = totalScore(board, AI);
    const humanScore = totalScore(board, HUMAN);
    const raw = aiScore - humanScore * 1.08;
    return playerPerspective === AI ? raw : -raw;
  }

  function totalScore(board, player) {
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

    return score;
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

  function localMoveScore(board, r, c, player) {
    board[r][c] = player;
    let score = 0;
    if (isWin(board, r, c, player)) score += 10_000_000;
    for (const [dr, dc] of DIRS) {
      score += localLineScore(board, r, c, dr, dc, player);
    }
    board[r][c] = EMPTY;
    return score;
  }

  function localLineScore(board, r, c, dr, dc, player) {
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

    if (count >= 5) return 10_000_000;
    if (count === 4 && open === 2) return 1_000_000;
    if (count === 4 && open === 1) return 200_000;
    if (count === 3 && open === 2) return 50_000;
    if (count === 3 && open === 1) return 5_000;
    if (count === 2 && open === 2) return 1_500;
    return 50;
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

  function inside(r, c) {
    return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  }

  return { findBestMove };
})();
