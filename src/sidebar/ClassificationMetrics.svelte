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
  let height = 0;

  const svgPadding = {top: 10, right: 40, bottom: 40, left: 40};
  const defaultFont = config.defaultFont;

  const groupColors = {
    original: 'gray',
    last: '#FFE9CA',
    current: 'hsl(213, 100%, 53%)',
    axis: 'hsla(0, 0%, 70%, 1)'
  };

  const groupColorsArray = [
    '#D1D1D1',
    '#FFDFB3',
    '#D67D00'
  ];

  let barData = {
    accuracy: [0.5, 0.5, 0],
    rocAuc: [0.5, 0.5, 0],
    averagePrecision: [0.5, 0.5, 0]
  };

  const drawBarChart = () => {

    const barHeight = 20;
    const labelWidth = 20;

    let svg = d3.select(component)
      .select('.bar-svg');

    if (svg.select('.bar-group').size() === 0 ) {
      let barGroup = svg.append('g')
        .attr('class', 'bar-group')
        .attr('transform', `translate(0, ${10})`);

      barGroup.append('g')
        .attr('class', 'accuracy-group')
        .attr('transform', `translate(${labelWidth}, 0)`)
        .append('text')
        .attr('dominant-baseline', 'hanging')
        .text('Accuracy');

      barGroup.append('g')
        .attr('class', 'rocAuc-group')
        .attr('transform', `translate(${labelWidth}, ${barHeight * 5})`)
        .append('text')
        .attr('dominant-baseline', 'hanging')
        .text('ROC AUC');

      barGroup.append('g')
        .attr('class', 'averagePrecision-group')
        .attr('transform', `translate(${labelWidth}, ${barHeight * 10})`)
        .append('text')
        .attr('dominant-baseline', 'hanging')
        .text('Average Precision');
    }

    let barGroup = svg.select('.bar-group');

    let widthScale = d3.scaleLinear()
      .domain([0, 1])
      .range([0, width - 2 * labelWidth]);

    Object.keys(barData).forEach(k => {

      barGroup.select(`.${k}-group`)
        .selectAll('rect.bar')
        .data(barData[k])
        .join('rect')
        .attr('class', 'bar')
        .attr('y', (d, i) => (i + 1) * (barHeight + 0))
        .attr('width', d => widthScale(d))
        .attr('height', barHeight)
        .style('fill', (d, i) => groupColorsArray[i]);

      barGroup.select(`.${k}-group`)
        .selectAll('text.bar')
        .data(barData[k])
        .join('text')
        .style('text-anchor', 'start')
        .attr('dominant-baseline', 'middle')
        .attr('class', 'bar')
        .attr('x', 3)
        .attr('y', (d, i) => (i + 1) * (barHeight + 0) + barHeight / 2 + 2)
        .text(d => round(d, 4));
    });
  };

  onMount(() => {
    width = component.getBoundingClientRect().width;
    height = component.getBoundingClientRect().height;

    console.log(width, height);

    // Initialize the size of all svgs
    d3.select(component)
      .selectAll('.curve-svg')
      .attr('viewBox', '0 0 200 170')
      .attr('preserveAspectRatio', 'xMinYMin meet')
      .attr('width', width)
      .attr('height', width * 170 / 200);

    // Initialize the size of all svgs
    d3.select(component)
      .selectAll('.bar-svg')
      .attr('width', width)
      .attr('height', 300);

  });

  sidebarStore.subscribe(value => {
    sidebarInfo = value;

    let svgPR = d3.select(component)
      .select('.pr-curve-svg');

    drawCurve(sidebarInfo.prCurve, true, svgPR, sidebarInfo.curGroup, groupColors);

    let svgROC = d3.select(component)
      .select('.roc-curve-svg');

    drawCurve(sidebarInfo.rocCurve, false, svgROC, sidebarInfo.curGroup, groupColors);

    if (sidebarInfo.curGroup === 'original') {
      barData.accuracy[0] = sidebarInfo.accuracy;
      barData.rocAuc[0] = sidebarInfo.rocAuc;
      barData.averagePrecision[0] = sidebarInfo.averagePrecision;
    }

    if (sidebarInfo.curGroup === 'current') {
      barData.accuracy[2] = sidebarInfo.accuracy;
      barData.rocAuc[2] = sidebarInfo.rocAuc;
      barData.averagePrecision[2] = sidebarInfo.averagePrecision;
    }

    drawBarChart();
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

    svg {
      flex-shrink: 0;
    }
  }

  .text {
    width: 100%;
    text-align: center;
  }

  :global(.metrics-tab text.bar) {
    fill: hsl(230, 100%, 11%);
    font-size: 13px;
  }

</style>

<div class='metrics-tab' bind:this={component}>

  <div class='metrics'>

    <svg class='bar-svg'></svg>

    <!-- <div class='text' style='margin-top: 10px;'>
      Accuracy: {round(sidebarInfo.accuracy, 4)}
    </div>

    <div class='text'>
      ROC AUC: {round(sidebarInfo.accuracy, 4)}
    </div>

    <div class='text'>
      Average Precision: {round(sidebarInfo.accuracy, 4)}
    </div> -->

    <svg class='pr-curve-svg curve-svg'></svg>

    <svg class='roc-curve-svg curve-svg'></svg>

  </div>

</div>