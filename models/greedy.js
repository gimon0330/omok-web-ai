const GreedyModel = (() => {
  function findBestMove(board) {
    return GomokuCore.greedyMove(board);
  }

  return { findBestMove };
})();
