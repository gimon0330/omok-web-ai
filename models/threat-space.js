const ThreatSpaceModel = (() => {
  const AI = GomokuCore.AI;
  const HUMAN = GomokuCore.HUMAN;
  const EMPTY = GomokuCore.EMPTY;
  const WIN = GomokuCore.WIN;

  function findBestMove(board, options = {}) {
    const depth = Number(options.depth || 2) + 2;
    const candidates = GomokuCore.generateCandidates(board);
    if (candidates.length === 0) return { r: 7, c: 7 };

    const forced = GomokuCore.findImmediateTactic(board, candidates);
    if (forced) return forced;

    const attackingWin = findForcingWin(board, AI, depth);
    if (attackingWin) return attackingWin;

    const defensiveBlock = findForcingWin(board, HUMAN, depth);
    if (defensiveBlock) return defensiveBlock;

    return GomokuCore.tacticalMove(board, depth);
  }

  function findForcingWin(board, player, depth) {
    const moves = forcingMoves(board, player);
    for (const move of moves) {
      board[move.r][move.c] = player;
      const winsNow = isFive(board, move.r, move.c, player);
      const forced = winsNow || proveThreat(board, player, depth - 1);
      board[move.r][move.c] = EMPTY;
      if (forced) return move;
    }
    return null;
  }

  function proveThreat(board, attacker, depth) {
    if (depth <= 0) return false;

    const defender = attacker === AI ? HUMAN : AI;
    const immediateAttacks = winningMoves(board, attacker);
    if (immediateAttacks.length >= 2) return true;
    if (immediateAttacks.length === 1) {
      const block = immediateAttacks[0];
      board[block.r][block.c] = defender;
      const stillWinning = findForcingWin(board, attacker, depth - 1);
      board[block.r][block.c] = EMPTY;
      return Boolean(stillWinning);
    }

    const threats = forcingMoves(board, attacker).slice(0, 8);
    for (const threat of threats) {
      board[threat.r][threat.c] = attacker;
      const responses = defensiveResponses(board, attacker, defender).slice(0, 8);

      if (responses.length === 0) {
        board[threat.r][threat.c] = EMPTY;
        return true;
      }

      let allResponsesLose = true;
      for (const response of responses) {
        board[response.r][response.c] = defender;
        const next = proveThreat(board, attacker, depth - 1);
        board[response.r][response.c] = EMPTY;
        if (!next) {
          allResponsesLose = false;
          break;
        }
      }

      board[threat.r][threat.c] = EMPTY;
      if (allResponsesLose) return true;
    }

    return false;
  }

  function forcingMoves(board, player) {
    return GomokuCore.generateCandidates(board)
      .map(move => ({
        ...move,
        score: GomokuCore.moveThreatScore(board, move.r, move.c, player) + GomokuCore.localMoveScore(board, move.r, move.c, player)
      }))
      .filter(move => move.score >= 100_000)
      .sort((a, b) => b.score - a.score);
  }

  function defensiveResponses(board, attacker, defender) {
    const wins = winningMoves(board, attacker);
    if (wins.length > 0) return wins;

    return GomokuCore.generateCandidates(board)
      .map(move => ({
        ...move,
        score: GomokuCore.moveThreatScore(board, move.r, move.c, attacker) + GomokuCore.localMoveScore(board, move.r, move.c, defender)
      }))
      .filter(move => move.score >= 80_000)
      .sort((a, b) => b.score - a.score);
  }

  function winningMoves(board, player) {
    const moves = [];
    for (const move of GomokuCore.generateCandidates(board)) {
      board[move.r][move.c] = player;
      const win = isFive(board, move.r, move.c, player);
      board[move.r][move.c] = EMPTY;
      if (win) moves.push(move);
    }
    return moves;
  }

  function isFive(board, r, c, player) {
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const [dr, dc] of dirs) {
      let count = 1;
      count += countDir(board, r, c, dr, dc, player);
      count += countDir(board, r, c, -dr, -dc, player);
      if (count >= 5) return true;
    }
    return false;
  }

  function countDir(board, r, c, dr, dc, player) {
    let count = 0;
    let nr = r + dr;
    let nc = c + dc;
    while (nr >= 0 && nr < 15 && nc >= 0 && nc < 15 && board[nr][nc] === player) {
      count++;
      nr += dr;
      nc += dc;
    }
    return count;
  }

  return { findBestMove };
})();
