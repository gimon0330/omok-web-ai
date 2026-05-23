const TacticalModel = (() => {
  function findBestMove(board, options = {}) {
    const depth = Number(options.depth || 2) + 1;
    return GomokuCore.tacticalMove(board, depth);
  }

  return { findBestMove };
})();
