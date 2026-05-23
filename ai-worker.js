importScripts(
  "./models/core.js",
  "./models/greedy.js",
  "./models/alpha-beta.js",
  "./models/tactical.js",
  "./models/pattern.js",
  "./models/threat-space.js"
);

const models = {
  greedy: GreedyModel,
  search: AlphaBetaModel,
  tactical: TacticalModel,
  pattern: PatternModel,
  threat: ThreatSpaceModel
};

self.onmessage = event => {
  const { id, board, model, depth } = event.data;
  const selectedModel = models[model] || models.tactical;

  try {
    const move = selectedModel.findBestMove(cloneBoard(board), { depth });
    self.postMessage({ id, move });
  } catch (error) {
    self.postMessage({
      id,
      move: null,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

function cloneBoard(board) {
  return board.map(row => row.slice());
}
