importScripts(
  "./rules/renju.js",
  "./models/core.js",
  "./models/tactical.js",
  "./models/threat-space.js",
  "./models/mcts.js"
);

try {
  importScripts("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js");
  importScripts("./models/policy-net.js");
  importScripts("./models/value-net.js");
} catch (error) {
  console.warn("TensorFlow.js unavailable. Neural models will fallback.", error);
}

const policyModel = typeof PolicyNetModel !== "undefined" ? PolicyNetModel : TacticalModel;
const valueModel = typeof ValueNetModel !== "undefined" ? ValueNetModel : TacticalModel;

const models = {
  tactical: { engine: TacticalModel },
  threat: { engine: ThreatSpaceModel },
  mcts: { engine: MCTSModel },
  policy300: {
    engine: policyModel,
    modelPath: "./assets/policy-net/model.json"
  },
  policy5000: {
    engine: policyModel,
    modelPath: "./assets/policy-net-1/model.json"
  },
  value: { engine: valueModel }
};

self.onmessage = async event => {
  const { id, board, model, depth } = event.data;
  const selected = models[model] || models.threat;

  try {
    const move = await selected.engine.findBestMove(cloneBoard(board), {
      depth,
      modelPath: selected.modelPath
    });
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
