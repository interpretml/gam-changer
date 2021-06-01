<script>
  import * as d3 from 'd3';
  import { round } from '../utils';
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

  /**
   * Create additiveData which is used to draw dots on the plot.
   * @param {[object]} featureData Original feature data passed from the parent component
   * @param {[object]} data Processed feature data (separated by long/short categorical variables)
   */
  const createAdditiveData = (featureData, data) => {
    let additiveData = [];

    for (let i = 0; i < featureData.additive.length; i++) {
      for (let j = 0; j < featureData.additive[i].length; j++) {
        additiveData.push({
          longLabel: data.longDim === 0 ? data.longBinLabel[i] : data.longBinLabel[j],
          shortLabel: data.longDim === 0 ? data.shortBinLabel[j] : data.shortBinLabel[i],
          additive: featureData.additive[i][j],
          error: featureData.error[i][j]
        });
      }
    }

    return additiveData;
  };

  /**
   * Separate feature data into categorical variable with more & fewer levels
   * @param {object} featureData
   */
  const preProcessData = (featureData) => {
    let data = {};
    let len1 = featureData.binLabel1.length;
    let len2 = featureData.binLabel2.length;

    if (len1 >= len2) {
      data.longBinLabel = featureData.binLabel1;
      data.shortBinLabel = featureData.binLabel2;
      data.longName = featureData.name1;
      data.shortName = featureData.name2;
      data.longHistEdge = featureData.histEdge1;
      data.shortHistEdge = featureData.histEdge2;
      data.longHistCount = featureData.histCount1;
      data.shortHistCount = featureData.histCount2;
      data.longDim = 0;
      data.shortDim = 1;
    } else {
      data.longBinLabel = featureData.binLabel2;
      data.shortBinLabel = featureData.binLabel1;
      data.longName = featureData.name2;
      data.shortName = featureData.name1;
      data.longHistEdge = featureData.histEdge2;
      data.shortHistEdge = featureData.histEdge1;
      data.longHistCount = featureData.histCount2;
      data.shortHistCount = featureData.histCount1;
      data.longDim = 1;
      data.shortDim = 0;
    }

    return data;
  };

  const drawFeature = (featureData) => {
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

    // We want to draw the categorical variable with more levels on the x-axis,
    // and the other one on the y-axis
    let data = preProcessData(featureData);

    console.log(data);

    // Some constant lengths of different elements
    const yAxisWidth = 30;
    const barHeight = 10;
    const legendConfig = {
      startColor: '#b2182b',
      endColor: '#2166ac',
      width: 180,
      height: barHeight * 0.8
    };
    const legendHeight = legendConfig.height + 15;
    
    const chartWidth = width - svgPadding.left - svgPadding.right - yAxisWidth;
    const chartHeight = height - svgPadding.top - svgPadding.bottom - densityHeight - legendHeight;

    // We put longer categorical variable on the x-axis
    let xScale = d3.scalePoint()
      .domain(data.longBinLabel)
      .padding(config.scalePointPadding)
      .range([0, chartWidth])
      .round(true);

    // Shorter categorical variable on the y-axis
    let yScale = d3.scalePoint()
      .domain(data.shortBinLabel)
      .padding(config.scalePointPadding)
      .range([chartHeight, 0])
      .round(true);

    // Create histogram chart group
    let histChart = content.append('g')
      .attr('class', 'hist-chart-group')
      .attr('transform', `translate(${yAxisWidth}, ${chartHeight + legendHeight})`);

    let additiveData = createAdditiveData(featureData, data);
    console.log(additiveData);

    // Create color scale for the bar chart
    let maxAbsScore = 0;
    featureData.additive.forEach(curArray => {
      curArray.forEach(d => {
        if (Math.abs(d) > maxAbsScore) maxAbsScore = Math.abs(d);
      });
    });
    console.log(maxAbsScore);

    // One can consider to use the color scale to encode the global range
    // let maxAbsScore = Math.max(Math.abs(scoreRange[0]), Math.abs(scoreRange[1]));
    let colorScale = d3.scaleLinear()
      .domain([-maxAbsScore, 0, maxAbsScore])
      .range([legendConfig.startColor, 'white', legendConfig.endColor]);

    // Draw the scatter chart
    let scatterChart = content.append('g')
      .attr('transform', `translate(${0}, ${legendHeight})`)
      .attr('class', 'scatter-chart-group');
    
    let scatterChartContent = scatterChart.append('g')
      .attr('class', 'scatter-chart-content-group')
      .attr('transform', `translate(${yAxisWidth}, 0)`);

    let scatterGroup = scatterChartContent.append('g')
      .attr('class', 'scatter-chart-scatter-group');

    let axisGroup = scatterChart.append('g')
      .attr('class', 'axis-group');

    // Draw the scatter plot
    scatterGroup.selectAll('circle.dot')
      .data(additiveData)
      .join('circle')
      .attr('class', 'dot')
      .attr('cx', d => xScale(d.longLabel))
      .attr('cy', d => yScale(d.shortLabel))
      .attr('r', config.catDotRadius)
      .style('fill', d => colorScale(d.additive));


    // Draw the line chart X axis
    let xAxisGroup = axisGroup.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(${yAxisWidth}, ${chartHeight})`)
      .call(d3.axisBottom(xScale));
    
    xAxisGroup.attr('font-family', config.defaultFont);

    xAxisGroup.append('g')
      .attr('transform', `translate(${chartWidth / 2}, ${25})`)
      .append('text')
      .attr('class', 'x-axis-text')
      .text(data.longName)
      .style('fill', 'black');
    
    // Draw the line chart Y axis
    let yAxisGroup = axisGroup.append('g')
      .attr('class', 'y-axis')
      .attr('transform', `translate(${yAxisWidth}, 0)`);
    
    yAxisGroup.call(d3.axisLeft(yScale));
    yAxisGroup.attr('font-family', config.defaultFont);

    yAxisGroup.append('g')
      .attr('transform', `translate(${-yAxisWidth - 5}, ${chartHeight / 2}) rotate(-90)`)
      .append('text')
      .attr('class', 'y-axis-text')
      .text(data.shortName)
      .style('fill', 'black');

    // Draw a color legend
    let legendGroup = content.append('g')
      .attr('class', 'legend-group')
      .attr('transform', `translate(${width - legendConfig.width -
        xScale.step() * config.scalePointPadding - svgPadding.right -
        svgPadding.left}, ${-5})`);
    
    drawHorizontalColorLegend(legendGroup, legendConfig, maxAbsScore);

    // Draw the cont histograms at the bottom
    let histData = [];
    
    // Transform the count to frequency (percentage)
    let histCountSum = d3.sum(data.longHistCount);
    let histFrequency = data.longHistCount.map(d => d / histCountSum);

    for (let i = 0; i < histFrequency.length; i++) {
      histData.push({
        x1: data.longHistEdge[i],
        x2: data.longHistEdge[i + 1],
        height: histFrequency[i]
      });
    }

    let histYScale = d3.scaleLinear()
      .domain(d3.extent(histFrequency))
      .range([0, densityHeight]);

    let histWidth = Math.min(30, xScale(histData[0].x2) - xScale(histData[0].x1));

    histChart.selectAll('rect')
      .data(histData)
      .join('rect')
      .attr('class', 'hist-rect')
      .attr('x', d => xScale(d.x1) - histWidth / 2)
      .attr('y', 0)
      .attr('width', histWidth)
      .attr('height', d => histYScale(d.height))
      .style('fill', colors.hist);
    
    // Draw a Y axis for the histogram chart
    let yAxisHistGroup = scatterChart.append('g')
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

  $: featureData && drawFeature(featureData);

</script>

<style type='text/scss'>
  @import '../define';

  .explain-panel {
    display: flex;
    flex-direction: column;
  }

  .header {
    display: flex;
    height: $explanation-header-height;
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
    font-size: 16px;
    text-anchor: middle;
    dominant-baseline: text-bottom;
  }

  :global(.explain-panel .x-axis-text) {
    font-size: 16px;
    text-anchor: middle;
    dominant-baseline: hanging;
  }

  :global(.explain-panel .additive-line-segment) {
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  :global(.explain-panel .hidden) {
    display: none;
  }

  :global(.explain-panel .legend-title) {
    font-size: 0.9em;
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