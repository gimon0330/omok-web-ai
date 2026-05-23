const MCTSModel = (() => {
  const SIZE = GomokuCore.SIZE;
  const EMPTY = GomokuCore.EMPTY;
  const HUMAN = GomokuCore.HUMAN;
  const AI = GomokuCore.AI;
  const WIN = GomokuCore.WIN;
  const C = 1.35;

  function findBestMove(board, options = {}) {
    const depth = Number(options.depth || 2);
    const candidates = GomokuCore.generateCandidates(board);
    if (candidates.length === 0) return { r: 7, c: 7 };

    const forced = GomokuCore.findImmediateTactic(board, candidates);
    if (forced) return forced;

    const budget = depth === 1 ? 160 : depth === 2 ? 320 : 520;
    const root = createNode(null, null, AI, cloneBoard(board));
    root.untried = orderedCandidates(root.board, AI).slice(0, depth === 3 ? 18 : 14);

    const started = now();
    const timeLimit = depth === 1 ? 420 : depth === 2 ? 720 : 1050;
    let iterations = 0;

    while (iterations < budget && now() - started < timeLimit) {
      const node = treePolicy(root);
      const result = rollout(node.board, node.playerToMove, depth);
      backup(node, result);
      iterations++;
    }

    if (root.children.length === 0) {
      return GomokuCore.tacticalMove(board, depth + 1);
    }

    return root.children
      .sort((a, b) => b.visits - a.visits || averageValue(b) - averageValue(a))[0].move;
  }

  function treePolicy(node) {
    while (!terminalWinner(node.board)) {
      if (node.untried.length > 0) return expand(node);
      if (node.children.length === 0) return node;
      node = bestUCT(node);
    }
    return node;
  }

  function expand(node) {
    const move = node.untried.shift();
    const nextBoard = cloneBoard(node.board);
    nextBoard[move.r][move.c] = node.playerToMove;

    const nextPlayer = node.playerToMove === AI ? HUMAN : AI;
    const child = createNode(node, move, nextPlayer, nextBoard);
    child.prior = normalizePrior(move.score);
    child.untried = orderedCandidates(nextBoard, nextPlayer).slice(0, 10);
    node.children.push(child);
    return child;
  }

  function bestUCT(node) {
    const total = Math.max(1, node.visits);
    return node.children
      .map(child => {
        const exploitation = averageValue(child);
        const exploration = C * Math.sqrt(Math.log(total + 1) / (child.visits + 1));
        const prior = child.prior * Math.sqrt(total) / (child.visits + 1);
        return { child, score: exploitation + exploration + prior };
      })
      .sort((a, b) => b.score - a.score)[0].child;
  }

  function rollout(board, playerToMove, depth) {
    const sim = cloneBoard(board);
    let player = playerToMove;
    const maxPlies = depth === 1 ? 18 : depth === 2 ? 26 : 34;

    for (let ply = 0; ply < maxPlies; ply++) {
      const winner = terminalWinner(sim);
      if (winner) return scoreWinner(winner);

      const move = rolloutMove(sim, player);
      if (!move) break;

      sim[move.r][move.c] = player;
      player = player === AI ? HUMAN : AI;
    }

    return heuristicResult(sim);
  }

  function rolloutMove(board, player) {
    const candidates = orderedCandidates(board, player).slice(0, 8);
    if (candidates.length === 0) return null;

    const forced = immediateMove(board, player, candidates);
    if (forced) return forced;

    const opponent = player === AI ? HUMAN : AI;
    const block = immediateMove(board, opponent, candidates);
    if (block) return block;

    return weightedPick(candidates);
  }

  function immediateMove(board, player, candidates) {
    for (const move of candidates) {
      board[move.r][move.c] = player;
      const win = isFive(board, move.r, move.c, player);
      board[move.r][move.c] = EMPTY;
      if (win) return move;
    }
    return null;
  }

  function orderedCandidates(board, player) {
    const opponent = player === AI ? HUMAN : AI;
    return GomokuCore.generateCandidates(board)
      .map(move => {
        const attack = GomokuCore.localMoveScore(board, move.r, move.c, player);
        const defense = GomokuCore.localMoveScore(board, move.r, move.c, opponent);
        const threat = GomokuCore.moveThreatScore(board, move.r, move.c, player);
        const blockThreat = GomokuCore.moveThreatScore(board, move.r, move.c, opponent);
        return {
          ...move,
          score: attack + defense * 1.2 + threat * 0.9 + blockThreat * 1.0 + centerScore(move.r, move.c)
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  function weightedPick(candidates) {
    const weights = candidates.map(move => Math.max(1, Math.log(Math.max(2, move.score))));
    const sum = weights.reduce((a, b) => a + b, 0);
    let target = Math.random() * sum;

    for (let i = 0; i < candidates.length; i++) {
      target -= weights[i];
      if (target <= 0) return candidates[i];
    }

    return candidates[0];
  }

  function backup(node, result) {
    while (node) {
      node.visits++;
      node.value += result;
      node = node.parent;
    }
  }

  function heuristicResult(board) {
    const aiBest = bestLocalScore(board, AI);
    const humanBest = bestLocalScore(board, HUMAN);
    const diff = aiBest - humanBest * 1.08;
    return Math.max(-1, Math.min(1, diff / 1_000_000));
  }

  function bestLocalScore(board, player) {
    const candidates = GomokuCore.generateCandidates(board).slice(0, 24);
    if (candidates.length === 0) return 0;
    return Math.max(...candidates.map(move =>
      GomokuCore.localMoveScore(board, move.r, move.c, player) +
      GomokuCore.moveThreatScore(board, move.r, move.c, player)
    ));
  }

  function terminalWinner(board) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] !== EMPTY && isFive(board, r, c, board[r][c])) {
          return board[r][c];
        }
      }
    }
    return null;
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
    while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === player) {
      count++;
      nr += dr;
      nc += dc;
    }
    return count;
  }

  function createNode(parent, move, playerToMove, board) {
    return {
      parent,
      move,
      playerToMove,
      board,
      children: [],
      untried: [],
      visits: 0,
      value: 0,
      prior: 0
    };
  }

  function averageValue(node) {
    if (node.visits === 0) return 0;
    return node.value / node.visits;
  }

  function normalizePrior(score) {
    return Math.max(0, Math.min(1.5, Math.log(Math.max(2, score)) / 16));
  }

  function scoreWinner(winner) {
    if (winner === AI) return 1;
    if (winner === HUMAN) return -1;
    return 0;
  }

  function centerScore(r, c) {
    return 25 - Math.abs(7 - r) - Math.abs(7 - c);
  }

  function cloneBoard(board) {
    return board.map(row => row.slice());
  }

  function now() {
    return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
  }

  return { findBestMove };
})();
