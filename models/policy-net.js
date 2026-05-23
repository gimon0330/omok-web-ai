const PolicyNetModel = (() => {
  const SIZE = GomokuCore.SIZE;
  const EMPTY = GomokuCore.EMPTY;
  const HUMAN = GomokuCore.HUMAN;
  const AI = GomokuCore.AI;
  let modelPromise = null;

  async function findBestMove(board, options = {}) {
    const fallback = () => GomokuCore.tacticalMove(board, Number(options.depth || 2) + 1);

    if (typeof tf === "undefined") return fallback();

    try {
      const model = await loadModel();
      if (!model) return fallback();

      const candidates = GomokuCore.generateCandidates(board);
      const forced = GomokuCore.findImmediateTactic(board, candidates);
      if (forced) return forced;

      const input = tf.tensor4d([encodeBoard(board)], [1, SIZE, SIZE, 3]);
      const prediction = model.predict(input);
      const policy = await prediction.data();
      input.dispose();
      prediction.dispose();

      return selectMove(board, candidates, policy) || fallback();
    } catch (error) {
      console.warn("PolicyNet fallback:", error);
      return fallback();
    }
  }

  function loadModel() {
    if (!modelPromise) {
      modelPromise = tf.loadLayersModel("./assets/policy-net/model.json")
        .catch(() => null);
    }
    return modelPromise;
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

  function selectMove(board, candidates, policy) {
    return candidates
      .map(move => {
        const idx = move.r * SIZE + move.c;
        const prior = policy[idx] || 0;
        const tactical = GomokuCore.localMoveScore(board, move.r, move.c, AI)
          + GomokuCore.moveThreatScore(board, move.r, move.c, AI)
          + GomokuCore.moveThreatScore(board, move.r, move.c, HUMAN) * 1.15;
        return {
          ...move,
          score: prior * 1_000_000 + tactical * 0.35
        };
      })
      .sort((a, b) => b.score - a.score)[0];
  }

  return { findBestMove };
})();
