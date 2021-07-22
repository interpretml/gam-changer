const initDummyEBM = (_featureData, _sampleData, _editingFeature, _isClassification) => {

  class EBM {
    // Store an instance of WASM EBM
    ebm;

    constructor(featureData, sampleData, editingFeature, isClassification) {

      // Store values for JS object
      this.isClassification = isClassification;
      this.ebm = {};
      this.isDummy = true;
    }

    destroy() {
      this.ebm = {};
    }

    printData() {
      return;
    }

    getProb() {
      return [];
    }

    getScore() {
      return [];
    }

    getPrediction() {
      return [];
    }

    getSelectedSampleNum(binIndexes) {
      return 0;
    }

    getSelectedSampleDist(binIndexes) {
      return [[]];
    }

    getHistBinCounts() {
      return [[]];
    }

    updateModel(changedBinIndexes, changedScores) {
      return;
    }

    setModel(newBinEdges, newScores) {
      return;
    }

    getMetrics() {

      /**
       * (1) regression: [[[RMSE, MAE]]]
       * (2) binary classification: [roc 2D points, [confusion matrix 1D],
       *  [[accuracy, roc auc, balanced accuracy]]]
       */

      // Unpack the return value from getMetrics()
      let metrics = {};
      if (!this.isClassification) {
        metrics.rmse = null;
        metrics.mae = null;
      } else {
        metrics.rocCurve = [];
        metrics.confusionMatrix = [null, null, null, null];
        metrics.accuracy = null;
        metrics.rocAuc = null;
        metrics.balancedAccuracy = null;
      }

      return metrics;
    }

    getMetricsOnSelectedBins(binIndexes) {

      /**
       * (1) regression: [[[RMSE, MAE]]]
       * (2) binary classification: [roc 2D points, [confusion matrix 1D],
       *  [[accuracy, roc auc, balanced accuracy]]]
       */

      // Unpack the return value from getMetrics()
      let metrics = {};
      if (!this.isClassification) {
        metrics.rmse = null;
        metrics.mae = null;
      } else {
        metrics.rocCurve = [];
        metrics.confusionMatrix = [null, null, null, null];
        metrics.accuracy = null;
        metrics.rocAuc = null;
        metrics.balancedAccuracy = null;
      }

      return metrics;
    }

    getMetricsOnSelectedSlice() {
      // Unpack the return value from getMetrics()
      let metrics = {};
      if (!this.isClassification) {
        metrics.rmse = null;
        metrics.mae = null;
      } else {
        metrics.rocCurve = [];
        metrics.confusionMatrix = [null, null, null, null];
        metrics.accuracy = null;
        metrics.rocAuc = null;
        metrics.balancedAccuracy = null;
      }

      return metrics;
    }

    setSliceData(featureID, featureLevel) {
      return;
    }

  }

  let model = new EBM(_featureData, _sampleData, _editingFeature, _isClassification);
  return model;

};

export { initDummyEBM };