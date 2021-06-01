<script>
  import * as d3 from 'd3';
  import { round } from '../utils';
  import { config } from '../config';

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

  const defaultFont = config.defaultFont;

  /**
   * Create a path to indicate the confidence interval for the additive score of
   * categorical variables.
   * @param d
   * @param xScale
   * @param yScale
   */
  const createDotConfidencePath = (d, width, xScale, yScale) => {

    let topMid = {
      x: xScale(d.label),
      y: yScale(d.additive + d.error)
    };

    let btmMid = {
      x: xScale(d.label),
      y: yScale(d.additive - d.error)
    };
    
    // Draw the top line
    let pathStr = `M ${topMid.x - width}, ${topMid.y} L ${topMid.x + width}, ${topMid.y} `;

    // Draw the vertical line
    pathStr = pathStr.concat(`M ${topMid.x}, ${topMid.y} L ${btmMid.x}, ${btmMid.y} `);

    // Draw the bottom line
    pathStr = pathStr.concat(`M ${btmMid.x - width}, ${btmMid.y} L ${btmMid.x + width}, ${btmMid.y} `);

    return pathStr;
  };

  /**
   * Draw the plot in the SVG component
   * @param featureData
   */
  const drawFeature = (featureData) => {
    console.log(featureData);
    let svgSelect = d3.select(svg);

    // For categorical variables, the width depends on the number of levels
    // Level # <= 4 => 300, level # <= 10 => 450, others => 600
    let levelNum = featureData.binLabel.length;
    if (levelNum <= 10) width = 450;
    if (levelNum <= 4) width = 300;

    // Make the svg keep the viewbox 3:2 ratio
    svgWidth = svgHeight * (width / height);

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

    // Some constant lengths of different elements
    const yAxisWidth = 30;

    const chartWidth = width - svgPadding.left - svgPadding.right - yAxisWidth;
    const chartHeight = height - svgPadding.top - svgPadding.bottom - densityHeight;

    let content = svgSelect.append('g')
      .attr('class', 'content')
      .attr('transform', `translate(${svgPadding.left}, ${svgPadding.top})`);

    // let xScale = d3.scaleLinear()
    //   .domain([xMin, xMax])
    //   .range([0, lineChartWidth]);

    console.log(featureData.binLabel);

    let xScale = d3.scalePoint()
      .domain(featureData.binLabel)
      .padding(0.7)
      .range([0, chartWidth])
      .round(true);

    // For the y scale, it seems InterpretML presets the center at 0 (offset
    // doesn't really matter in EBM because we can modify intercept)
    // TODO: Provide interaction for users to change the center point
    // Normalize the Y axis by the global score range
    let yScale = d3.scaleLinear()
      .domain(scoreRange)
      .range([chartHeight, 0]);

    // Create a data array by combining the bin labels, additive terms, and errors
    let additiveData = [];

    for (let i = 0; i < featureData.binLabel.length; i++) {
      additiveData.push({
        label: featureData.binLabel[i],
        additive: featureData.additive[i],
        error: featureData.error[i]
      });
    }

    console.log(additiveData);

    // Create histogram chart group
    let histChart = content.append('g')
      .attr('class', 'hist-chart-group')
      .attr('transform', `translate(${yAxisWidth}, ${chartHeight})`);
    
    // Draw the dot plot
    let scatterPlot = content.append('g')
      .attr('class', 'scatter-plot-group');

    // Create axis group early so it shows up at the bottom
    let axisGroup = scatterPlot.append('g')
      .attr('class', 'axis-group');
    
    let scatterPlotContent = scatterPlot.append('g')
      .attr('class', 'scatter-plot-content-group')
      .attr('transform', `translate(${yAxisWidth}, 0)`);

    let confidenceGroup = scatterPlotContent.append('g')
      .attr('class', 'scatter-plot-confidence-group');

    let scatterGroup = scatterPlotContent.append('g')
      .attr('class', 'scatter-plot-dot-group');

    // We draw the shape function with many line segments (path)
    scatterGroup.selectAll('circle')
      .data(additiveData)
      .join('circle')
      .attr('class', 'additive-dot')
      .attr('cx', d => xScale(d.label))
      .attr('cy', d => yScale(d.additive))
      .attr('r', 3)
      .style('stroke', 'none')
      .style('fill', colors.dot);

    // Draw the underlying confidence interval
    confidenceGroup.selectAll('path')
      .data(additiveData)
      .join('path')
      .attr('class', 'dot-confidence')
      .attr('d', d => createDotConfidencePath(d, 5, xScale, yScale))
      .style('stroke', colors.dotConfidence)
      .style('stroke-width', 2)
      .style('fill', 'none');

    // Draw the chart X axis
    let xAxisGroup = axisGroup.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(${yAxisWidth}, ${chartHeight})`)
      .call(d3.axisBottom(xScale));
    
    xAxisGroup.attr('font-family', defaultFont);
    
    // Draw the chart Y axis
    let yAxisGroup = axisGroup.append('g')
      .attr('class', 'y-axis')
      .attr('transform', `translate(${yAxisWidth}, 0)`);
    
    yAxisGroup.call(d3.axisLeft(yScale));
    yAxisGroup.attr('font-family', defaultFont);
  
    // Add a line to highlight y = 0
    yAxisGroup.append('path')
      .attr('class', 'line-0')
      .attr('d', `M ${0} ${yScale(0)} L ${chartWidth} ${yScale(0)}`)
      .style('stroke', colors.line0)
      .style('stroke-width', 3)
      .style('stroke-dasharray', '15 10');

    yAxisGroup.append('g')
      .attr('class', 'y-axis-text')
      .attr('transform', `translate(${-yAxisWidth - 5}, ${chartHeight / 2}) rotate(-90)`)
      .append('text')
      .text('score')
      .style('fill', 'black');

    // Draw the histograms at the bottom
    let histData = [];
    
    // Transform the count to frequency (percentage)
    let histCountSum = d3.sum(featureData.histCount);
    let histFrequency = featureData.histCount.map(d => d / histCountSum);

    for (let i = 0; i < histFrequency.length; i++) {
      histData.push({
        x1: featureData.histEdge[i],
        x2: featureData.histEdge[i + 1],
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
    let yAxisHistGroup = scatterPlot.append('g')
      .attr('class', 'y-axis')
      .attr('transform', `translate(${yAxisWidth}, ${chartHeight})`);
    
    yAxisHistGroup.call(
      d3.axisLeft(histYScale)
        .ticks(2)
    );

    yAxisHistGroup.attr('font-family', defaultFont);

    // Change 0.0 to 0
    yAxisHistGroup.selectAll('text')
      .style('fill', colors.histAxis)
      .filter((d, i, g) => d3.select(g[i]).text() === '0.0')
      .text('0');

    yAxisHistGroup.selectAll('path,line')
      .style('stroke', colors.histAxis);

    yAxisHistGroup.append('g')
      .attr('transform', `translate(${-yAxisWidth - 5}, ${densityHeight / 2}) rotate(-90)`)
      .append('text')
      .attr('class', 'y-axis-text')
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

  :global(.explain-panel .additive-line-segment) {
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  :global(.explain-panel .hidden) {
    display: none;
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