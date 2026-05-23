importScripts(
  "./models/core.js",
  "./models/greedy.js",
  "./models/alpha-beta.js",
  "./models/tactical.js",
  "./models/pattern.js",
  "./models/threat-space.js",
  "./models/mcts.js"
);

try {
  importScripts("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js");
  importScripts("./models/policy-net.js");
} catch (error) {
  console.warn("TensorFlow.js unavailable. PolicyNet will fallback.", error);
}

const models = {
  greedy: GreedyModel,
  search: AlphaBetaModel,
  tactical: TacticalModel,
  pattern: PatternModel,
  threat: ThreatSpaceModel,
  mcts: MCTSModel,
  policy: typeof PolicyNetModel !== "undefined" ? PolicyNetModel : TacticalModel
};

self.onmessage = async event => {
  const { id, board, model, depth } = event.data;
  const selectedModel = models[model] || models.tactical;

  try {
    const move = await selectedModel.findBestMove(cloneBoard(board), { depth });
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
