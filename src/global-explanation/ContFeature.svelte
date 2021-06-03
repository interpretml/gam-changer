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
  const width = 600;
  const height = 400;

  // Real SVG width
  let svgWidth = svgHeight * (width / height);

  // Show some hidden elements for development
  const showRuler = false;

  // Some constant lengths of different elements
  const yAxisWidth = 30;

  const lineChartWidth = width - svgPadding.left - svgPadding.right - yAxisWidth;
  const lineChartHeight = height - svgPadding.top - svgPadding.bottom - densityHeight;

  // Some styles
  const colors = config.colors;
  const defaultFont = config.defaultFont;
  const linePathWidth = 2.5;
  const nodeStrokeWidth = 1;

  // --- Interactions ---
  // Brush interactions
  let brush = null;
  let initXDomain = null;
  let initYDomain = null;

  // Need a timer to avoid the brush event call after brush.move()
  let idleTimeout = null;
  const idleDelay = 300;

  // Brush zooming
  const zoomTransitionTime = 700;

  // Panning
  let zoom = null;
  const zoomScaleExtent = [1, 30];
  const rExtent = [2, 16];

  /**
   * Create rectangles in SVG path format tracing the standard deviations at each
   * point in the model.
   * @param featureData
   */
  const createConfidenceData = (featureData) => {

    let confidenceData = [];

    for (let i = 0; i < featureData.additive.length; i++) {
      let curValue = featureData.additive[i];
      let curError = featureData.error[i];

      confidenceData.push({
        x1: featureData.binEdge[i],
        y1: curValue + curError,
        x2: featureData.binEdge[i + 1],
        y2: curValue - curError
      });
    }

    // Right bound
    let rightValue = featureData.additive[featureData.additive.length - 1];
    let rightError = featureData.error[featureData.additive.length - 1];

    confidenceData.push({
      x1: featureData.binEdge[featureData.additive.length - 1],
      y1: rightValue + rightError,
      x2: featureData.binEdge[featureData.additive.length - 1],
      y2: rightValue - rightError
    });

    return confidenceData;
  };

  /**
   * Create line segments (path) to trace the additive term at each bin in the
   * model.
   * @param featureData
   */
  const createAdditiveData = (featureData) => {
    let additiveData = [];

    for (let i = 0; i < featureData.additive.length - 1; i++) {

      // Compute the source point and the target point
      let sx = featureData.binEdge[i];
      let sy = featureData.additive[i];
      let tx = featureData.binEdge[i + 1];
      let ty = featureData.additive[i + 1];

      // Add line segments (need two segments to connect two points)
      // We separate these two lines so it is easier to drag
      additiveData.push({
        x1: sx,
        y1: sy,
        x2: tx,
        y2: sy,
        id: `${i}-r`
      });

      additiveData.push({
        x1: tx,
        y1: sy,
        x2: tx,
        y2: ty,
        id: `${i + 1}-l`
      });
    }

    // Connect the last two points (because max point has no additive value, it
    // does not have a left edge)
    additiveData.push({
      x1: featureData.binEdge[featureData.additive.length - 1],
      y1: featureData.additive[featureData.additive.length - 1],
      x2: featureData.binEdge[featureData.additive.length],
      y2: featureData.additive[featureData.additive.length - 1],
      id: `${featureData.additive.length - 1}-r`
    });

    return additiveData;
  };

  /**
   * Create nodes where each step function begins and an ending node that marks
   * the maximum value of the training data
   * @param featureData
   */
  const createPointData = (featureData) => {
    let pointData = [];

    for (let i = 0; i < featureData.additive.length; i++) {
      pointData.push({
        x: featureData.binEdge[i],
        y: featureData.additive[i]
      });
    }

    // Add the last point
    pointData.push({
      x: featureData.binEdge[featureData.additive.length],
      y: featureData.additive[featureData.additive.length - 1]
    });

    return pointData;
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
    
    // Disable the default context menu when right click
    svgSelect.on('contextmenu', (event) => {
      event.preventDefault();
    });

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

    // The bins have unequal length, and they are inner edges
    // Here we use the min and max values from the training set as our left and
    // right bounds on the x-axis (left most and right most edges)
    let xMin = featureData.binEdge[0];
    let xMax = featureData.binEdge[featureData.binEdge.length - 1];

    // For the y scale, it seems InterpretML presets the center at 0 (offset
    // doesn't really matter in EBM because we can modify intercept)
    // TODO: Provide interaction for users to change the center point
    // let yExtent = d3.extent(featureData.additive);

    let xScale = d3.scaleLinear()
      .domain([xMin, xMax])
      .range([0, lineChartWidth]);

    // Normalize the Y axis by the global score range
    let yScale = d3.scaleLinear()
      .domain(scoreRange)
      .range([lineChartHeight, 0]);
    
    // Store the initial domain for zooming
    initXDomain = [xMin, xMax];
    initYDomain = scoreRange; 

    // Create a data array by combining the bin edge and additive terms
    let additiveData = createAdditiveData(featureData);

    // Create the confidence interval region
    let confidenceData = createConfidenceData(featureData);

    // Create a data array to draw nodes
    let pointData = createPointData(featureData);

    // Create histogram chart group
    let histChart = content.append('g')
      .attr('class', 'hist-chart-group');
    
    // Draw the line chart
    let lineChart = content.append('g')
      .attr('class', 'line-chart-group');

    let axisGroup = lineChart.append('g')
      .attr('class', 'axis-group');

    // Add a clip path to bound the lines (for zooming)
    lineChart.append('clipPath')
      .attr('id', 'line-chart-clip')
      .append('rect')
      .attr('width', lineChartWidth)
      .attr('height', lineChartHeight - 1);

    // For the histogram clippath, need to carefully play around with the
    // transformation, the path should be in a static group; the group having
    // clip-path attr should be static. Therefore we apply the transformation to
    // histChart's child later.
    histChart.append('clipPath')
      .attr('id', 'hist-chart-clip')
      .append('rect')
      .attr('x', yAxisWidth)
      .attr('y', lineChartHeight)
      .attr('width', lineChartWidth)
      .attr('height', densityHeight);

    histChart.attr('clip-path', 'url(#hist-chart-clip)');
    
    let lineChartContent = lineChart.append('g')
      .attr('class', 'line-chart-content-group')
      .attr('clip-path', 'url(#line-chart-clip)')
      .attr('transform', `translate(${yAxisWidth}, 0)`);

    lineChartContent.append('rect')
      .attr('width', lineChartWidth)
      .attr('height', lineChartHeight)
      .style('opacity', 0);

    let confidenceGroup = lineChartContent.append('g')
      .attr('class', 'line-chart-confidence-group');

    let lineGroup = lineChartContent.append('g')
      .attr('class', 'line-chart-line-group')
      .style('stroke', colors.line)
      .style('stroke-width', linePathWidth)
      .style('fill', 'none');

    // We draw the shape function with many line segments (path)
    lineGroup.selectAll('path')
      .data(additiveData, d => d.id)
      .join('path')
      .attr('class', 'additive-line-segment')
      .attr('id', d => d.id)
      .attr('d', d => {
        return `M ${xScale(d.x1)}, ${yScale(d.y1)} L ${xScale(d.x2)} ${yScale(d.y2)}`;
      });
    
    // Draw nodes for editing
    let nodeGroup = lineChartContent.append('g')
      .attr('class', 'line-chart-node-group')
      .style('visibility', 'hidden');
    
    nodeGroup.selectAll('circle')
      .data(pointData)
      .join('circle')
      .attr('class', 'node')
      .attr('cx', d => xScale(d.x))
      .attr('cy', d => yScale(d.y))
      .attr('r', rExtent[0])
      .style('stroke-width', nodeStrokeWidth);

    // Draw the underlying confidence interval
    confidenceGroup.selectAll('rect')
      .data(confidenceData)
      .join('rect')
      .attr('x', d => xScale(d.x1))
      .attr('y', d => yScale(d.y1))
      .attr('width', d => xScale(d.x2) - xScale(d.x1))
      .attr('height', d => yScale(d.y2) - yScale(d.y1))
      .style('fill', colors.lineConfidence);

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
      .text('Score')
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

    // Draw the density histogram 
    let histChartContent = histChart.append('g')
      .attr('class', 'hist-chart-content-group')
      .attr('transform', `translate(${yAxisWidth}, ${lineChartHeight})`);

    histChartContent.selectAll('rect')
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
      .attr('transform', `translate(${-yAxisWidth - 5}, ${densityHeight / 2}) rotate(-90)`)
      .append('text')
      .attr('class', 'y-axis-text')
      .text('Density')
      .style('fill', colors.histAxis);

    // Add brush
    brush = d3.brush()
      .on('end', e => brushEnd(e, xScale, yScale, lineChartContent, brush))
      .extent([[0, 0], [lineChartWidth, lineChartHeight]]);

    // lineChartContent.append('g')
    //   .attr('class', 'brush')
    //   .call(brush);

    // Add panning and zooming
    zoom = d3.zoom()
      .scaleExtent(zoomScaleExtent)
      .on('zoom', e => zoomed(e, xScale, yScale))
      .filter(e => {
        // if (e.shiftKey) return false;
        if (e.type === 'mousedown' || e.type === 'wheel') return true;
      });

    // Create a group to draw grids
    lineChartContent.append('g')
      .attr('class', 'line-chart-grid-group');

    lineChartContent.call(zoom)
      .call(zoom.transform, d3.zoomIdentity);
    
    // Listen to double click to reset zoom
    lineChartContent.on('dblclick', () => {
      lineChartContent.transition('reset')
        .duration(750)
        .ease(d3.easeCubicInOut)
        .call(zoom.transform, d3.zoomIdentity);
    });

  };

  const brushEnd = (event, xScale, yScale) => {
    // Get the selection boundary
    let selection = event.selection;

    // If there is no selection, return to the initial stage
    // Double click returns to the initial stage
    if (selection === null) {
      if (idleTimeout === null) {
        return idleTimeout = setTimeout(idled, idleDelay);
      }

      xScale.domain(initXDomain);
      yScale.domain(initYDomain);
    } else {
      console.log(selection);

      // Rescale the x and y axises
      xScale.domain([xScale.invert(selection[0][0]), xScale.invert(selection[1][0])]);
      yScale.domain([yScale.invert(selection[1][1]), yScale.invert(selection[0][1])]);

      // Remove the brush box
      d3.select(svg)
        .select('g.line-chart-content-group g.brush')
        .call(brush.move, null);
    }

    // Zoom in to the new selection
    brushZoom(xScale, yScale);
  };

  /**
   * Reset the idleTimeout timer
   */
  const idled = () => {
    idleTimeout = null;
  };

  const brushZoom = (xScale, yScale) => {

    // Create a common transition
    let svgSelect = d3.select(svg);
    let trans = svgSelect.transition('zoom')
      .duration(zoomTransitionTime);

    // Update the axises
    svgSelect.select('g.x-axis')
      .transition(trans)
      .call(d3.axisBottom(xScale));

    svgSelect.select('g.y-axis')
      .transition(trans)
      .call(d3.axisLeft(yScale));

    // Redraw the lines using the new scale
    svgSelect.select('g.line-chart-line-group')
      .selectAll('path.additive-line-segment')
      .transition(trans)
      .attr('d', d => {
        return `M ${xScale(d.x1)}, ${yScale(d.y1)} L ${xScale(d.x2)} ${yScale(d.y2)}`;
      });
    
  };

  /**
   * Update the view with zoom transformation
   * @param event Zoom event
   * @param xScale Scale for the x-axis
   * @param yScale Scale for the y-axis
   */
  const zoomed = (event, xScale, yScale) => {

    let svgSelect = d3.select(svg);
    let transform = event.transform;

    // Transform the axises
    let zXScale = transform.rescaleX(xScale);
    let zYScale = transform.rescaleY(yScale);

    svgSelect.select('g.x-axis')
      .call(d3.axisBottom(zXScale));

    svgSelect.select('g.y-axis')
      .call(d3.axisLeft(zYScale));
    
    // Transform the lines
    let lineGroup = svgSelect.select('g.line-chart-line-group')
      .attr('transform', transform);
    
    // Rescale the stroke width a little bit
    lineGroup.style('stroke-width', linePathWidth / transform.k);

    // Transform the confidence rectangles
    svgSelect.select('g.line-chart-confidence-group')
      .attr('transform', transform);

    // Transform the nodes
    let nodeGroup = svgSelect.select('g.line-chart-node-group');

    if (transform.k === 1 && nodeGroup.style('visibility') === 'visible') {
      nodeGroup.transition()
        .duration(300)
        .style('opacity', 0)
        .on('end', (d, i, g) => {
          d3.select(g[i])
            .style('visibility', 'hidden');
        });
    }

    if (transform.k !== 1 && nodeGroup.style('visibility') === 'hidden') {
      nodeGroup.style('opacity', 0);
      nodeGroup.style('visibility', 'visible')
        .transition()
        .duration(500)
        .style('opacity', 1);
    }

    svgSelect.select('g.line-chart-node-group')
      .attr('transform', transform)
      .selectAll('circle.node')
      .attr('r', rScale(transform.k))
      .style('stroke-width', nodeStrokeWidth / transform.k);

    // Transform the density rectangles
    // Here we want to translate and scale the x axis, and keep y axis consistent
    svgSelect.select('g.hist-chart-content-group')
      .attr('transform', `translate(${yAxisWidth + transform.x},
        ${lineChartHeight})scale(${transform.k}, 1)`);

    // Draw/update the grid
    svgSelect.select('g.line-chart-grid-group')
      .call(drawGrid, zXScale, zYScale);

  };

  /**
   * Use linear interpolation to scale the node radius during zooming
   * It is actually kind of tricky, there should be better functions
   * (1) In overview, we want the radius to be small to avoid overdrawing;
   * (2) When zooming in, we want the radius to increase (slowly)
   * (3) Need to counter the zoom's scaling effect
   * @param k Scale factor
   */
  const rScale = (k) => {
    let alpha = (k - zoomScaleExtent[0]) / (zoomScaleExtent[1] - zoomScaleExtent[0]);
    alpha = d3.easeLinear(alpha);
    let target = alpha * (rExtent[1] - rExtent[0]) + rExtent[0];
    return target / k;
  };

  const drawGrid = (g, xScale, yScale) => {
    g.style('stroke', 'black')
      .style('stroke-opacity', 0.08);
    
    // Add vertical lines based on the xScale ticks
    g.call(g => g.selectAll('line.grid-line-x')
      .data(xScale.ticks(), d => d)
      .join(
        enter => enter.append('line')
          .attr('class', 'grid-line-x')
          .attr('y2', lineChartHeight),
        update => update,
        exit => exit.remove()
      )
      .attr('x1', d => 0.5 + xScale(d))
      .attr('x2', d => 0.5 + xScale(d))
    );

    // Add horizontal lines based on the yScale ticks
    return g.call(g => g.selectAll('line.grid-line-y')
      .data(yScale.ticks(), d => d)
      .join(
        enter => enter.append('line')
          .attr('class', 'grid-line-y')
          .classed('grid-line-y-0', d => d === 0)
          .attr('x2', lineChartWidth),
        update => update,
        exit => exit.remove()
      )
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))
    );
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

  :global(.explain-panel .grid-line-x, .explain-panel .grid-line-y) {
    stroke-width: 1;
    stroke: black;
    stroke-opacity: 0.08;
  }

  :global(.explain-panel .grid-line-y-0) {
    stroke-width: 3;
    stroke: black;
    stroke-opacity: 0.1;
    stroke-dasharray: 15 10;
  }

  :global(.explain-panel circle.node) {
    fill: hsl(213, 100%, 53%);
    stroke: white;
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