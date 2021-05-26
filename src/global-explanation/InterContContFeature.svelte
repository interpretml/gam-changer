<script>
  import * as d3 from 'd3';
  import { round, transpose2dArray } from '../utils';
  import { config } from '../config';
  import { drawHorizontalColorLegend } from './draw';

  export let featureData = null;
  export let scoreRange = null;
  export let svgHeight = 400;

  let svg = null;

  // Visualization constants
  const svgPadding = config.svgPadding;
  const densityHeight = 90;

  // Viewbox width and height
  let width = 600;
  const height = 400;

  // Real width (depends on the svgHeight prop)
  let svgWidth = svgHeight * (width / height);

  // Show some hidden elements for development
  const showRuler = false;

  // Colors
  const colors = config.colors;

  const drawFeatureBar = (featureData) => {
    console.log(featureData);
    let svgSelect = d3.select(svg);

    // Set svg viewBox (3:2 WH ratio)
    svgSelect.attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMinYMin meet')
      .attr('width', svgWidth)
      .attr('height', svgHeight);

    // Draw a border for the svg
    svgSelect.append('rect')
      .attr('class', 'border')
      .classed('hidden', !showRuler)
      .attr('width', 600)
      .attr('height', 400)
      .style('fill', 'none')
      .style('stroke', 'pink');

    let content = svgSelect.append('g')
      .attr('class', 'content')
      .attr('transform', `translate(${svgPadding.left}, ${svgPadding.top})`);

    // Some constant lengths of different elements
    const yAxisWidth = 30;
    const legendConfig = {
      startColor: '#b2182b',
      endColor: '#2166ac',
      width: 180,
      height: 8
    };
    const legendHeight = legendConfig.height + 15;
    
    const chartWidth = width - svgPadding.left - svgPadding.right - yAxisWidth;
    const chartHeight = height - svgPadding.top - svgPadding.bottom - densityHeight - legendHeight;

    // We put continuous 1 on the x-axis
    let xMin = featureData.binLabel1[0];
    let xMax = featureData.binLabel1[featureData.binLabel1.length - 1];

    let xScale = d3.scaleLinear()
      .domain([xMin, xMax])
      .range([0, chartWidth]);

    // Continuous 2 on the y-axis
    let yMin = featureData.binLabel2[0];
    let yMax = featureData.binLabel2[featureData.binLabel2.length - 1];

    let yScale = d3.scaleLinear()
      .domain([yMin, yMax])
      .range([chartHeight, 0]);

    // Create histogram chart group
    let histChart = content.append('g')
      .attr('class', 'hist-chart-group')
      .attr('transform', `translate(${yAxisWidth}, ${chartHeight + legendHeight})`);

    let addictiveData = transpose2dArray(featureData.addictive);

    // Create color scale for the bar chart
    let maxAbsScore = 0;
    featureData.addictive.forEach(curArray => {
      curArray.forEach(d => {
        if (Math.abs(d) > maxAbsScore) maxAbsScore = Math.abs(d);
      });
    });

    // One can consider to use the color scale to encode the global range
    // let maxAbsScore = Math.max(Math.abs(scoreRange[0]), Math.abs(scoreRange[1]));
    let colorScale = d3.scaleLinear()
      .domain([-maxAbsScore, 0, maxAbsScore])
      .range([legendConfig.startColor, 'white', legendConfig.endColor]);

    // Draw the bar chart
    let barChart = content.append('g')
      .attr('transform', `translate(${0}, ${legendHeight})`)
      .attr('class', 'bar-chart-group');
    
    let barChartContent = barChart.append('g')
      .attr('class', 'bar-chart-content-group')
      .attr('transform', `translate(${yAxisWidth}, 0)`);

    let barGroup = barChartContent.append('g')
      .attr('class', 'bar-chart-bar-group');

    let axisGroup = barChart.append('g')
      .attr('class', 'axis-group');

    // Draw the bars one by one (iterate through continuous 2 at y-axis)
    for (let l = 0; l < featureData.addictive[0].length; l++) {
      let curHeight = yScale(featureData.binLabel2[l]) - yScale(featureData.binLabel2[l + 1]);

      barGroup.append('g')
        .attr('class', `bar-group-${l}`)
        .attr('transform', `translate(${0}, ${yScale(featureData.binLabel2[l])})`)
        .selectAll('rect.bar')
        .data(addictiveData[l])
        .join('rect')
        .attr('class', 'bar')
        .attr('x', (d, i) => xScale(featureData.binLabel1[i]))
        .attr('y', -curHeight)
        .attr('width', (d, i) => xScale(featureData.binLabel1[i + 1]) - xScale(featureData.binLabel1[i]))
        .attr('height', curHeight)
        .style('fill', d => colorScale(d));
    }

    // Draw the line chart X axis
    let xAxisGroup = axisGroup.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(${yAxisWidth}, ${chartHeight})`)
      .call(d3.axisBottom(xScale));
    
    xAxisGroup.attr('font-family', config.defaultFont);

    xAxisGroup.append('g')
      .attr('class', 'x-axis-text')
      .attr('transform', `translate(${chartWidth / 2}, ${25})`)
      .append('text')
      .text(featureData.name1)
      .style('fill', 'black');
    
    // Draw the line chart Y axis
    let yAxisGroup = axisGroup.append('g')
      .attr('class', 'y-axis')
      .attr('transform', `translate(${yAxisWidth}, 0)`);
    
    yAxisGroup.call(d3.axisLeft(yScale));
    yAxisGroup.attr('font-family', config.defaultFont);

    yAxisGroup.append('g')
      .attr('class', 'y-axis-text')
      .attr('transform', `translate(${-yAxisWidth - 10}, ${chartHeight / 2}) rotate(-90)`)
      .append('text')
      .text(featureData.name2)
      .style('fill', 'black');
    
    // Draw a color legend
    let legendGroup = content.append('g')
      .attr('class', 'legend-group')
      .attr('transform', `translate(${width - legendConfig.width -
        svgPadding.right - svgPadding.left}, ${-10})`);
    
    drawHorizontalColorLegend(legendGroup, legendConfig, maxAbsScore);

    // Draw the cont histograms at the bottom
    let histData = [];
    
    // Transform the count to frequency (percentage)
    let histCountSum = d3.sum(featureData.histCount1);
    let histFrequency = featureData.histCount1.map(d => d / histCountSum);

    for (let i = 0; i < histFrequency.length; i++) {
      histData.push({
        x1: featureData.histEdge1[i],
        x2: featureData.histEdge1[i + 1],
        height: histFrequency[i]
      });
    }

    let histYScale = d3.scaleLinear()
      .domain(d3.extent(histFrequency))
      .range([0, densityHeight]);

    histChart.selectAll('rect')
      .data(histData)
      .join('rect')
      .attr('class', 'hist-rect')
      .attr('x', d => xScale(d.x1))
      .attr('y', 0)
      .attr('width', d => xScale(d.x2) - xScale(d.x1))
      .attr('height', d => histYScale(d.height))
      .style('fill', colors.hist);
    
    // Draw a Y axis for the histogram chart
    let yAxisHistGroup = barChart.append('g')
      .attr('class', 'y-axis')
      .attr('transform', `translate(${yAxisWidth}, ${chartHeight})`);
    
    yAxisHistGroup.call(
      d3.axisLeft(histYScale)
        .ticks(2)
    );

    yAxisHistGroup.attr('font-family', config.defaultFont);

    // Change 0.0 to 0
    yAxisHistGroup.selectAll('text')
      .style('fill', colors.histAxis)
      .filter((d, i, g) => d3.select(g[i]).text() === '0.0')
      .text('0');

    yAxisHistGroup.selectAll('path,line')
      .style('stroke', colors.histAxis);

    yAxisHistGroup.append('g')
      .attr('class', 'y-axis-text')
      .attr('transform', `translate(${-yAxisWidth - 5}, ${densityHeight / 2}) rotate(-90)`)
      .append('text')
      .text('density')
      .style('fill', colors.histAxis);

  };

  // const drawFeature = drawFeatureLine;
  const drawFeature = drawFeatureBar;

  $: featureData && drawFeature(featureData);

</script>

<style type='text/scss'>
  @import '../define';

  $header-height: 2.3rem;

  .explain-panel {
    display: flex;
    flex-direction: column;
  }

  .header {
    display: flex;
    height: $header-height;
    padding: 5px 10px;
    border-bottom: 1px solid $gray-border;

    .header__name {
      margin-right: 10px;
    }

    .header__importance {
      color: $gray-light;
    }
  }

  :global(.explain-panel .y-axis-text) {
    font-size: 1rem;
    text-anchor: middle;
    dominant-baseline: text-bottom;
  }

  :global(.explain-panel .x-axis-text) {
    font-size: 1rem;
    text-anchor: middle;
    dominant-baseline: hanging;
  }

  :global(.explain-panel .addictive-line-segment) {
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  :global(.explain-panel .hidden) {
    display: none;
  }

  :global(.explain-panel .legend-title) {
    font-size: 0.9rem;
    dominant-baseline: hanging;
  }

  :global(.explain-panel .legend-value) {
    font-size: 13px;
    dominant-baseline: middle;
  }

</style>

<div class='explain-panel'>
  {#if featureData !== null}

    <div class='header'>
      <div class='header__name'>
        {featureData === null ? ' ' : featureData.name}
      </div>
      
      <div class='header__importance'>
        {featureData === null ? ' ': round(featureData.importance, 2)}
      </div>
    </div>

  {/if}


  <div class='svg-container'>
    <svg class='svg-explainer' bind:this={svg}></svg>
  </div>
  
</div>