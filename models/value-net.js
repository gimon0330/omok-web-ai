const ValueNetModel = (() => {
  const SIZE = GomokuCore.SIZE;
  const HUMAN = GomokuCore.HUMAN;
  const AI = GomokuCore.AI;
  const modelPromises = new Map();

  async function evaluate(board, player = AI, modelPath = "./assets/value-net/model.json") {
    if (typeof tf === "undefined") return null;

    try {
      const model = await loadModel(modelPath);
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
    const fallback = reason => {
      setFallback(reason);
      return GomokuCore.tacticalMove(board, Number(options.depth || 2) + 1);
    };
    const modelPath = options.modelPath || "./assets/value-net/model.json";

    if (typeof tf === "undefined") return fallback("tf is undefined");

    const candidates = orderCandidates(board, GomokuCore.generateCandidates(board)).slice(0, 24);
    const forced = GomokuCore.findImmediateTactic(board, candidates);
    if (forced) return forced;

    const model = await loadModel(modelPath);
    if (!model) return fallback("model load failed");

    let best = null;
    let bestScore = -Infinity;

    for (const move of candidates) {
      board[move.r][move.c] = AI;
      const value = await evaluate(board, HUMAN, modelPath);
      board[move.r][move.c] = 0;

      const netScore = value === null ? -Infinity : -value * 1_000_000;
      const score = netScore + move.tacticalScore * 0.35;

      if (score > bestScore) {
        bestScore = score;
        best = move;
      }
    }

    return best || fallback("no selected move");
  }

  function setFallback(reason) {
    if (typeof self !== "undefined") {
      self.__lastAiFallback = {
        from: "ValueNetModel",
        reason
      };
    }
  }

  function loadModel(modelPath = "./assets/value-net/model.json") {
    if (!modelPromises.has(modelPath)) {
      modelPromises.set(
        modelPath,
        tf.loadLayersModel(modelPath).catch(() => null)
      );
    }
    return modelPromises.get(modelPath);
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
