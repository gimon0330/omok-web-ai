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

const hasPolicyNet = typeof PolicyNetModel !== "undefined";
const hasValueNet = typeof ValueNetModel !== "undefined";
const policyModel = hasPolicyNet ? PolicyNetModel : TacticalModel;
const valueModel = hasValueNet ? ValueNetModel : TacticalModel;

const models = {
  tactical: {
    engine: TacticalModel,
    engineName: "TacticalModel"
  },
  threat: {
    engine: ThreatSpaceModel,
    engineName: "ThreatSpaceModel"
  },
  mcts: {
    engine: MCTSModel,
    engineName: "MCTSModel"
  },
  policy300: {
    engine: policyModel,
    engineName: hasPolicyNet ? "PolicyNetModel" : "TacticalModel",
    modelPath: "./assets/policy-net/model.json"
  },
  policy5000: {
    engine: policyModel,
    engineName: hasPolicyNet ? "PolicyNetModel" : "TacticalModel",
    modelPath: "./assets/policy-net-1/model.json"
  },
  value: {
    engine: valueModel,
    engineName: hasValueNet ? "ValueNetModel" : "TacticalModel",
    modelPath: "./assets/value-net/model.json"
  }
};

self.onmessage = async event => {
  const { id, board, model, depth } = event.data;
  const started = now();
  const selected = models[model] || models.threat;
  const resolvedModel = models[model] ? model : "threat";

  self.__lastAiFallback = null;

  try {
    const move = await selected.engine.findBestMove(cloneBoard(board), {
      depth,
      modelPath: selected.modelPath
    });

    self.postMessage({
      id,
      move,
      debug: buildDebug({
        requestedModel: model,
        resolvedModel,
        selected,
        depth,
        started
      })
    });
  } catch (error) {
    self.postMessage({
      id,
      move: null,
      error: error instanceof Error ? error.message : String(error),
      debug: buildDebug({
        requestedModel: model,
        resolvedModel,
        selected,
        depth,
        started
      })
    });
  }
};

function buildDebug({ requestedModel, resolvedModel, selected, depth, started }) {
  return {
    requestedModel,
    resolvedModel,
    engineName: selected.engineName,
    depth,
    modelPath: selected.modelPath || null,
    fallback: self.__lastAiFallback || null,
    elapsedMs: Math.round(now() - started)
  };
}

function cloneBoard(board) {
  return board.map(row => row.slice());
}

function now() {
  return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
}
