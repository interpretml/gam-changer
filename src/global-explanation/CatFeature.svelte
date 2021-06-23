<script>
  import * as d3 from 'd3';
  import { round } from '../utils';
  import { config } from '../config';

  import { zoomStart, zoomEnd, zoomed, zoomScaleExtent, rExtent } from './categorical/cat-zoom';

  import ToggleSwitch from '../components/ToggleSwitch.svelte';
  import ContextMenu from '../components/ContextMenu.svelte';

  export let featureData = null;
  export let scoreRange = null;
  export let svgHeight = 400;

  let svg = null;
  let component = null;

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

  // Some styles
  const colors = config.colors;
  const defaultFont = config.defaultFont;

  // Select mode
  let selectMode = false;

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
      .attr('class', 'hist-chart-group');

    // For the histogram clippath, need to carefully play around with the
    // transformation, the path should be in a static group; the group having
    // clip-path attr should be static. Therefore we apply the transformation to
    // histChart's child later.
    histChart.append('clipPath')
      .attr('id', `${featureData.name.replace(/\s/g, '')}-hist-chart-clip`)
      .append('rect')
      .attr('x', yAxisWidth)
      .attr('y', chartHeight)
      .attr('width', chartWidth)
      .attr('height', densityHeight);
    
    histChart.attr('clip-path', `url(#${featureData.name.replace(/\s/g, '')}-hist-chart-clip)`);
    
    // Draw the dot plot
    let scatterPlot = content.append('g')
      .attr('class', 'scatter-plot-group');

    scatterPlot.append('clipPath')
      .attr('id', `${featureData.name.replace(/\s/g, '')}-chart-clip`)
      .append('rect')
      .attr('width', chartWidth)
      .attr('height', chartHeight - 1);

    scatterPlot.append('clipPath')
      .attr('id', `${featureData.name.replace(/\s/g, '')}-x-axis-clip`)
      .append('rect')
      .attr('x', yAxisWidth)
      .attr('y', chartHeight)
      .attr('width', chartWidth)
      .attr('height', densityHeight);

    // Create axis group early so it shows up at the bottom
    let axisGroup = scatterPlot.append('g')
      .attr('class', 'axis-group');
    
    let scatterPlotContent = scatterPlot.append('g')
      .attr('class', 'scatter-plot-content-group')
      .attr('clip-path', `url(#${featureData.name.replace(/\s/g, '')}-chart-clip)`)
      .attr('transform', `translate(${yAxisWidth}, 0)`);

    // Append a rect so we can listen to events
    scatterPlotContent.append('rect')
      .attr('width', chartWidth)
      .attr('height', chartHeight)
      .style('opacity', 0);

    // Create a group to draw grids
    scatterPlotContent.append('g')
      .attr('class', 'scatter-plot-grid-group');

    let barGroup = scatterPlotContent.append('g')
      .attr('class', 'scatter-plot-bar-group');

    let confidenceGroup = scatterPlotContent.append('g')
      .attr('class', 'scatter-plot-confidence-group');

    let scatterGroup = scatterPlotContent.append('g')
      .attr('class', 'scatter-plot-dot-group');

    const barWidth = Math.min(30, xScale(additiveData[1].label) - xScale(additiveData[0].label));

    // We draw bars from the 0 baseline to the dot position
    barGroup.style('fill', colors.bar)
      .selectAll('rect')
      .data(additiveData)
      .join('rect')
      .attr('class', 'additive-bar')
      .attr('x', d => xScale(d.label) - barWidth / 2)
      .attr('y', d => d.additive > 0 ? yScale(d.additive) : yScale(0))
      .attr('width', barWidth)
      .attr('height', d => Math.abs(yScale(d.additive) - yScale(0)));

    // We draw the shape function with many line segments (path)
    scatterGroup.selectAll('circle')
      .data(additiveData)
      .join('circle')
      .attr('class', 'additive-dot')
      .attr('cx', d => xScale(d.label))
      .attr('cy', d => yScale(d.additive))
      .attr('r', rExtent[0])
      .style('stroke-width', 1)
      .style('stroke', 'white')
      .style('fill', 'hsl(213, 100%, 53%)');

    // Draw the underlying confidence interval
    confidenceGroup.style('stroke', colors.dotConfidence)
      .style('stroke-width', 2)
      .selectAll('path')
      .data(additiveData)
      .join('path')
      .attr('class', 'dot-confidence')
      .attr('d', d => createDotConfidencePath(d, 5, xScale, yScale))
      .style('fill', 'none');

    // Draw the chart X axis
    // Hack: create a wrapper so we can apply clip before transformation
    let xAxisGroup = axisGroup.append('g')
      .attr('class', 'x-axis-wrapper')
      .attr('clip-path', `url(#${featureData.name.replace(/\s/g, '')}-x-axis-clip)`)
      .append('g')
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

    // Draw the density histogram 
    let histChartContent = histChart.append('g')
      .attr('class', 'hist-chart-content-group')
      .attr('transform', `translate(${yAxisWidth}, ${chartHeight})`);

    histChartContent.selectAll('rect')
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

    // Add panning and zooming
    let zoom = d3.zoom()
      .scaleExtent(zoomScaleExtent)
      .translateExtent([[0, -Infinity], [width, Infinity]])
      .on('zoom', e => zoomed(e, xScale, yScale, svg, 2,
        1, yAxisWidth, chartWidth, chartHeight,
        null, null, null, component))
      .on('start', () => zoomStart(null))
      .on('end', () => zoomEnd(null))
      .filter(e => {
        if (selectMode) {
          return (e.type === 'wheel' || e.button === 2);
        } else {
          return (e.button === 0 || e.type === 'wheel');
        }
      });

    scatterPlotContent.call(zoom)
      .call(zoom.transform, d3.zoomIdentity);

    scatterPlotContent.on('dblclick.zoom', null);
    
    // Listen to double click to reset zoom
    scatterPlotContent.on('dblclick', () => {
      scatterPlotContent.transition('reset')
        .duration(750)
        .ease(d3.easeCubicInOut)
        .call(zoom.transform, d3.zoomIdentity);
    });

  };

  // ---- Interaction Functions ----

  /**
   * Event handler for the select button in the header
   */
  const selectModeSwitched = () => {
    selectMode = !selectMode;

    let lineChartContent = d3.select(svg)
      .select('g.line-chart-content-group')
      .classed('select-mode', selectMode);
    
    lineChartContent.select('g.brush rect.overlay')
      .attr('cursor', null);
  };

  $: featureData && drawFeature(featureData);

</script>

<style type='text/scss'>
  @import '../define';
  @import './common.scss';

  :global(.explain-panel .scatter-plot-content-group) {
    cursor: grab;
  }

  :global(.explain-panel .scatter-plot-content-group:active) {
    cursor: grabbing;
  }

  :global(.explain-panel .scatter-plot-content-group.select-mode) {
    cursor: crosshair;
  }

  :global(.explain-panel .scatter-plot-content-group.select-mode:active) {
    cursor: crosshair;
  }

</style>

<div class='explain-panel' bind:this={component}>

  <div class='header'>

    <div class='header__info'>
      <div class='header__name'>
        {featureData === null ? ' ' : featureData.name}
      </div>
      
      <div class='header__importance'>
        {featureData === null ? ' ': round(featureData.importance, 2)}
      </div>
    </div>

    <div class='header__control-panel'>
      <!-- The toggle button -->
      <div class='toggle-switch-wrapper'>
        <ToggleSwitch name='cat' on:selectModeSwitched={selectModeSwitched}/>
      </div>
    </div>

  </div>


  <div class='svg-container'>
    <svg class='svg-explainer' bind:this={svg}></svg>
  </div>
  
</div>