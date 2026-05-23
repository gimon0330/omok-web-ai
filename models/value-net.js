const ValueNetModel = (() => {
  const SIZE = GomokuCore.SIZE;
  const HUMAN = GomokuCore.HUMAN;
  const AI = GomokuCore.AI;
  let modelPromise = null;

  async function evaluate(board, player = AI) {
    if (typeof tf === "undefined") return null;

    try {
      const model = await loadModel();
      if (!model) return null;

      const input = tf.tensor4d([encodeBoard(board, player)], [1, SIZE, SIZE, 3]);
      const prediction = model.predict(input);
      const data = await prediction.data();
      input.dispose();
      prediction.dispose();
      return Number(data[0]);
    } catch (error) {
      console.warn("ValueNet fallback:", error);
      return null;
    }
  }

  async function findBestMove(board, options = {}) {
    const fallback = () => GomokuCore.tacticalMove(board, Number(options.depth || 2) + 1);

    if (typeof tf === "undefined") return fallback();

    const candidates = orderCandidates(board, GomokuCore.generateCandidates(board)).slice(0, 24);
    const forced = GomokuCore.findImmediateTactic(board, candidates);
    if (forced) return forced;

    const model = await loadModel();
    if (!model) return fallback();

    let best = null;
    let bestScore = -Infinity;

    for (const move of candidates) {
      board[move.r][move.c] = AI;
      const value = await evaluate(board, HUMAN);
      board[move.r][move.c] = 0;

      const netScore = value === null ? -Infinity : -value * 1_000_000;
      const score = netScore + move.tacticalScore * 0.35;

      if (score > bestScore) {
        bestScore = score;
        best = move;
      }
    }

    return best || fallback();
  }

  function loadModel() {
    if (!modelPromise) {
      modelPromise = tf.loadLayersModel("./assets/value-net/model.json")
        .catch(() => null);
    }
    return modelPromise;
  }

  function encodeBoard(board, player) {
    const opponent = player === AI ? HUMAN : AI;
    const data = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        data.push(board[r][c] === player ? 1 : 0);
        data.push(board[r][c] === opponent ? 1 : 0);
        data.push(player === AI ? 1 : 0);
      }
    }
    return data;
  }

  function orderCandidates(board, candidates) {
    return candidates
      .map(move => ({
        ...move,
        tacticalScore: GomokuCore.localMoveScore(board, move.r, move.c, AI)
          + GomokuCore.moveThreatScore(board, move.r, move.c, AI)
          + GomokuCore.moveThreatScore(board, move.r, move.c, HUMAN) * 1.1
      }))
      .sort((a, b) => b.tacticalScore - a.tacticalScore);
  }

  return { evaluate, findBestMove };
})();
