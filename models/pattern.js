const PatternModel = (() => {
  const SIZE = GomokuCore.SIZE;
  const EMPTY = GomokuCore.EMPTY;
  const HUMAN = GomokuCore.HUMAN;
  const AI = GomokuCore.AI;
  const WIN = GomokuCore.WIN;
  const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

  const PATTERNS = [
    ["XXXXX", WIN],
    ["_XXXX_", 2_200_000],
    ["_XXX_X_", 1_500_000],
    ["_XX_XX_", 1_500_000],
    ["XXXX_", 360_000],
    ["_XXXX", 360_000],
    ["_XXX__", 120_000],
    ["__XXX_", 120_000],
    ["_XX_X_", 95_000],
    ["_X_XX_", 95_000],
    ["_XX__", 5_000],
    ["__XX_", 5_000],
    ["_X_X_", 4_000]
  ];

  function findBestMove(board, options = {}) {
    const forced = GomokuCore.findImmediateTactic(board, GomokuCore.generateCandidates(board));
    if (forced) return forced;

    const candidates = GomokuCore.generateCandidates(board);
    if (candidates.length === 0) return { r: 7, c: 7 };

    return candidates
      .map(move => ({ ...move, score: scoreMove(board, move.r, move.c) }))
      .sort((a, b) => b.score - a.score)[0];
  }

  function scoreMove(board, r, c) {
    board[r][c] = AI;
    const attack = patternScoreAround(board, r, c, AI) + GomokuCore.moveThreatScore(board, r, c, AI);
    board[r][c] = EMPTY;

    board[r][c] = HUMAN;
    const defense = patternScoreAround(board, r, c, HUMAN) + GomokuCore.moveThreatScore(board, r, c, HUMAN);
    board[r][c] = EMPTY;

    return attack + defense * 1.32 + centerScore(r, c);
  }

  function patternScoreAround(board, r, c, player) {
    let score = 0;
    for (const [dr, dc] of DIRS) {
      const line = buildLine(board, r, c, dr, dc, player);
      for (const [pattern, value] of PATTERNS) {
        if (line.includes(pattern)) score += value;
      }
    }
    return score;
  }

  function buildLine(board, r, c, dr, dc, player) {
    let text = "";
    const opponent = player === AI ? HUMAN : AI;

    for (let i = -5; i <= 5; i++) {
      const nr = r + dr * i;
      const nc = c + dc * i;
      if (!inside(nr, nc)) {
        text += "O";
      } else if (board[nr][nc] === EMPTY) {
        text += "_";
      } else if (board[nr][nc] === player) {
        text += "X";
      } else if (board[nr][nc] === opponent) {
        text += "O";
      }
    }

    return text;
  }

  function centerScore(r, c) {
    return 30 - Math.abs(7 - r) - Math.abs(7 - c);
  }

  function inside(r, c) {
    return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  }

  return { findBestMove };
})();
