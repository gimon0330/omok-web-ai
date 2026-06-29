const PolicyNetModel = (() => {
  const SIZE = GomokuCore.SIZE;
  const HUMAN = GomokuCore.HUMAN;
  const AI = GomokuCore.AI;
  const modelPromises = new Map();

  async function findBestMove(board, options = {}) {
    const fallback = reason => {
      setFallback(reason);
      return GomokuCore.tacticalMove(board, Number(options.depth || 2) + 1);
    };
    const modelPath = options.modelPath || "./assets/policy-net/model.json";

    if (typeof tf === "undefined") return fallback("tf is undefined");

    try {
      const model = await loadModel(modelPath);

      const candidates = orderCandidates(board, GomokuCore.generateCandidates(board)).slice(0, 32);
      const forced = GomokuCore.findImmediateTactic(board, candidates);
      if (forced) return forced;

      const input = tf.tensor4d([encodeBoard(board)], [1, SIZE, SIZE, 3]);
      const prediction = model.predict(input);
      const policy = await prediction.data();
      input.dispose();
      prediction.dispose();

      return selectMove(board, candidates, policy) || fallback("no selected move");
    } catch (error) {
      const reason = formatError(error);
      console.warn("PolicyNet fallback:", error);
      return fallback(`model load/predict failed: ${reason}`);
    }
  }

  function setFallback(reason) {
    if (typeof self !== "undefined") {
      self.__lastAiFallback = {
        from: "PolicyNetModel",
        reason
      };
    }
  }

  function loadModel(modelPath) {
    if (!modelPromises.has(modelPath)) {
      const promise = tf.loadLayersModel(modelPath).catch(error => {
        modelPromises.delete(modelPath);
        throw error;
      });
      modelPromises.set(modelPath, promise);
    }
    return modelPromises.get(modelPath);
  }

  function formatError(error) {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  function encodeBoard(board) {
    const data = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        data.push(board[r][c] === AI ? 1 : 0);
        data.push(board[r][c] === HUMAN ? 1 : 0);
        data.push(1);
      }
    }
    return data;
  }

  function orderCandidates(board, candidates) {
    return candidates
      .map(move => ({
        ...move,
        tacticalScore: tacticalScore(board, move)
      }))
      .sort((a, b) => b.tacticalScore - a.tacticalScore);
  }

  function selectMove(board, candidates, policy) {
    return candidates
      .map(move => {
        const idx = move.r * SIZE + move.c;
        const prior = policy[idx] || 0;
        return {
          ...move,
          score: prior * 1_000_000 + move.tacticalScore * 0.35
        };
      })
      .sort((a, b) => b.score - a.score)[0];
  }

  function tacticalScore(board, move) {
    return GomokuCore.localMoveScore(board, move.r, move.c, AI)
      + GomokuCore.moveThreatScore(board, move.r, move.c, AI)
      + GomokuCore.moveThreatScore(board, move.r, move.c, HUMAN) * 1.15;
  }

  return { findBestMove };
})();
