<script>
  import * as d3 from 'd3';
  // import { initIsotonicRegression } from 'isotonic';
  import { initIsotonicRegression } from '../isotonic-regression';

  import { round } from '../utils';
  import { config } from '../config';

  import { SelectedInfo } from './continuous/cont-class';
  import { createConfidenceData, createAdditiveData, createPointData, linkPointToAdditive } from './continuous/cont-data';
  import { brushDuring, brushEndSelect } from './continuous/cont-brush';
  import { zoomStart, zoomEnd, zoomed, zoomScaleExtent, rExtent } from './continuous/cont-zoom';
  import { dragged, redrawOriginal, redrawMonotone, inplaceInterpolate,
    stepInterpolate, merge, drawLastEdit, regressionInterpolate } from './continuous/cont-edit';
  import { state } from './continuous/cont-state';
  import { moveMenubar } from './continuous/cont-bbox';

  import selectIconSVG from '../img/select-icon.svg';
  import dragIconSVG from '../img/drag-icon.svg';

  import ToggleSwitch from '../components/ToggleSwitch.svelte';
  import ContextMenu from '../components/ContextMenu.svelte';

  export let featureData = null;
  export let scoreRange = null;
  export let svgHeight = 400;

  let svg = null;
  let component = null;
  let multiMenu = null;
  let myContextMenu = null;

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

  // --- Interactions ---
  // Brush interactions
  let brush = null;
  let initXDomain = null;
  let initYDomain = null;

  // Panning and zooming
  let zoom = null;

  // Select mode
  let selectMode = false;
  state.selectedInfo = new SelectedInfo();

  // Editing mode
  const menuWidth = 375;
  const menuHeight = 50;

  // Context menu info
  let multiMenuControlInfo = {
    moveMode: false,
    toSwitchMoveMode: false,
    subItemMode: null,
    setValue: null,
    step: 3,
    interpolationMode: 'inplace',
  };

  // Isotonic regression
  let increasingISO = null;
  let decreasingISO = null;

  /**
   * Draw the plot in the SVG component
   * @param featureData
   */
  const drawFeature = (featureData) => {
    console.log(featureData);
    let svgSelect = d3.select(svg);

    // Bind inline SVG elements in the header
    bindInlineSVG();

    // Initialize the isotonic regression model
    initIsoModel();

    // Set svg viewBox (3:2 WH ratio)
    svgSelect.attr('viewBox', '0 0 600 400')
      .attr('preserveAspectRatio', 'xMinYMin meet')
      .attr('width', svgWidth)
      .attr('height', svgHeight)
      // WebKit bug workaround (see https://bugs.webkit.org/show_bug.cgi?id=226683)
      .on('wheel', () => {});
    
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
    
    state.oriXScale = xScale;
    state.oriYScale = yScale;
    state.curXScale = xScale;
    state.curYScale = yScale;
    
    // Store the initial domain for zooming
    initXDomain = [xMin, xMax];
    initYDomain = scoreRange; 

    // Create a data array by combining the bin edge and additive terms
    state.additiveData = createAdditiveData(featureData);

    // Create the confidence interval region
    let confidenceData = createConfidenceData(featureData);

    // Create a data array to draw nodes
    state.pointData = createPointData(featureData);

    // Link the point data and additive data (only need to call this function
    // we we initialize them from the data, no need to call it when we add new
    // bins in run time)
    linkPointToAdditive(state.pointData, state.additiveData);

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
      .attr('id', `${featureData.name.replace(/\s/g, '')}-line-chart-clip`)
      .append('rect')
      .attr('width', lineChartWidth)
      .attr('height', lineChartHeight - 1);

    // For the histogram clippath, need to carefully play around with the
    // transformation, the path should be in a static group; the group having
    // clip-path attr should be static. Therefore we apply the transformation to
    // histChart's child later.
    histChart.append('clipPath')
      .attr('id', `${featureData.name.replace(/\s/g, '')}-hist-chart-clip`)
      .append('rect')
      .attr('x', yAxisWidth)
      .attr('y', lineChartHeight)
      .attr('width', lineChartWidth)
      .attr('height', densityHeight);

    histChart.attr('clip-path', `url(#${featureData.name.replace(/\s/g, '')}-hist-chart-clip)`);
    
    let lineChartContent = lineChart.append('g')
      .attr('class', 'line-chart-content-group')
      .attr('clip-path', `url(#${featureData.name.replace(/\s/g, '')}-line-chart-clip)`)
      .attr('transform', `translate(${yAxisWidth}, 0)`);

    lineChartContent.append('rect')
      .attr('width', lineChartWidth)
      .attr('height', lineChartHeight)
      .style('opacity', 0);

    // Create a group to draw grids
    let gridGroup = lineChartContent.append('g')
      .attr('class', 'line-chart-grid-group');

    let confidenceGroup = lineChartContent.append('g')
      .attr('class', 'line-chart-confidence-group');

    let lineGroup = lineChartContent.append('g')
      .attr('class', 'line-chart-line-group real')
      .style('stroke', colors.line)
      .style('stroke-width', linePathWidth)
      .style('fill', 'none');

    // We draw the shape function with many line segments (path)
    lineGroup.selectAll('path')
      .data(state.additiveData, d => `${d.id}-${d.pos}`)
      .join('path')
      .attr('class', 'additive-line-segment')
      .attr('id', d => d.id)
      .attr('d', d => {
        return `M ${xScale(d.x1)}, ${yScale(d.y1)} L ${xScale(d.x2)} ${yScale(d.y2)}`;
      });

    lineChartContent.append('g')
      .attr('class', 'line-chart-line-group last-edit')
      .style('stroke', 'hsl(35, 100%, 85%)')
      .style('stroke-width', linePathWidth)
      .style('fill', 'none')
      .lower();

    lineGroup.clone(true)
      .classed('real', false)
      .style('stroke', 'hsl(0, 0%, 82%)')
      .lower();

    confidenceGroup.lower();
    gridGroup.lower();
    
    // Draw nodes for editing
    let nodeGroup = lineChartContent.append('g')
      .attr('class', 'line-chart-node-group')
      .style('visibility', 'hidden');
    
    nodeGroup.selectAll('circle')
      .data(Object.values(state.pointData), d => d.id)
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
      .on('end', e => brushEndSelect(
        e, svg, multiMenu, bboxStrokeWidth, menuWidth, menuHeight, brush,
        component, resetContextMenu
      ))
      .on('start brush', e => brushDuring(e, svg, multiMenu))
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
      .on('zoom', e => zoomed(e, xScale, yScale, svg, linePathWidth,
        nodeStrokeWidth, yAxisWidth, lineChartWidth, lineChartHeight,
        multiMenu, menuWidth, menuHeight, component))
      .on('start', () => zoomStart(multiMenu))
      .on('end', () => zoomEnd(multiMenu))
      .filter(e => {
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

  // ---- Interaction Functions ----

  const resetContextMenu = () => {
    if (multiMenuControlInfo.moveMode) {
      multiMenuControlInfo.moveMode = false;
      multiMenuControlInfo.toSwitchMoveMode = true;

      // DO not update the data
      state.pointDataBuffer = null;
      state.additiveDataBuffer = null;
    }

    // End sub-menu mode
    if (multiMenuControlInfo.subItemMode !== null) {
      // Hide the confirmation panel
      myContextMenu.hideConfirmation(multiMenuControlInfo.subItemMode);
      multiMenuControlInfo.subItemMode = null;

      // Discard changes
      state.pointDataBuffer = null;
      state.additiveDataBuffer = null;
    }
  };


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
  const animateBBox = (d, i, g, initOffset, offsetRate) => {
    let curPath = d3.select(g[i]);
    curPath.transition()
      .duration(60000)
      .ease(d3.easeLinear)
      .attr('stroke-dashoffset', initOffset + offsetRate)
      .on('end', (d, i, g) => {
        if (multiMenuControlInfo.moveMode || multiMenuControlInfo.subItemMode !== null) {
          animateBBox(d, i, g, initOffset + offsetRate, offsetRate);
        }
      });
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

  const initIsoModel = async () => {
    increasingISO = await initIsotonicRegression(true);
    decreasingISO = await initIsotonicRegression(false);
  };

  const multiMenuMoveClicked = async () => {
    console.log(multiMenuControlInfo.moveMode);

    // Enter the move mode

    // Step 1. create data clone buffers for user to change
    // We only do this when buffer has not been created --- it is possible that
    // user switch to move from other editing mode
    if (state.pointDataBuffer === null) {
      state.pointDataBuffer = JSON.parse(JSON.stringify(state.pointData));
      state.additiveDataBuffer = JSON.parse(JSON.stringify(state.additiveData));
    }

    let bboxGroup = d3.select(svg)
      .select('g.line-chart-content-group g.select-bbox-group')
      .style('cursor', 'row-resize')
      .call(d3.drag()
        .on('drag', (e) => dragged(e, svg))
      );
    
    bboxGroup.select('rect.original-bbox')
      .each((d, i, g) => animateBBox(d, i, g, 0, -500));
    
    // Show the last edit
    if (state.additiveDataLastEdit !== undefined) {
      drawLastEdit(svg);
    }
    
  };

  /**
   * Call this handler when users click the check button
   */
  const multiMenuMoveCheckClicked = () => {
    // Save the changes
    state.pointData = JSON.parse(JSON.stringify(state.pointDataBuffer));
    state.additiveData = JSON.parse(JSON.stringify(state.additiveDataBuffer));

    // Remove the drag
    let bboxGroup = d3.select(svg)
      .select('g.line-chart-content-group g.select-bbox-group')
      .style('cursor', null)
      .on('.drag', null);
    
    // stop the animation
    bboxGroup.select('rect.original-bbox')
      .interrupt();

    // Move the menu bar
    d3.select(multiMenu)
      .call(moveMenubar, menuWidth, menuHeight, svg, component);

    // Save this change to lastEdit, update lastEdit graph
    if (state.additiveDataLastEdit !== undefined) {
      state.additiveDataLastLastEdit = JSON.parse(JSON.stringify(state.additiveDataLastEdit));
    }
    state.additiveDataLastEdit = JSON.parse(JSON.stringify(state.additiveData));
  };

  /**
   * Call this handler when users click the cancel button
   */
  const multiMenuMoveCancelClicked = () => {
    // Discard the changes
    state.pointDataBuffer = null;
    state.additiveDataBuffer = null;
    
    // Recover the original graph
    redrawOriginal(svg, true, () => {
      // Move the menu bar after animation
      d3.select(multiMenu)
        .call(moveMenubar, menuWidth, menuHeight, svg, component);
    });

    // Remove the drag
    let bboxGroup = d3.select(svg)
      .select('g.line-chart-content-group g.select-bbox-group')
      .style('cursor', null)
      .on('.drag', null);
    
    // stop the animation
    bboxGroup.select('rect.original-bbox')
      .interrupt();
    
    // Redraw the last edit if possible
    if (state.additiveDataLastLastEdit !== undefined){
      state.additiveDataLastEdit = JSON.parse(JSON.stringify(state.additiveDataLastLastEdit));
      drawLastEdit(svg);
      // Prepare for next redrawing after recovering the last last edit graph
      state.additiveDataLastEdit = JSON.parse(JSON.stringify(state.additiveData));
    }
  };

  /**
   * Event handler when user clicks the increasing button
  */
  const multiMenuIncreasingClicked = async () => {
    console.log('increasing clicked');

    // Animate the bbox
    d3.select(svg)
      .select('g.line-chart-content-group g.select-bbox-group')
      .select('rect.original-bbox')
      .each((d, i, g) => animateBBox(d, i, g, 0, -500));

    // Check if the selected nodes are in a continuous range

    // Fit an isotonic regression model
    let xs = [];
    let ys = [];
    let ws = [];

    state.selectedInfo.nodeData.forEach((d, i) => {
      xs.push(i);
      ys.push(state.pointData[d.id].y);
      ws.push(state.pointData[d.id].count);
    });

    // WASM only uses 1-3ms for the whole graph!
    increasingISO.reset();
    increasingISO.fit(xs, ys, ws);
    let isoYs = increasingISO.predict(xs);

    state.pointDataBuffer = JSON.parse(JSON.stringify(state.pointData));
    state.additiveDataBuffer = JSON.parse(JSON.stringify(state.additiveData));

    // Update the last edit graph
    drawLastEdit(svg);

    redrawMonotone(svg, isoYs);
    myContextMenu.showConfirmation('increasing', 600);
  };
  
  /**
   * Event handler when user clicks the decreasing button
   */
  const multiMenuDecreasingClicked = () => {
    console.log('decreasing clicked');

    // Animate the bbox
    d3.select(svg)
      .select('g.line-chart-content-group g.select-bbox-group')
      .select('rect.original-bbox')
      .each((d, i, g) => animateBBox(d, i, g, 0, -500));

    // Check if the selected nodes are in a continuous range

    // Fit an isotonic regression model
    let xs = [];
    let ys = [];

    state.selectedInfo.nodeData.forEach((d, i) => {
      xs.push(i);
      ys.push(state.pointData[d.id].y);
    });

    // WASM only uses 1-3ms for the whole graph!
    decreasingISO.reset();
    decreasingISO.fit(xs,ys);
    let isoYs = decreasingISO.predict(xs);

    state.pointDataBuffer = JSON.parse(JSON.stringify(state.pointData));
    state.additiveDataBuffer = JSON.parse(JSON.stringify(state.additiveData));

    // Update the last edit graph
    drawLastEdit(svg);

    redrawMonotone(svg, isoYs);
    myContextMenu.showConfirmation('decreasing', 600);
  };

  /**
   * Event handler when user clicks the interpolation button
   */
  const multiMenuInterpolationClicked = () => {
    console.log('interpolation clicked');

    // Animate the bbox
    d3.select(svg)
      .select('g.line-chart-content-group g.select-bbox-group')
      .select('rect.original-bbox')
      .each((d, i, g) => animateBBox(d, i, g, 0, -500));

    state.pointDataBuffer = JSON.parse(JSON.stringify(state.pointData));
    state.additiveDataBuffer = JSON.parse(JSON.stringify(state.additiveData));

    // Special for interpolation: we need to create a buffer for the selectedInfo
    // as well (selectedInfo.boundingBox would not change, no need to buffer it)
    state.selectedInfo.nodeDataBuffer = JSON.parse(JSON.stringify(state.selectedInfo.nodeData));

    // Update the last edit graph
    drawLastEdit(svg);

    // Determine whether to use in-place interpolation
    if (state.selectedInfo.nodeData.length == 1) {
      return;
    } else if (state.selectedInfo.nodeData.length == 2) {
      multiMenuControlInfo.interpolationMode = 'equal';
      stepInterpolate(svg, multiMenuControlInfo.step);
    } else {
      multiMenuControlInfo.interpolationMode = 'inplace';
      inplaceInterpolate(svg);
    }

    myContextMenu.showConfirmation('interpolation', 600);

  };

  /**
   * Event handler when user clicks the control button in the interpolation sub-menu
  */
  const multiMenuInterpolateUpdated = () => {
    console.log('interpolation updated');

    if (multiMenuControlInfo.interpolationMode === 'inplace') {
      // Special case: we want to do inplace interpolation from the original data
      // Need to recover original data
      state.pointDataBuffer = JSON.parse(JSON.stringify(state.pointData));
      state.additiveDataBuffer = JSON.parse(JSON.stringify(state.additiveData));
      state.selectedInfo.nodeDataBuffer = JSON.parse(JSON.stringify(state.selectedInfo.nodeData));
      inplaceInterpolate(svg);

    } else if (multiMenuControlInfo.interpolationMode === 'equal') {
      // Here we don't reset the pointDataBuffer
      // If user clicks here direction => step interpolate between start & end
      // If user has clicked regression => regression with equal bins
      stepInterpolate(svg, multiMenuControlInfo.step);

    } else if (multiMenuControlInfo.interpolationMode === 'regression') {
      // Need to recover original data
      state.pointDataBuffer = JSON.parse(JSON.stringify(state.pointData));
      state.additiveDataBuffer = JSON.parse(JSON.stringify(state.additiveData));
      state.selectedInfo.nodeDataBuffer = JSON.parse(JSON.stringify(state.selectedInfo.nodeData));

      regressionInterpolate(svg);

    } else {
      console.error('Unknown regression mode ', multiMenuControlInfo.interpolationMode);
    }
  };

  const multiMenuMergeClicked = () => {
    console.log('merge clicked');

    // Animate the bbox
    d3.select(svg)
      .select('g.line-chart-content-group g.select-bbox-group')
      .select('rect.original-bbox')
      .each((d, i, g) => animateBBox(d, i, g, 0, -500));

    state.pointDataBuffer = JSON.parse(JSON.stringify(state.pointData));
    state.additiveDataBuffer = JSON.parse(JSON.stringify(state.additiveData));

    // Update the last edit graph
    drawLastEdit(svg);

    merge(svg);

    myContextMenu.showConfirmation('merge', 600);
  };

  const multiMenuInputChanged = () => {
    console.log(multiMenuControlInfo.setValue);

    // Animate the bbox
    d3.select(svg)
      .select('g.line-chart-content-group g.select-bbox-group')
      .select('rect.original-bbox')
      .each((d, i, g) => animateBBox(d, i, g, 0, -500));

    state.pointDataBuffer = JSON.parse(JSON.stringify(state.pointData));
    state.additiveDataBuffer = JSON.parse(JSON.stringify(state.additiveData));

    merge(svg, multiMenuControlInfo.setValue);

    myContextMenu.showConfirmation('change', 600);
  };

  const multiMenuDeleteClicked = () => {
    console.log('delete clicked');

    // Animate the bbox
    d3.select(svg)
      .select('g.line-chart-content-group g.select-bbox-group')
      .select('rect.original-bbox')
      .each((d, i, g) => animateBBox(d, i, g, 0, -500));

    state.pointDataBuffer = JSON.parse(JSON.stringify(state.pointData));
    state.additiveDataBuffer = JSON.parse(JSON.stringify(state.additiveData));

    // Update the last edit graph
    drawLastEdit(svg);

    merge(svg, 0);

    myContextMenu.showConfirmation('delete', 600);
  };

  /**
   * Event handler when user clicks the check icon in the sub-menu
   */
  const multiMenuSubItemCheckClicked = () => {
    console.log('sub item check clicked');

    if (multiMenuControlInfo.subItemMode === null) {
      console.error('No sub item is selected but check is clicked!');
    }

    const existingModes = new Set(['increasing', 'decreasing', 'interpolation', 'change', 'merge', 'delete']);
    if (!existingModes.has(multiMenuControlInfo.subItemMode)) {
      console.error(`Encountered unknown subItemMode: ${multiMenuControlInfo.subItemMode}`);
    }

    // Stop the bbox animation
    d3.select(svg)
      .select('g.line-chart-content-group g.select-bbox-group')
      .select('rect.original-bbox')
      .interrupt();

    // Save the changes
    state.pointData = JSON.parse(JSON.stringify(state.pointDataBuffer));
    state.additiveData = JSON.parse(JSON.stringify(state.additiveDataBuffer));

    // Update the last edit data to current data (redraw the graph only when user enters
    // editing mode next time)
    if (state.additiveDataLastEdit !== undefined) {
      state.additiveDataLastLastEdit = JSON.parse(JSON.stringify(state.additiveDataLastEdit));
    }
    state.additiveDataLastEdit = JSON.parse(JSON.stringify(state.additiveData));
    

    // Special [interpolation]: need to save the new selectedInfo as well
    if (multiMenuControlInfo.subItemMode === 'interpolation') {
      state.selectedInfo.nodeData = JSON.parse(JSON.stringify(state.selectedInfo.nodeDataBuffer));
      state.selectedInfo.nodeDataBuffer = null;
    }

    // Hide the confirmation panel
    myContextMenu.hideConfirmation(multiMenuControlInfo.subItemMode);

    // Move the menu bar
    d3.select(multiMenu)
      .call(moveMenubar, menuWidth, menuHeight, svg, component);
    
    // Exit the sub-item mode
    multiMenuControlInfo.subItemMode = null;
  };

  /**
   * Event handler when user clicks the cross icon in the sub-menu
   */
  const multiMenuSubItemCancelClicked = () => {
    console.log('sub item cancel clicked');
    if (multiMenuControlInfo.subItemMode === null) {
      console.error('No sub item is selected but check is clicked!');
    }

    const existingModes = new Set(['increasing', 'decreasing', 'interpolation', 'change', 'merge', 'delete']);
    if (!existingModes.has(multiMenuControlInfo.subItemMode)) {
      console.error(`Encountered unknown subItemMode: ${multiMenuControlInfo.subItemMode}`);
    }

    // Stop the bbox animation
    d3.select(svg)
      .select('g.line-chart-content-group g.select-bbox-group')
      .select('rect.original-bbox')
      .interrupt();

    // Discard the change
    state.pointDataBuffer = null;
    state.additiveDataBuffer = null;

    // Recover the last edit graph
    if (state.additiveDataLastLastEdit !== undefined){
      state.additiveDataLastEdit = JSON.parse(JSON.stringify(state.additiveDataLastLastEdit));
      drawLastEdit(svg);
      // Prepare for next redrawing after recovering the last last edit graph
      state.additiveDataLastEdit = JSON.parse(JSON.stringify(state.additiveData));
    }

    // Recover the original graph
    redrawOriginal(svg, true, () => {
      // Move the menu bar after the animation
      d3.select(multiMenu)
        .call(moveMenubar, menuWidth, menuHeight, svg, component);
    });

    // Hide the confirmation panel
    myContextMenu.hideConfirmation(multiMenuControlInfo.subItemMode);

    // Exit the sub-item mode
    multiMenuControlInfo.subItemMode = null;
  };

  $: featureData && drawFeature(featureData);

</script>

<style type='text/scss'>
  @import '../define';
  @import './common.scss';

  :global(.explain-panel circle.node) {
    fill: $blue-icon;
    stroke: white;
  }

  :global(.explain-panel circle.node.selected) {
    fill: $orange-400;
    stroke: white;
  }

  :global(.explain-panel .additive-line-segment) {
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  :global(.explain-panel path.additive-line-segment.selected) {
    stroke: adjust-color($orange-400, $lightness: -8%);
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
        bind:controlInfo={multiMenuControlInfo}
        bind:this={myContextMenu} 
        on:inputChanged={multiMenuInputChanged}
        on:moveButtonClicked={multiMenuMoveClicked}
        on:increasingClicked={multiMenuIncreasingClicked}
        on:decreasingClicked={multiMenuDecreasingClicked}
        on:interpolationClicked={multiMenuInterpolationClicked}
        on:mergeClicked={multiMenuMergeClicked}
        on:deleteClicked={multiMenuDeleteClicked}
        on:moveCheckClicked={multiMenuMoveCheckClicked}
        on:moveCancelClicked={multiMenuMoveCancelClicked}
        on:subItemCheckClicked={multiMenuSubItemCheckClicked}
        on:subItemCancelClicked={multiMenuSubItemCancelClicked}
        on:interpolateUpdated={multiMenuInterpolateUpdated}
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
          <ToggleSwitch name='cont' on:selectModeSwitched={selectModeSwitched}/>
        </div>
      </div>

    </div>


  <div class='svg-container'>
    <svg class='svg-explainer' bind:this={svg}></svg>
  </div>
  
</div>