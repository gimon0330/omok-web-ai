const RenjuRules = (() => {
  const SIZE = 15;
  const EMPTY = 0;
  const BLACK = 1;
  const WHITE = 2;
  const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

  function isForbiddenMove(board, r, c, player) {
    if (player !== BLACK) return false;
    if (!inside(r, c) || board[r][c] !== EMPTY) return true;

    board[r][c] = BLACK;
    const forbidden = isOverline(board, r, c, BLACK)
      || countFours(board, r, c, BLACK) >= 2
      || countOpenThrees(board, r, c, BLACK) >= 2;
    board[r][c] = EMPTY;

    return forbidden;
  }

  function forbiddenReason(board, r, c, player) {
    if (player !== BLACK) return "";
    if (!inside(r, c) || board[r][c] !== EMPTY) return "둘 수 없는 자리입니다.";

    board[r][c] = BLACK;
    let reason = "";
    if (isOverline(board, r, c, BLACK)) reason = "장목 금수입니다.";
    else if (countFours(board, r, c, BLACK) >= 2) reason = "쌍사 금수입니다.";
    else if (countOpenThrees(board, r, c, BLACK) >= 2) reason = "쌍삼 금수입니다.";
    board[r][c] = EMPTY;

    return reason;
  }

  function isWin(board, r, c, player) {
    for (const [dr, dc] of DIRS) {
      const count = 1
        + countDir(board, r, c, dr, dc, player)
        + countDir(board, r, c, -dr, -dc, player);

      if (player === BLACK && count === 5) return true;
      if (player === WHITE && count >= 5) return true;
    }
    return false;
  }

  function isOverline(board, r, c, player) {
    return DIRS.some(([dr, dc]) => {
      const count = 1
        + countDir(board, r, c, dr, dc, player)
        + countDir(board, r, c, -dr, -dc, player);
      return count > 5;
    });
  }

  function countFours(board, r, c, player) {
    let fours = 0;
    for (const [dr, dc] of DIRS) {
      const line = buildLine(board, r, c, dr, dc, player);
      if (hasFourPattern(line)) fours++;
    }
    return fours;
  }

  function countOpenThrees(board, r, c, player) {
    let threes = 0;
    for (const [dr, dc] of DIRS) {
      const line = buildLine(board, r, c, dr, dc, player);
      if (hasOpenThreePattern(line)) threes++;
    }
    return threes;
  }

  function hasFourPattern(line) {
    return line.includes("_XXXX_")
      || line.includes("XXXX_")
      || line.includes("_XXXX")
      || line.includes("XXX_X")
      || line.includes("XX_XX")
      || line.includes("X_XXX");
  }

  function hasOpenThreePattern(line) {
    return line.includes("__XXX__")
      || line.includes("__XX_X__")
      || line.includes("__X_XX__")
      || line.includes("_XX_X_")
      || line.includes("_X_XX_");
  }

  function buildLine(board, r, c, dr, dc, player) {
    let text = "";
    const opponent = player === BLACK ? WHITE : BLACK;

    for (let i = -5; i <= 5; i++) {
      const nr = r + dr * i;
      const nc = c + dc * i;
      if (!inside(nr, nc)) text += "O";
      else if (board[nr][nc] === EMPTY) text += "_";
      else if (board[nr][nc] === player) text += "X";
      else if (board[nr][nc] === opponent) text += "O";
    }

    return text;
  }

  function countDir(board, r, c, dr, dc, player) {
    let count = 0;
    let nr = r + dr;
    let nc = c + dc;
    while (inside(nr, nc) && board[nr][nc] === player) {
      count++;
      nr += dr;
      nc += dc;
    }
    return count;
  }

  function inside(r, c) {
    return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  }

  return {
    BLACK,
    WHITE,
    isForbiddenMove,
    forbiddenReason,
    isWin,
    isOverline,
    countFours,
    countOpenThrees
  };
})();
