const AlphaBetaModel = (() => {
  function findBestMove(board, options = {}) {
    const depth = Number(options.depth || 2);
    return GomokuCore.alphaBetaMove(board, depth);
  }

  return { findBestMove };
})();
