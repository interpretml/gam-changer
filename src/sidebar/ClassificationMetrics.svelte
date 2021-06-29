<script>
  import * as d3 from 'd3';
  import { onMount } from 'svelte';
  import { config } from '../config';
  import { round } from '../utils';
  import { drawCurve } from './draw';

  export let sidebarStore;

  let component = null;
  let sidebarInfo = {};
  let width = 0;

  const svgPadding = {top: 10, right: 40, bottom: 40, left: 40};
  const defaultFont = config.defaultFont;

  const groupColors = {
    original: 'gray',
    last: '#FFE9CA',
    current: 'hsl(213, 100%, 53%)',
    axis: 'hsla(0, 0%, 70%, 1)'
  };

  onMount(() => {
    width = component.getBoundingClientRect().width;

    // Initialize the size of all svgs
    d3.select(component)
      .selectAll('.curve-svg')
      .attr('viewBox', '0 0 200 170')
      .attr('preserveAspectRatio', 'xMinYMin meet')
      .attr('width', width)
      .attr('height', width * 170 / 200);

  });

  sidebarStore.subscribe(value => {
    sidebarInfo = value;

    let svgPR = d3.select(component)
      .select('.pr-curve-svg');

    drawCurve(sidebarInfo.prCurve, true, svgPR, sidebarInfo.curGroup, groupColors);

    let svgROC = d3.select(component)
      .select('.roc-curve-svg');

    drawCurve(sidebarInfo.rocCurve, false, svgROC, sidebarInfo.curGroup, groupColors);
  });

</script>

<style type='text/scss'>

  @import '../define';

  .metrics-tab {
    height: 100%;
  }

  .metrics {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
  }

  .text {
    width: 100%;
    text-align: center;
  }

</style>

<div class='metrics-tab' bind:this={component}>

  <div class='metrics'>

    <div class='text' style='margin-top: 10px;'>
      Accuracy: {round(sidebarInfo.accuracy, 4)}
    </div>

    <div class='text'>
      ROC AUC: {round(sidebarInfo.accuracy, 4)}
    </div>

    <div class='text'>
      Average Precision: {round(sidebarInfo.accuracy, 4)}
    </div>

    <svg class='pr-curve-svg curve-svg'></svg>

    <svg class='roc-curve-svg curve-svg'></svg>

  </div>

</div>