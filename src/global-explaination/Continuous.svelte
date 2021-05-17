<script>
  import * as d3 from 'd3';

  export let featureData = null;
  export let scoreRange = null;

  let svg = null;

  // Visualization constants
  const svgPadding = {
    top: 40, right: 20, bottom: 20, left: 20
  };
  const densityHeight = 120;
  const width = 600;
  const height = 400;

  const defaultFont = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;';

  /**
   * Draw the plot in the SVG component
   * @param featureData
   */
  const drawFeature = (featureData) => {
    console.log(featureData);
    let svgSelect = d3.select(svg);

    // Set svg viewBox (3:2 WH ratio)
    svgSelect.attr('viewBox', '0 0 600 400');

    // Some constant lengths of different elements
    const yAxisWidth = 30;
    const xAxisHeight = 30;

    const lineChartWidth = width - svgPadding.left - svgPadding.right - yAxisWidth;
    const lineChartHeight = height - svgPadding.top - svgPadding.bottom - xAxisHeight - densityHeight;

    let content = svgSelect.append('g')
      .attr('class', 'content')
      .attr('transform', `translate(${svgPadding.left}, ${svgPadding.top})`);

    // The bins have unequal length, and they are inner edges
    // Here we use the min and max values from the training set as our left and
    // right bounds on the x-axis
    let binNum = featureData.binEdge.length;
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
    let addictiveData = [];

    // Add the left bound
    addictiveData.push({x: xMin, y: featureData.addictive[0]});

    for (let i = 0; i < featureData.binEdge.length; i++) {
      addictiveData.push({
        x: featureData.binEdge[i],
        y: featureData.addictive[i + 1]
      })
    }

    console.log(addictiveData);

    console.log(xMin, xMax, yExtent);

    // Draw the line chart
    let lineChart = content.append('g')
      .attr('class', 'line-chart-group');
    
    let lineChartContent = lineChart.append('g')
      .attr('class', 'line-chart-content-group')
      .attr('transform', `translate(${yAxisWidth}, 0)`);
    
    lineChartContent.selectAll('circle')
      .data(addictiveData)
      .join('circle')
      .attr('class', 'addictive-circle')
      .attr('cx', d => xScale(d.x))
      .attr('cy', d => yScale(d.y))
      .attr('r', 1)
      .style('fill', 'skyblue')
      .style('opacity', 0.9);

    // Draw the line chart X axis
    let xAxisGroup = lineChart.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(${yAxisWidth}, ${lineChartHeight})`)
      .call(d3.axisBottom(xScale));
    
    xAxisGroup.attr('font-family', defaultFont);
    
    // Draw the line chart Y axis
    let yAxisGroup = lineChart.append('g')
      .attr('class', 'y-axis')
      .attr('transform', `translate(${yAxisWidth}, 0)`);
    
    yAxisGroup.call(d3.axisLeft(yScale));
    yAxisGroup.attr('font-family', defaultFont);

    yAxisGroup.append('g')
      .attr('class', 'y-axis-text')
      .attr('transform', `translate(${-yAxisWidth - 7}, ${lineChartHeight / 2}) rotate(-90)`)
      .append('text')
      .text('score')
      .style('fill', 'black');

    // content.append('circle')
    //   .attr('r', 100);
  }

  $: featureData && drawFeature(featureData);

</script>

<style type='text/scss'>
  @import '../define';

  $header-height: 2.3rem;

  .explain-panel {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
  }

  .header {
    display: flex;
    height: $header-height;
    padding: 5px 10px;
    border-bottom: 1px solid $gray-border;
  }

  .svg-container {
    width: 100%;
    height: calc(100% - #{$header-height});
  }

  .svg-explainer {
    width: 100%;
    height: 100%;
  }

  :global(.explain-panel .y-axis-text) {
    font-size: 0.9rem;
    text-anchor: middle;
    dominant-baseline: text-bottom;
  }

</style>

<div class='explain-panel'>
  <div class='header'>
    {featureData === null ? ' ' : featureData.name}
  </div>

  <div class='svg-container'>
    <svg class='svg-explainer' bind:this={svg}></svg>
  </div>
  
</div>