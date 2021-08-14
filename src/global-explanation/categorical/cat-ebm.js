// EBM methods

export const getEBMMetrics = async (state, ebm, scope = 'global') => {
  // Depending on the selected scope, we have different modes of getMetrics()
  let metrics;

  switch (scope) {
  case 'global':
    metrics = ebm.getMetrics();
    break;
  case 'selected': {
    let selectedBinIndexes = state.selectedInfo.nodeData.map(d => d.id);
    metrics = ebm.getMetricsOnSelectedBins(selectedBinIndexes);
    break;
  }
  case 'slice':
    metrics = ebm.getMetricsOnSelectedSlice();
    break;
  default:
    break;
  }
  return metrics;
};

/**
 * Pass the metrics info to sidebar handler (classification or egression metrics tab)
 * @param metrics Metrics info from the EBM
 * @param curGroup Name of the message
 */
export const transferMetricToSidebar = (metrics, curGroup, ebm, sidebarStore, sidebarInfo) => {
  if (ebm.isClassification) {
    sidebarInfo.accuracy = metrics.accuracy;
    sidebarInfo.rocAuc = metrics.rocAuc;
    sidebarInfo.balancedAccuracy = metrics.balancedAccuracy;
    sidebarInfo.confusionMatrix = metrics.confusionMatrix;
  } else {
    sidebarInfo.rmse = metrics.rmse;
    sidebarInfo.mae = metrics.mae;
    sidebarInfo.mape = metrics.mape;
  }

  sidebarInfo.curGroup = curGroup;

  sidebarStore.set(sidebarInfo);
};


/**
 * Overwrite the edge definition in the EBM WASM model.
 * @param {string} curGroup Message to the metrics sidebar
 * @param {object} curNodeData Node data in `state`
 * @param {featureName} featureName The name of feature to be edited
 * @param {bool} transfer If the new metrics need to be transferred to the sidebar
 */
export const setEBM = async (state, ebm, curGroup, curNodeData, sidebarStore, sidebarInfo,
  featureName = undefined, transfer = true) => {

  // Iterate through the curNodeData
  let newBinEdges = [];
  let newScores = [];

  for (let i = 1; i < Object.keys(curNodeData).length + 1; i++) {
    newBinEdges.push(curNodeData[i].id);
    newScores.push(curNodeData[i].y);
  }

  await ebm.setModel(newBinEdges, newScores, featureName);

  if (transfer) {
    switch (sidebarInfo.effectScope) {
    case 'global': {
      let metrics = await getEBMMetrics(state, ebm, 'global');
      transferMetricToSidebar(metrics, curGroup, ebm, sidebarStore, sidebarInfo);
      break;
    }
    case 'selected': {
      let metrics = await getEBMMetrics(state, ebm, 'selected');
      transferMetricToSidebar(metrics, curGroup, ebm, sidebarStore, sidebarInfo);
      break;
    }
    case 'slice': {
      let metrics = await getEBMMetrics(state, ebm, 'slice');
      transferMetricToSidebar(metrics, curGroup, ebm, sidebarStore, sidebarInfo);
      break;
    }
    default:
      break;
    }
  }
};