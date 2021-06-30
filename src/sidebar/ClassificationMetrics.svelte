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
    accuracy: [0.5, 0.5, 0.5],
    rocAuc: [0.5, 0.5, 0.5],
    averagePrecision: [0.5, 0.5, 0.5]
  };

  const drawBarChart = () => {

    const barHeight = 20;
    const textHeight = 22;
    const labelWidth = 20;

    const lineY = barHeight * 3 + textHeight + 12;
    const lineWidth = width - 2 * labelWidth;

    let svg = d3.select(component)
      .select('.bar-svg');

    const groupData = [
      {name: 'accuracy', text: 'Accuracy'},
      {name: 'rocAuc', text: 'ROC AUC'},
      {name: 'averagePrecision', text: 'Average Precision'},
      {name: 'confusionMatrix', text: 'Confusion Matrix'}
    ];

    // Initialize the group structure if it is the first call
    if (svg.select('.bar-group').size() === 0 ) {
      let barGroup = svg.append('g')
        .attr('class', 'bar-group')
        .attr('transform', `translate(0, ${10})`);

      // Add three bar chart groups
      let bars = barGroup.selectAll('g.bar')
        .data(groupData)
        .join('g')
        .attr('class', d => `bar ${d.name}-group`)
        .attr('transform', (d, i) => `translate(${labelWidth}, ${i * (4 * barHeight + textHeight)})`);
      
      bars.append('text')
        .attr('class', 'metric-title')
        .text(d => d.text);

      bars.append('path')
        .attr('d', `M ${0}, ${lineY} L ${lineWidth}, ${lineY}`)
        .style('stroke', 'hsla(0, 0%, 0%, 0.2)');

      // Add color legend next to Accuracy
      let legendGroup = barGroup.select('g.accuracy-group');

      const legendData = [
        {name: 'origin', class: 'original', width: 42, x: 0},
        {name: 'last', class: 'last', width: 28, x: 47},
        {name: 'current', class: 'current', width: 50, x: 80}
      ];

      let items = legendGroup.selectAll('g.legend-item')
        .data(legendData)
        .join('g')
        .attr('transform', d => `translate(${90 + d.x}, 0)`);
      
      items.append('rect')
        .attr('width', d => d.width)
        .attr('height', 16)
        .attr('rx', 3)
        .attr('class', d => d.class);

      items.append('text')
        .attr('class', 'legend-title')
        .attr('y', 2)
        .attr('x', d => d.width / 2)
        .text(d => d.name);
    }

    let barGroup = svg.select('.bar-group');

    let widthScale = d3.scaleLinear()
      .domain([0, 1])
      .range([0, width - 2 * labelWidth]);

    const rectOrder = ['original', 'last', 'current'];

    Object.keys(barData).forEach(k => {

      barGroup.select(`.${k}-group`)
        .selectAll('rect.bar')
        .data(barData[k])
        .join('rect')
        .attr('class', (d, i) => `bar ${rectOrder[i]}`)
        .attr('y', (d, i) => (i) * (barHeight + 0) + textHeight)
        .attr('width', d => widthScale(d))
        .attr('height', barHeight);

      barGroup.select(`.${k}-group`)
        .selectAll('text.bar')
        .data(barData[k])
        .join('text')
        .attr('class', 'bar-label')
        .attr('x', 3)
        .attr('y', (d, i) => (i) * (barHeight + 0) + barHeight / 2 + 2 + textHeight)
        .text(d => round(d, 4));
    });
  };

  onMount(() => {
    width = component.getBoundingClientRect().width;
    height = component.getBoundingClientRect().height;

    console.log(width, height);

    // Initialize the size of all svgs
    d3.select(component)
      .selectAll('.bar-svg')
      .attr('width', width)
      .attr('height', 400);

  });

  sidebarStore.subscribe(value => {
    sidebarInfo = value;

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

  .bar-svg {
    margin-top: 15px;
  }

  :global(.metrics-tab text.bar) {
    fill: hsl(230, 100%, 11%);
    font-size: 13px;
  }

  :global(.metrics-tab rect.original) {
    // fill: $blue-dark;
    fill: $gray-300;
  }

  :global(.metrics-tab rect.last) {
    // fill: $orange-400;
    fill: $pastel1-orange;
  }

  :global(.metrics-tab rect.current) {
    // fill: $blue-icon;
    fill: $pastel1-blue;
  }

  :global(.metrics-tab .metric-title) {
    dominant-baseline: hanging;
    font-size: 1.1em;
    font-weight: 800;
  }

  :global(.metrics-tab .legend-title) {
    dominant-baseline: hanging;
    text-anchor: middle;
    font-size: 0.8em;
    font-weight: 200;
    fill: $indigo-dark;
  }

  :global(.metrics-tab .bar-label) {
    dominant-baseline: middle;
    text-anchor: start;
    fill: $indigo-dark;
    font-size: 0.8em;
    font-weight: 200;
  }

</style>

<div class='metrics-tab' bind:this={component}>

  <div class='metrics'>

    <svg class='bar-svg'></svg>

    <!-- <svg class='pr-curve-svg curve-svg'></svg>

    <svg class='roc-curve-svg curve-svg'></svg> -->

  </div>

</div>