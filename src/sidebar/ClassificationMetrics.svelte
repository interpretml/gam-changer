<script>
  import * as d3 from 'd3';
  import { onMount } from 'svelte';
  import { config } from '../config';
  import { round } from '../utils';
  import { drawCurve, drawClassificationBarChart, drawConfusionMatrix } from './draw';

  export let sidebarStore;

  let component = null;
  let sidebarInfo = {};
  let width = 0;
  let height = 0;

  const svgPadding = {top: 10, right: 20, bottom: 40, left: 20};

  let confusionMatrixData = {
    // original: {tn: 23.2, fn: 22.1, fp: 23.2, tp: 23.8},
    // last: {tn: 23.8, fn: 23.8, fp: 23.8, tp: 23.8},
    // current: {tn: 23.8, fn: 23.8, fp: 23.8, tp: 23.8}
    tn: [23.2, null, 23, null],
    fn: [23.2, null, 23, null],
    fp: [23.2, null, 23, null],
    tp: [23.2, null, 23, null]
  };

  // [original, last, current, last last]
  let barData = {
    accuracy: [0.5, null, 0.5, null],
    rocAuc: [0.5, null, 0.5, null],
    balancedAccuracy: [0.5, null, 0.5, null]
  };

  onMount(() => {
    width = component.getBoundingClientRect().width;
    height = component.getBoundingClientRect().height;

    console.log(width, height);

    // Initialize the size of all svgs
    d3.select(component)
      .selectAll('.bar-svg')
      .attr('width', width)
      .attr('height', 500);

  });

  const copyMetricData = (barData, confusionMatrixData, fromIndex, toIndex) => {
    barData.accuracy[toIndex] = barData.accuracy[fromIndex];
    barData.rocAuc[toIndex] = barData.rocAuc[fromIndex];
    barData.balancedAccuracy[toIndex] = barData.balancedAccuracy[fromIndex];

    confusionMatrixData.tn[toIndex] = confusionMatrixData.tn[fromIndex]; 
    confusionMatrixData.fn[toIndex] = confusionMatrixData.fn[fromIndex];
    confusionMatrixData.fp[toIndex] = confusionMatrixData.fp[fromIndex];
    confusionMatrixData.tp[toIndex] = confusionMatrixData.tp[fromIndex];
  };

  sidebarStore.subscribe(value => {
    sidebarInfo = value;

    if (sidebarInfo.curGroup === 'original') {
      barData.accuracy[0] = sidebarInfo.accuracy;
      barData.rocAuc[0] = sidebarInfo.rocAuc;
      barData.balancedAccuracy[0] = sidebarInfo.balancedAccuracy;

      confusionMatrixData.tn[0] = sidebarInfo.confusionMatrix[0] / sidebarInfo.totalSampleNum;
      confusionMatrixData.fn[0] = sidebarInfo.confusionMatrix[1] / sidebarInfo.totalSampleNum;
      confusionMatrixData.fp[0] = sidebarInfo.confusionMatrix[2] / sidebarInfo.totalSampleNum;
      confusionMatrixData.tp[0] = sidebarInfo.confusionMatrix[3] / sidebarInfo.totalSampleNum;
    }

    if (sidebarInfo.curGroup === 'current') {
      barData.accuracy[2] = sidebarInfo.accuracy;
      barData.rocAuc[2] = sidebarInfo.rocAuc;
      barData.balancedAccuracy[2] = sidebarInfo.balancedAccuracy;

      confusionMatrixData.tn[2] = sidebarInfo.confusionMatrix[0] / sidebarInfo.totalSampleNum;
      confusionMatrixData.fn[2] = sidebarInfo.confusionMatrix[1] / sidebarInfo.totalSampleNum;
      confusionMatrixData.fp[2] = sidebarInfo.confusionMatrix[2] / sidebarInfo.totalSampleNum;
      confusionMatrixData.tp[2] = sidebarInfo.confusionMatrix[3] / sidebarInfo.totalSampleNum;
    }

    // Copy current to last, save a copy of last to last last
    if (sidebarInfo.curGroup === 'last') {
      // copyMetricData(barData, confusionMatrixData, 1, 3);
      copyMetricData(barData, confusionMatrixData, 2, 1);
    }

    // Copy last to last last
    if (sidebarInfo.curGroup === 'commit') {
      copyMetricData(barData, confusionMatrixData, 1, 3);
    }

    // Copy last to current, copy last last to last
    if (sidebarInfo.curGroup === 'recover') {
      copyMetricData(barData, confusionMatrixData, 1, 2);
      copyMetricData(barData, confusionMatrixData, 3, 1);
    }

    drawClassificationBarChart(width, svgPadding, component, barData);

    drawConfusionMatrix(width, svgPadding, component, confusionMatrixData);
  });

</script>

<style type='text/scss'>

  @import '../define';

  .metrics-tab {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .metrics {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;

    svg {
      flex-shrink: 0;
    }
  }

  .text {
    width: 100%;
    text-align: center;
  }

  .bar-svg {
    margin-top: 0px;
  }

  .scope-selection {
    margin-top: 15px;
    margin-bottom: 5px;
  }

  .button {
    padding: 1px 11px;
    font-size: 0.9em;
    font-weight: 400;
    height: auto;
    border-color: $gray-border;

    &:hover {
      background: $gray-100;
    }

    &:focus:not(:active) {
      box-shadow: none;
    }
  }

  :global(.metrics-tab text.bar) {
    fill: hsl(230, 100%, 11%);
    font-size: 13px;
  }

  :global(.metrics-tab rect.original) {
    fill: $gray-300;
  }

  :global(.metrics-tab rect.last) {
    fill: $pastel1-orange;
  }

  :global(.metrics-tab rect.current) {
    fill: $pastel1-blue;
  }

  :global(.metrics-tab svg text) {
    cursor: default;
  }

  :global(.metrics-tab .metric-title) {
    dominant-baseline: hanging;
    font-size: 1.1em;
    font-weight: 600;
  }

  :global(.metrics-tab .legend-title) {
    dominant-baseline: hanging;
    text-anchor: middle;
    font-size: 0.8em;
    font-weight: 300;
    fill: $indigo-dark;
  }

  :global(.metrics-tab .bar-label) {
    dominant-baseline: middle;
    text-anchor: start;
    font-size: 0.8em;
    font-weight: 200;
    fill: $indigo-dark;
  }

  :global(.metrics-tab .matrix-label) {
    dominant-baseline: middle;
    text-anchor: middle;
    font-size: 0.8em;
    font-weight: 300;
    fill: $indigo-dark;
  }

  :global(.metrics-tab .matrix-explanation) {
    dominant-baseline: hanging;
    text-anchor: start;
    font-size: 0.7em;
    font-weight: 300;
    fill: hsl(0, 0%, 45%);
  }

  :global(.metrics-tab .dominant-middle) {
    dominant-baseline: middle;
  }
  

</style>

<div class='metrics-tab' bind:this={component}>

    <div class='scope-selection field has-addons'>

      <div class='control'>
        <button class='button' title='undo last edit'>
          <span class='is-small'>
            Global
          </span>
        </button>
      </div>

      <div class='control'>
        <button class='button' title='redo last undo'>
          <span class='is-small'>
            Selected
          </span>
        </button>
      </div>

      <div class='control'>
        <button class='button right-button' title='save edits'>
          <span class='is-small'>
            Slice
          </span>
          <!-- <span style='color: hsla(0, 0%, 0%, 0.2); margin-left: 5px;'>▼</span> -->
        </button>
      </div>

    </div>

  <div class='metrics'>

    <svg class='bar-svg'></svg>

    <!-- <svg class='pr-curve-svg curve-svg'></svg>

    <svg class='roc-curve-svg curve-svg'></svg> -->

  </div>

</div>