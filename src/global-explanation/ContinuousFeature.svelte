<script>
  import * as d3 from 'd3';
  import { round } from '../utils';

  export let featureData = null;
  export let scoreRange = null;
  export let svgHeight = 400;

  let svg = null;

  // Visualization constants
  const svgPadding = {
    top: 30, right: 20, bottom: 30, left: 25
  };
  const densityHeight = 90;

  // Viewbox width and height
  const width = 600;
  const height = 400;

  // Real SVG width
  let svgWidth = svgHeight * (width / height);

  // Show some hidden elements for development
  const showRuler = false;

  // Colors
  const colors = {
    line: 'hsl(222, 80%, 30%)',
    confidence: 'hsl(222, 55%, 96%)',
    hist: 'hsl(222, 10%, 93%)',
    histAxis: 'hsl(222, 10%, 70%)',
    line0: 'hsla(222, 0%, 0%, 5%)'
  };

  const defaultFont = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;';

  /**
   * Create rectangles in SVG path format tracing the standard deviations at each
   * point in the model.
   * @param featureData
   */
  const createConfidenceData = (featureData, xMin, xMax) => {
    let startPointTop = {x: xMin, y: featureData.addictive[0] + featureData.error[0]};

    let confidenceData = [];

    // Left bound
    confidenceData.push({
      x1: startPointTop.x,
      y1: startPointTop.y,
      x2: featureData.binEdge[0],
      y2: featureData.addictive[0] - featureData.error[0]
    });

    for (let i = 0; i < featureData.binEdge.length - 1; i++) {
      let curValue = featureData.addictive[i + 1];
      let curError = featureData.error[i + 1];

      confidenceData.push({
        x1: featureData.binEdge[i],
        y1: curValue + curError,
        x2: featureData.binEdge[i + 1],
        y2: curValue - curError
      });
    }

    // Right bound
    confidenceData.push({
      x1: featureData.binEdge[featureData.binEdge.length - 1],
      y1: featureData.addictive[featureData.binEdge.length] + featureData.error[featureData.binEdge.length],
      x2: xMax,
      y2: featureData.addictive[featureData.binEdge.length] - featureData.error[featureData.binEdge.length]
    });

    return confidenceData;
  };

  /**
   * Create line segments (path) to trace the addictive term at each bin in the
   * model.
   * @param featureData
   * @param xMin
   * @param xMax
   */
  const createAddictiveData = (featureData, xMin, xMax) => {
    let addictiveData = [];

    // Add the left bound
    addictiveData.push({
      sx: xMin,
      sy: featureData.addictive[0],
      tx: featureData.binEdge[0],
      ty: featureData.addictive[1]
    });

    for (let i = 0; i < featureData.binEdge.length - 1; i++) {
      addictiveData.push({
        sx: featureData.binEdge[i],
        sy: featureData.addictive[i + 1],
        tx: featureData.binEdge[i + 1],
        ty: featureData.addictive[i + 2],
      });
    }

    // Add the right bound
    addictiveData.push({
      sx: featureData.binEdge[featureData.binEdge.length - 1],
      sy: featureData.addictive[featureData.binEdge.length],
      tx: xMax,
      ty: featureData.addictive[featureData.binEdge.length]
    });

    return addictiveData;
  };

  /**
   * Draw the plot in the SVG component
   * @param featureData
   */
  const drawFeature = (featureData) => {
    console.log(featureData);
    let svgSelect = d3.select(svg);

    // Set svg viewBox (3:2 WH ratio)
    svgSelect.attr('viewBox', '0 0 600 400')
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

    const lineChartWidth = width - svgPadding.left - svgPadding.right - yAxisWidth;
    const lineChartHeight = height - svgPadding.top - svgPadding.bottom - densityHeight;

    let content = svgSelect.append('g')
      .attr('class', 'content')
      .attr('transform', `translate(${svgPadding.left}, ${svgPadding.top})`);

    // The bins have unequal length, and they are inner edges
    // Here we use the min and max values from the training set as our left and
    // right bounds on the x-axis
    let xMin = featureData.binMin;
    let xMax = featureData.binMax;

    // For the y scale, it seems InterpretML presets the center at 0 (offset
    // doesn't really matter in EBM because we can modify intercept)
    // TODO: Provide interaction for users to change the center point
    let yExtent = d3.extent(featureData.addictive);

    let xScale = d3.scaleLinear()
      .domain([xMin, xMax])
      .range([0, lineChartWidth]);

    // Normalize the Y axis by the global score range
    let yScale = d3.scaleLinear()
      .domain(scoreRange)
      .range([lineChartHeight, 0]);

    // Create a data array by combining the bin edge and addictive terms
    let addictiveData = createAddictiveData(featureData, xMin, xMax);

    console.log(addictiveData);

    console.log(xMin, xMax, yExtent);

    // Create the confidence interval region
    let confidenceData = createConfidenceData(featureData, xMin, xMax);

    // Create histogram chart group
    let histChart = content.append('g')
      .attr('class', 'hist-chart-group')
      .attr('transform', `translate(${yAxisWidth}, ${lineChartHeight})`);
    
    // Draw the line chart
    let lineChart = content.append('g')
      .attr('class', 'line-chart-group');

    let axisGroup = lineChart.append('g')
      .attr('class', 'axis-group');
    
    let lineChartContent = lineChart.append('g')
      .attr('class', 'line-chart-content-group')
      .attr('transform', `translate(${yAxisWidth}, 0)`);

    let confidenceGroup = lineChartContent.append('g')
      .attr('class', 'line-chart-confidence-group');

    let lineGroup = lineChartContent.append('g')
      .attr('class', 'line-chart-line-group');

    // We draw the shape function with many line segments (path)
    lineGroup.selectAll('path')
      .data(addictiveData)
      .join('path')
      .attr('class', 'addictive-line-segment')
      .attr('d', d => {
        return `M ${xScale(d.sx)}, ${yScale(d.sy)} L ${xScale(d.tx)} ${yScale(d.sy)} L ${xScale(d.tx)}, ${yScale(d.ty)}`;
      })
      .style('stroke', colors.line)
      .style('stroke-width', 2)
      .style('fill', 'none');

    // Draw the underlying confidence interval
    confidenceGroup.selectAll('rect')
      .data(confidenceData)
      .join('rect')
      .attr('x', d => xScale(d.x1))
      .attr('y', d => yScale(d.y1))
      .attr('width', d => xScale(d.x2) - xScale(d.x1))
      .attr('height', d => yScale(d.y2) - yScale(d.y1))
      .style('fill', colors.confidence);

    // Draw the line chart X axis
    let xAxisGroup = axisGroup.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(${yAxisWidth}, ${lineChartHeight})`)
      .call(d3.axisBottom(xScale));
    
    xAxisGroup.attr('font-family', defaultFont);
    
    // Draw the line chart Y axis
    let yAxisGroup = axisGroup.append('g')
      .attr('class', 'y-axis')
      .attr('transform', `translate(${yAxisWidth}, 0)`);
    
    yAxisGroup.call(d3.axisLeft(yScale));
    yAxisGroup.attr('font-family', defaultFont);

    yAxisGroup.append('g')
      .attr('class', 'y-axis-text')
      .attr('transform', `translate(${-yAxisWidth - 5}, ${lineChartHeight / 2}) rotate(-90)`)
      .append('text')
      .text('score')
      .style('fill', 'black');

    // Add a line to highlight y = 0
    yAxisGroup.append('path')
      .attr('class', 'line-0')
      .attr('d', `M ${0} ${yScale(0)} L ${lineChartWidth} ${yScale(0)}`)
      .style('stroke', colors.line0)
      .style('stroke-width', 3)
      .style('stroke-dasharray', '15 10');

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
    let yAxisHistGroup = lineChart.append('g')
      .attr('class', 'y-axis')
      .attr('transform', `translate(${yAxisWidth}, ${lineChartHeight})`);
    
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

  :global(.explain-panel .addictive-line-segment) {
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