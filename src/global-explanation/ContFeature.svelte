<script>
  import * as d3 from 'd3';
  import { round } from '../utils';
  import { config } from '../config';
  import selectIconSVG from '../img/select-icon.svg';
  import dragIconSVG from '../img/drag-icon.svg';

  import ToggleSwitch from '../components/ToggleSwitch.svelte';
  import ContextMenu from '../components/ContextMenu.svelte';

  import { multiSelectMenuStore } from '../store';

  export let featureData = null;
  export let scoreRange = null;
  export let svgHeight = 400;

  let svg = null;
  let component = null;
  let multiMenu = null;

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
  const bboxStrokeWidth = 1;
  const nodeStrokeWidth = 1;

  // Computed data
  let pointData = null;
  let additiveData = null;

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

  // Panning and zooming
  let zoom = null;
  const zoomScaleExtent = [1, 30];
  const rExtent = [2, 16];
  let oriXScale = null;
  let oriYScale = null;
  let curXScale = null;
  let curYScale = null;
  let curTransform = null;
  const bboxPadding = 1;

  // Select mode
  let selectMode = false;

  // Editing mode
  // let hasSelected = false;
  // let nodeIndexes = new Set();
  class SelectedInfo {
    constructor() {
      this.hasSelected = false;
      this.nodeIndexes = new Set();
      this.nodeData = [];
      this.boundingBox = [];
    }

    updateNodeDataY(yChange) {
      for (let i = 0; i < this.nodeData.length; i++) {
        this.nodeData[i][1] += yChange;
      }
    }

    computeBBox() {
      if (this.nodeData.length > 0) {
        this.boundingBox = [{
          x1: d3.min(this.nodeData.map(d => d[0])),
          y1: d3.max(this.nodeData.map(d => d[1])),
          x2: d3.max(this.nodeData.map(d => d[0])),
          y2: d3.min(this.nodeData.map(d => d[1]))
        }];
      } else {
        this.boundingBox = [];
      }
    }
  }

  let selectedInfo = new SelectedInfo();
  const menuWidth = 375;
  const menuHeight = 50;

  // Store binding
  let multiMenuControlInfo = null;
  multiSelectMenuStore.subscribe(value => {
    multiMenuControlInfo = value;
  });

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
        id: i,
        pos: 'r',
        sx: sx,
        sy: sy
      });

      additiveData.push({
        x1: tx,
        y1: sy,
        x2: tx,
        y2: ty,
        id: i + 1,
        pos: 'l',
        sx: sx,
        sy: sy
      });
    }

    // Connect the last two points (because max point has no additive value, it
    // does not have a left edge)
    additiveData.push({
      x1: featureData.binEdge[featureData.additive.length - 1],
      y1: featureData.additive[featureData.additive.length - 1],
      x2: featureData.binEdge[featureData.additive.length],
      y2: featureData.additive[featureData.additive.length - 1],
      id: featureData.additive.length - 1,
      pos: 'r'
    });

    return additiveData;
  };

  /**
   * Create nodes where each step function begins
   * @param featureData
   */
  const createPointData = (featureData) => {
    let pointData = [];

    for (let i = 0; i < featureData.additive.length; i++) {
      pointData.push({
        x: featureData.binEdge[i],
        y: featureData.additive[i],
        id: i
      });
    }

    return pointData;
  };

  /**
   * Draw the plot in the SVG component
   * @param featureData
   */
  const drawFeature = (featureData) => {
    console.log(featureData);
    let svgSelect = d3.select(svg);

    // Bind inline SVG elements in the header
    bindInlineSVG();

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
    
    oriXScale = xScale;
    oriYScale = yScale;
    curXScale = xScale;
    curYScale = yScale;
    
    // Store the initial domain for zooming
    initXDomain = [xMin, xMax];
    initYDomain = scoreRange; 

    // Create a data array by combining the bin edge and additive terms
    additiveData = createAdditiveData(featureData);

    // Create the confidence interval region
    let confidenceData = createConfidenceData(featureData);

    // Create a data array to draw nodes
    pointData = createPointData(featureData);

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

    // Create a group to draw grids
    lineChartContent.append('g')
      .attr('class', 'line-chart-grid-group');

    let confidenceGroup = lineChartContent.append('g')
      .attr('class', 'line-chart-confidence-group');

    let lineGroup = lineChartContent.append('g')
      .attr('class', 'line-chart-line-group')
      .style('stroke', colors.line)
      .style('stroke-width', linePathWidth)
      .style('fill', 'none');

    // We draw the shape function with many line segments (path)
    lineGroup.selectAll('path')
      .data(additiveData, d => `${d.id}-${d.pos}`)
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
      .data(pointData, d => d.id)
      .join('circle')
      .attr('class', 'node')
      .attr('id', d => `node-${d.id}`)
      .attr('cx', d => xScale(d.x))
      .attr('cy', d => yScale(d.y))
      .attr('r', rExtent[0])
      .style('stroke-width', nodeStrokeWidth);

    // Draw the underlying confidence interval
    confidenceGroup.selectAll('rect')
      .data(confidenceData)
      .join('rect')
      .attr('class', 'confidence-rect')
      .attr('x', d => xScale(d.x1))
      .attr('y', d => yScale(d.y1))
      .attr('width', d => xScale(d.x2) - xScale(d.x1))
      .attr('height', d => yScale(d.y2) - yScale(d.y1))
      .style('fill', colors.lineConfidence)
      .style('opacity', 0.13);

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
      .on('end', e => brushEndSelect(e, xScale, yScale))
      .on('start brush', e => brushDuring(e, xScale, yScale))
      .extent([[0, 0], [lineChartWidth, lineChartHeight]])
      .filter((e) => {
        if (selectMode) {
          return e.button === 0;
        } else {
          return e.button === 2;
        }
      });

    let brushGroup = lineChartContent.append('g')
      .attr('class', 'brush')
      .call(brush);
    
    // Change the style of the select box
    brushGroup.select('rect.overlay')
      .attr('cursor', null);

    // Add panning and zooming
    zoom = d3.zoom()
      .scaleExtent(zoomScaleExtent)
      .on('zoom', e => zoomed(e, xScale, yScale))
      .on('start', zoomStart)
      .on('end', zoomEnd)
      .filter(e => {
        // if (e.shiftKey) return false;
        if (selectMode) {
          return (e.type === 'wheel' || e.button === 2);
        } else {
          return (e.button === 0 || e.type === 'wheel');
        }
      });

    lineChartContent.call(zoom)
      .call(zoom.transform, d3.zoomIdentity);

    lineChartContent.on('dblclick.zoom', null);
    
    // Listen to double click to reset zoom
    lineChartContent.on('dblclick', () => {
      lineChartContent.transition('reset')
        .duration(750)
        .ease(d3.easeCubicInOut)
        .call(zoom.transform, d3.zoomIdentity);
    });

  };

  const brushDuring = (event) => {
    // Get the selection boundary
    let selection = event.selection;
    let svgSelect = d3.select(svg);

    if (selection === null) {
      if (idleTimeout === null) {
        return idleTimeout = setTimeout(idled, idleDelay);
      }
    } else {
      // Compute the selected data region
      let xRange = [curXScale.invert(selection[0][0]), curXScale.invert(selection[1][0])];
      let yRange = [curYScale.invert(selection[1][1]), curYScale.invert(selection[0][1])];

      // Clean up the previous flowing lines
      stopAnimateLine();
      selectedInfo = new SelectedInfo();
      
      // Remove the selection bbox
      svgSelect.selectAll('g.line-chart-content-group g.select-bbox-group').remove();

      d3.select(multiMenu)
        .classed('hidden', true);

      // Highlight the selected dots
      svgSelect.select('g.line-chart-node-group')
        .selectAll('circle.node')
        .classed('selected', d => 
          (d.x >= xRange[0] && d.x <= xRange[1] && d.y >= yRange[0] && d.y <= yRange[1])
        );

      // Highlight the paths associated with the selected dots
      svgSelect.select('g.line-chart-line-group')
        .selectAll('path.additive-line-segment')
        .classed('selected', d => 
          (d.sx >= xRange[0] && d.sx <= xRange[1] && d.sy >= yRange[0] && d.sy <= yRange[1]) ||
          (d.x1 === d.x2 && d.x2 >= xRange[0] && d.x2 <= xRange[1] && d.y2 >= yRange[0] && d.y2 <= yRange[1])
        );
    }
  };

  const brushEndSelect = (event) => {
    // Get the selection boundary
    let selection = event.selection;
    let svgSelect = d3.select(svg);

    if (selection === null) {
      if (idleTimeout === null) {
        // Clean up the previous flowing lines
        stopAnimateLine();
        selectedInfo = new SelectedInfo();

        svgSelect.select('g.line-chart-content-group g.brush rect.overlay')
          .attr('cursor', null);

        d3.select(multiMenu)
          .classed('hidden', true);
        
        // End move mode
        multiMenuControlInfo.moveMode = false;
        multiMenuControlInfo.toSwitchMoveMode = true;
        multiSelectMenuStore.set(multiMenuControlInfo);

        // Remove the selection bbox
        svgSelect.selectAll('g.line-chart-content-group g.select-bbox-group').remove();

        return idleTimeout = setTimeout(idled, idleDelay);
      }
    } else {
      // Clean up the previous flowing lines
      stopAnimateLine();

      // Compute the selected data region
      let xRange = [curXScale.invert(selection[0][0]), curXScale.invert(selection[1][0])];
      let yRange = [curYScale.invert(selection[1][1]), curYScale.invert(selection[0][1])];

      // Highlight the selected dots
      svgSelect.select('g.line-chart-node-group')
        .selectAll('circle.node')
        .classed('selected', d => {
          if (d.x >= xRange[0] && d.x <= xRange[1] && d.y >= yRange[0] && d.y <= yRange[1]) {
            selectedInfo.nodeData.push([d.x, d.y]);
            selectedInfo.nodeIndexes.add(d.id);
            return true;
          } else {
            return false;
          }
        });

      // Compute the bounding box
      selectedInfo.computeBBox();

      let curPadding = (rScale(curTransform.k) + bboxPadding) * curTransform.k;

      let bbox = svgSelect.select('g.line-chart-content-group')
        .append('g')
        .attr('class', 'select-bbox-group')
        .selectAll('rect.select-bbox')
        .data(selectedInfo.boundingBox)
        .join('rect')
        .attr('class', 'select-bbox')
        .attr('x', d => curXScale(d.x1) - curPadding)
        .attr('y', d => curYScale(d.y1) - curPadding)
        .attr('width', d => curXScale(d.x2) - curXScale(d.x1) + 2 * curPadding)
        .attr('height', d => curYScale(d.y2) - curYScale(d.y1) + 2 * curPadding)
        .style('stroke-width', bboxStrokeWidth)
        .style('stroke', 'hsl(230, 100%, 10%)')
        .style('stroke-dasharray', '5 3');

      bbox.clone(true)
        .style('stroke', 'white')
        .style('stroke-width', bboxStrokeWidth * 3)
        .lower();

      selectedInfo.hasSelected = svgSelect.selectAll('g.line-chart-node-group circle.node.selected').size() > 0;

      if (selectedInfo.hasSelected) {
        // Show the context menu near the selected region
        d3.select(multiMenu)
          .call(moveMenubar, menuWidth, menuHeight)
          .classed('hidden', false);
      }
      
      // Remove the brush box
      svgSelect.select('g.line-chart-content-group g.brush')
        .call(brush.move, null)
        .select('rect.overlay')
        .attr('cursor', null);
    }
  };

  const zoomStart = () => {
    if (selectedInfo.hasSelected) {
      d3.select(multiMenu)
        .classed('hidden', true);
    }
  };

  const zoomEnd = () => {
    if (selectedInfo.hasSelected) {
      d3.select(multiMenu)
        .classed('hidden', false);
    }
  };

  /**
   * Use the selection bbox to compute where to put the context menu bar
  */
  const moveMenubar = (menubar, menuWidth, menuHeight) => {
    const bbox = d3.select(svg)
      .select('g.select-bbox-group rect.select-bbox');

    if (bbox.node() === null) return;

    const bboxPosition = bbox.node().getBoundingClientRect();
    const panelBboxPosition = component.getBoundingClientRect();

    let left = bboxPosition.x - panelBboxPosition.x + bboxPosition.width / 2 - menuWidth / 2;
    let top = bboxPosition.y - panelBboxPosition.y - menuHeight - 20;

    // Do not move the bar out of its parent
    left = Math.max(0, left);
    top = Math.max(0, top);

    menubar.style('left', `${left}px`)
      .style('top', `${top}px`);
  };

  const brushEndZoom = (event, xScale, yScale) => {
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

    curXScale = zXScale;
    curYScale = zYScale;
    curTransform = transform;

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

    // Transform the selection bbox if applicable
    if (selectedInfo.hasSelected) {
      // Here we don't use transform, because we want to keep the gap between
      // the nodes and bounding box border constant across all scales

      // We want to compute the world coordinate here
      // Need to transfer back the scale factor from the node radius
      let curPadding = (rScale(curTransform.k) + bboxPadding) * curTransform.k;

      svgSelect.select('g.line-chart-content-group')
        .selectAll('rect.select-bbox')
        .attr('x', d => curXScale(d.x1) - curPadding)
        .attr('y', d => curYScale(d.y1) - curPadding)
        .attr('width', d => curXScale(d.x2) - curXScale(d.x1) + 2 * curPadding)
        .attr('height', d => curYScale(d.y2) - curYScale(d.y1) + 2 * curPadding);

      // Also transform the menu bar
      d3.select(multiMenu)
        .call(moveMenubar, menuWidth, menuHeight);
    }

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

  /**
   * Animate teh dashed line infinitely
   * @param initOffset The initial stroke-dashoffset
   * @param offsetRate Use this to control the moving speed, each loop is 1 minute
   */
  const animateLine = (d, i, g, initOffset, offsetRate) => {
    let curPath = d3.select(g[i]);
    curPath.transition()
      .duration(60000)
      .ease(d3.easeLinear)
      .attr('stroke-dashoffset', initOffset + offsetRate)
      .on('end', (d, i, g) => {
        if (selectedInfo.hasSelected) {
          animateLine(d, i, g, initOffset + offsetRate, offsetRate);
        }
      });
  };

  /**
   * Stop animating all flowing lines
   */
  const stopAnimateLine = () => {
    d3.select(svg)
      .select('g.line-chart-line-group')
      .selectAll('path.additive-line-segment.flow-line')
      .interrupt()
      .attr('stroke-dasharray', '0 0')
      .classed('flow-line', false);
  };

  /**
   * Dynamically bind SVG files as inline SVG strings in this component
   */
  const bindInlineSVG = () => {
    d3.select(component)
      .select('.svg-icon#toggle-button-move')
      .html(dragIconSVG.replaceAll('black', 'currentcolor'));

    d3.select(component)
      .select('.svg-icon#toggle-button-select')
      .html(selectIconSVG.replaceAll('black', 'currentcolor'));
  };

  const fadeRemove = (g, time=500, ease=d3.easeCubicInOut) => {
    g.transition()
      .duration(time)
      .ease(ease)
      .style('opacity', 0)
      .on('end', (d, i, g) => {
        d3.select(g[i]).remove();
      });
  };

  const dragStarted = () => {
  };

  const dragged = (e, pointDataBuffer, additiveDataBuffer) => {

    const svgSelect = d3.select(svg);

    // Change the node data and node position based on the y-value changes
    let nodes = svgSelect.select('g.line-chart-node-group')
      .selectAll('circle.node');

    let dataYChange = curYScale.invert(e.y) - curYScale.invert(e.y - e.dy);

    // Another way to directly change the node's y position
    // let worldY = oriYScale(curYScale.invert(e.y));
    // let worldYChange = worldY - oriYScale(curYScale.invert(e.y - e.dy));
    // nodes.filter(d => nodeIndexes.has(d.id))
    //   .each((d, i, g) => {
    //     let curNode = d3.select(g[i]);
    //     let newY = +curNode.attr('cy') + worldYChange;
    //     pointDataBuffer[d.id].y += dataYChange;
    //     curNode.attr('cy', newY);
    //   });

    // Change the data based on the y-value changes, then redraw nodes (preferred method)
    selectedInfo.nodeIndexes.forEach(i => {
      // Step 1.1: update point data
      pointDataBuffer[i].y += dataYChange;

      // Step 1.2: update path data
      // Here are some hacky math: the way I constructed the additive data is
      // ordered such that first node has a R line, second has a L line, a R line,
      // the third has a L line, a R line, the second last has a L line, a R line,
      // and we don't need to worry about the last point dragging
      // The corresponding indexes for id i is 2 * i and 2 * i - 1 (when i > 0)

      // i's Left line
      if (i > 0) {
        additiveDataBuffer[2 * i - 1].y2 += dataYChange;
      }

      // i's Right line
      additiveDataBuffer[2 * i].y1 += dataYChange;
      additiveDataBuffer[2 * i].y2 += dataYChange;
      additiveDataBuffer[2 * i].sy += dataYChange;

      // (i + 1)'s Left line
      additiveDataBuffer[2 * i + 1].y1 += dataYChange;
      additiveDataBuffer[2 * i + 1].sy += dataYChange;
    });

    // Step 1.3: update the bbox info
    selectedInfo.updateNodeDataY(dataYChange);
    selectedInfo.computeBBox();

    // Update the visualization with new data

    // Step 2.1: redraw the nodes that are changed
    nodes.data(pointDataBuffer, d => d.id)
      .join('circle')
      .attr('cy', d => oriYScale(d.y));

    // Step 2.2: redraw the paths that are changed
    let paths = svgSelect.select('g.line-chart-line-group')
      .selectAll('path.additive-line-segment');

    paths.data(additiveDataBuffer, d => `${d.id}-${d.pos}`)
      .join('path')
      .attr('d', d => {
        return `M ${oriXScale(d.x1)}, ${oriYScale(d.y1)} L ${oriXScale(d.x2)} ${oriYScale(d.y2)}`;
      });

    // Step 2.3: move the selected bbox
    let curPadding = (rScale(curTransform.k) + bboxPadding) * curTransform.k;

    svgSelect.select('g.line-chart-content-group g.select-bbox-group')
      .selectAll('rect.select-bbox')
      .datum(selectedInfo.boundingBox[0])
      .attr('y', d => curYScale(d.y1) - curPadding);
  };

  const multiMenuButtonClicked = () => {
    console.log(multiMenuControlInfo.moveMode);

    // Enter the move mode

    // Step 1. create a pointdata clone for user to change
    let pointDataBuffer = JSON.parse(JSON.stringify(pointData));
    let additiveDataBuffer = JSON.parse(JSON.stringify(additiveData));

    d3.select(svg)
      .select('g.line-chart-content-group g.select-bbox-group')
      .style('cursor', 'row-resize')
      .call(d3.drag()
        .on('start', dragStarted)
        .on('drag', (e) => dragged(e, pointDataBuffer, additiveDataBuffer))
      );

  };

  const multiMenuInputChanged = () => {
    console.log(multiMenuControlInfo.increment);
  };

  const multiMenuIncreasingClicked = () => {
    console.log('increasing clicked');
  };
  
  const multiMenuDecreasingClicked = () => {
    console.log('decreasing clicked');
  };

  const multiMenuInterpolationClicked = () => {
    console.log('interpolate clicked');
  };

  const multiMenuMergeClicked = () => {
    console.log('merge clicked');
  };

  const multiMenuDeleteClicked = () => {
    console.log('delete clicked');
  };

  $: featureData && drawFeature(featureData);

</script>

<style type='text/scss'>
  @import '../define';

  .explain-panel {
    display: flex;
    flex-direction: column;
    position: relative;
    border-radius: 5px;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 10px;
    border-bottom: 1px solid $gray-border;

    .header__info {
      display: flex;
    }

    .header__name {
      margin-right: 10px;
    }

    .header__importance {
      color: $gray-light;
    }

    .header__control-panel {
      display: flex;
      align-items: center;
    }
  }

  .is-very-small {
    font-size: 1em;
    padding: 4px 12px;
    height: auto;
  }

  .toggle-switch-wrapper {
    width: 180px;
  }

  .state-button {
    color: $indigo-dark;
    transition: border-color 200ms ease-in-out, color 200ms ease-in-out;
  }

  .state-button.is-activated, .state-button.is-activated:hover {
    color: $blue-icon;
    // border-color: $blue-icon;
    border-color: hsl(0, 0%, 71%);
  }

  .state-button:hover {
    color: $blue-icon;
    // border-color: hsl(0, 0%, 85.9%);;
  }

  .context-menu-container {
    position: absolute;
    z-index: 5;
    // left: 250px;
    // bottom: 50px;

    &.hidden {
      visibility: hidden;
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

  :global(.explain-panel circle.node.selected) {
    fill: hsl(35, 100%, 50%);
    stroke: white;
  }

  :global(.explain-panel path.additive-line-segment.selected) {
    stroke: hsl(35, 100%, 40%);
  }

  @keyframes dash {
    to {
      stroke-dashoffset: 1000;
    }
  }

  :global(.explain-panel .line-chart-content-group) {
    cursor: grab;
  }

  :global(.explain-panel .line-chart-content-group:active) {
    cursor: grabbing;
  }

  :global(.explain-panel .line-chart-content-group.select-mode) {
    cursor: crosshair;
  }

  :global(.explain-panel .line-chart-content-group.select-mode:active) {
    cursor: crosshair;
  }

  :global(.explain-panel .svg-icon) {
    display: flex;
    justify-content: center;
    align-items: center;

    :global(svg) {
      width: 1.2em;
      height: 1.2em;
    }
  }

  :global(.explain-panel .select-bbox) {
    fill: none;
  }

  :global(.explain-panel .select-bbox-group) {
    pointer-events: all;
  }

</style>

<div class='explain-panel' bind:this={component}>

    <div class='context-menu-container hidden' bind:this={multiMenu}>
      <ContextMenu 
        on:inputChanged={multiMenuInputChanged}
        on:moveButtonClicked={multiMenuButtonClicked}
        on:increasingClicked={multiMenuIncreasingClicked}
        on:decreasingClicked={multiMenuDecreasingClicked}
        on:interpolationClicked={multiMenuInterpolationClicked}
        on:mergeClicked={multiMenuMergeClicked}
        on:deleteClicked={multiMenuDeleteClicked}
      /> 
    </div>

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
          <ToggleSwitch on:selectModeSwitched={selectModeSwitched}/>
        </div>
      </div>

    </div>


  <div class='svg-container'>
    <svg class='svg-explainer' bind:this={svg}></svg>
  </div>
  
</div>