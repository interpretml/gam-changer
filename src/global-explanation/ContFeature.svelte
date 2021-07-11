<script>
  import * as d3 from 'd3';
  import { get } from 'svelte/store';

  import { initEBM } from '../ebm';
  import { initIsotonicRegression } from '../isotonic-regression';

  import { round, hashString } from '../utils/utils';
  import { MD5 } from '../utils/md5';
  import { config } from '../config';

  import { SelectedInfo } from './continuous/cont-class';
  import { createConfidenceData, createAdditiveData, createPointData, linkPointToAdditive } from './continuous/cont-data';
  import { brushDuring, brushEndSelect, quitSelection } from './continuous/cont-brush';
  import { zoomStart, zoomEnd, zoomed, zoomScaleExtent, rExtent } from './continuous/cont-zoom';
  import { dragged, redrawOriginal, redrawMonotone, inplaceInterpolate,
    stepInterpolate, merge, drawLastEdit, regressionInterpolate, drawBufferGraph } from './continuous/cont-edit';
  import { state } from './continuous/cont-state';
  import { moveMenubar } from './continuous/cont-bbox';

  import selectIconSVG from '../img/select-icon.svg';
  import dragIconSVG from '../img/drag-icon.svg';

  import ToggleSwitch from '../components/ToggleSwitch.svelte';
  import ContextMenu from '../components/ContextMenu.svelte';

  export let featureData = null;
  export let scoreRange = null;
  export let svgHeight = 400;
  export let ebm = null;
  export let sidebarStore = null;
  export let footerStore = null;
  export let footerActionStore = null;
  export let historyStore = null;

  let svg = null;
  let component = null;
  let multiMenu = null;
  let myContextMenu = null;
  let redoStack = [];

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
  let yAxisWidth;
  let lineChartWidth;
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

  // Communicate with the sidebar
  let sidebarInfo = {};
  sidebarStore.subscribe(value => {
    sidebarInfo = value;
  });

  // Listen to footer buttons
  footerActionStore.subscribe(message => {
    switch(message){
    case 'undo': {
      console.log('undo clicked');

      let curCommit;
      let lastCommit;

      if (get(historyStore).length > 1) {

        // If the user has selected some nodes, discard the selections
        quitSelection(svg, multiMenu, resetContextMenu, resetFeatureSidebar);

        // Remove the current commit from history
        historyStore.update(value => {
          curCommit = value.pop();
          lastCommit = value[value.length - 1];
          return value;
        });

        let curHistoryStoreValue = get(historyStore);
        // Save the current commit into the redo stack
        redoStack.push(curCommit);

        console.log(curCommit, lastCommit);
        console.log(curHistoryStoreValue);

        // Replace the current state with last commit
        state.additiveData = lastCommit.state.additiveData;
        state.pointData = lastCommit.state.pointData;

        // Need to use buffer to draw the svg
        state.additiveDataBuffer = null;
        state.pointDataBuffer = null;

        // Update the last edit state, redraw the last edit graphs
        if (curHistoryStoreValue.length > 1) {
          state.additiveDataLastEdit = curHistoryStoreValue[curHistoryStoreValue.length - 2].state.additiveData;
          drawLastEdit(svg);
        } else {
          // If there is no last edit, then it is the origin
          state.additiveDataLastEdit = undefined;
        }

        if (curHistoryStoreValue.length > 2) {
          state.additiveDataLastLastEdit = curHistoryStoreValue[curHistoryStoreValue.length - 3].state.additiveData;
          drawLastEdit(svg);
        } else {
          // If there is no last last edit, then it is the origin or the first edit
          state.additiveDataLastLastEdit = undefined;
        }

        // If the current edit has changed the EBM bin definition, then we need
        // to reset the definition in WASM
        if (curCommit.type.includes('equal')) {
          setEBM('current', state.pointData);
        }

        // TODO: update the metrics, last metrics,

        // Redraw the graph
        redrawOriginal(svg);

      }

      break;
    }
    case 'redo':
      console.log('redo clicked');
      break;
    
    case 'save':
      console.log('save clicked');
      break;
    
    default:
      break;
    }

    footerActionStore.set('');
  });

  /**
   * Draw the plot in the SVG component
   * @param featureData
   */
  const drawFeature = (featureData) => {
    console.log(featureData);
    // Approximate the longest width of score (y-axis)
    yAxisWidth = 5 * d3.max(scoreRange.map(d => String(round(d, 1)).length));
    lineChartWidth = width - svgPadding.left - svgPadding.right - yAxisWidth;

    let svgSelect = d3.select(svg);

    // Bind inline SVG elements in the header
    bindInlineSVG();

    // Initialize the isotonic regression model
    initIsoModel(featureData);

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
      .attr('transform', `translate(${-yAxisWidth - 15}, ${lineChartHeight / 2}) rotate(-90)`)
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
      .attr('transform', `translate(${-yAxisWidth - 15}, ${densityHeight / 2}) rotate(-90)`)
      .append('text')
      .attr('class', 'y-axis-text')
      .text('Density')
      .style('fill', colors.histAxis);

    // Add brush
    brush = d3.brush()
      .on('end', e => brushEndSelect(
        e, svg, multiMenu, bboxStrokeWidth, brush, component, resetContextMenu,
        sidebarStore, setEBM, updateFeatureSidebar, resetFeatureSidebar
      ))
      .on('start brush', e => brushDuring(e, svg, multiMenu, ebm, footerStore))
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
        multiMenu, component))
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

    // Now the graph is drawn, update the height to sidebar
    sidebarInfo.height = component.getBoundingClientRect().height;
    sidebarStore.set(sidebarInfo);

    // Update the footer for more instruction
    footerStore.update(value => {
      value.help = '<b>Drag</b> to pan view, <b>Scroll</b> to zoom';
      return value;
    });

    // Push the initial state into the history stack
    pushCurStateToHistoryStack('original', 'original graph');
  };

  const updateEBM = async (curGroup) => {
    let changedBinIndexes = [];
    let changedScores = [];

    state.selectedInfo.nodeData.forEach(d => {
      changedBinIndexes.push(d.id);
      changedScores.push(d.y);
    });

    await ebm.updateModel(changedBinIndexes, changedScores);

    let metrics = ebm.getMetrics();

    if (ebm.isClassification) {
      sidebarInfo.accuracy = metrics.accuracy;
      sidebarInfo.rocAuc = metrics.rocAuc;
      sidebarInfo.balancedAccuracy = metrics.balancedAccuracy;
      sidebarInfo.confusionMatrix = metrics.confusionMatrix;
    } else {
      sidebarInfo.rmse = metrics.rmse;
      sidebarInfo.mae = metrics.mae;
    }

    sidebarInfo.curGroup = curGroup;

    sidebarStore.set(sidebarInfo);
  };

  /**
   * Overwrite the edge definition in the EBM WASM model.
   * @param {string} curGroup Message to the metrics sidebar
   * @param {object} curNodeData Node data in `state`
   */
  const setEBM = async (curGroup, curNodeData) => {

    // Update the complete bin edge definition in the EBM model
    let newBinEdges = [];
    let newScores = [];

    // The left point will always have index 0
    let curPoint = curNodeData[0];
    let curEBMID = 0;

    while (curPoint.rightPointID !== null) {
      // Collect x and y
      newBinEdges.push(curPoint.x);
      newScores.push(curPoint.y);

      // Update the new ID so we can map them to bin indexes later (needed for
      // selection to check sample number)
      curPoint.ebmID = curEBMID;
      curEBMID++;

      curPoint = curNodeData[curPoint.rightPointID];
    }

    // Add the right node
    newBinEdges.push(curPoint.x);
    newScores.push(curPoint.y);
    curPoint.ebmID = curEBMID;

    await ebm.setModel(newBinEdges, newScores);

    let metrics = ebm.getMetrics();

    if (ebm.isClassification) {
      sidebarInfo.accuracy = metrics.accuracy;
      sidebarInfo.rocAuc = metrics.rocAuc;
      sidebarInfo.balancedAccuracy = metrics.balancedAccuracy;
      sidebarInfo.confusionMatrix = metrics.confusionMatrix;
    } else {
      sidebarInfo.rmse = metrics.rmse;
      sidebarInfo.mae = metrics.mae;
    }

    sidebarInfo.curGroup = curGroup;

    sidebarStore.set(sidebarInfo);
  };

  /**
   * Count the feature distribution for the selected test samples
   * @param {[number]} binIndexes Selected bin indexes
   */
  const updateFeatureSidebar = async (binIndexes) => {
    // Get the selected counts
    let selectedHistCounts = ebm.getSelectedSampleDist(binIndexes);

    // Update the counts in the store
    for (let i = 0; i < sidebarInfo.featurePlotData.cont.length; i++) {
      let curID = sidebarInfo.featurePlotData.cont[i].id;
      sidebarInfo.featurePlotData.cont[i].histSelectedCount = selectedHistCounts[curID];
    }

    for (let i = 0; i < sidebarInfo.featurePlotData.cat.length; i++) {
      let curID = sidebarInfo.featurePlotData.cat[i].id;
      sidebarInfo.featurePlotData.cat[i].histSelectedCount = selectedHistCounts[curID];
    }

    sidebarInfo.curGroup = 'updateFeature';
    sidebarStore.set(sidebarInfo);
  };

  /**
   * Reset the feature count of selected samples to 0
   */
  const resetFeatureSidebar = async () => {
    for (let i = 0; i < sidebarInfo.featurePlotData.cont.length; i++) {
      sidebarInfo.featurePlotData.cont[i].histSelectedCount = new Array(
        sidebarInfo.featurePlotData.cont[i].histSelectedCount.length).fill(0);
    }

    for (let i = 0; i < sidebarInfo.featurePlotData.cat.length; i++) {
      sidebarInfo.featurePlotData.cat[i].histSelectedCount = new Array(
        sidebarInfo.featurePlotData.cat[i].histSelectedCount.length).fill(0);
    }

    sidebarInfo.curGroup = 'updateFeature';
    sidebarStore.set(sidebarInfo);
  };

  const pushCurStateToHistoryStack = (type, description) => {
    historyStore.update(value => {
      console.log(value);
      const time = Date.now();

      value.push({
        state: {
          pointData: state.pointData,
          additiveData: state.additiveData
        },
        featureId: 1,
        type: type,
        description: description,
        time: time,
        hash: MD5(`${type}${description}${time}`)
      });
      return value;
    });
  };

  // ---- Interaction Functions ----

  /**
   * Quit the sub-menu mode (move, sub-item in the context menu) when user clicks
   * the empty space during editing
   * This function is implemented as a callback for brushSelected() because it
   * needs access to variable `multiMenuControlInfo`
   */
  const resetContextMenu = () => {
    let moveMode = multiMenuControlInfo.moveMode;
    let subItemMode = multiMenuControlInfo.subItemMode;

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

    // Update the footer message
    footerStore.update(value => {
      // Reset the baseline
      value.baseline = 0;
      value.baselineInit = false;
      value.state = '';
      value.help = '<b>Drag</b> to marquee select, <b>Scroll</b> to zoom';
      return value;
    });

    return {moveMode: moveMode, subItemMode: subItemMode};
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

    // Update the footer message
    if (selectMode) {
      footerStore.update(value => {
        value.help = '<b>Drag</b> to marquee select, <b>Scroll</b> to zoom';
        return value;
      });
    } else {
      footerStore.update(value => {
        value.help = '<b>Drag</b> to pan view, <b>Scroll</b> to zoom';
        return value;
      });
    }
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
    // Enter the move mode

    // If users have done some other edits without committing, discard the changes
    multiMenuSubItemCancelClicked(true);

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
        .on('start', () => {
          footerStore.update(value => {
            if (!value.baselineInit) {
              value.baseline = 0;
              value.baselineInit = true;
            }
            return value;
          });
        })
        .on('drag', (e) => dragged(e, svg, component, ebm, sidebarStore, footerStore, updateEBM))
      );
    
    bboxGroup.select('rect.original-bbox')
      .each((d, i, g) => animateBBox(d, i, g, 0, -500));
    
    // Show the last edit
    if (state.additiveDataLastEdit !== undefined) {
      drawLastEdit(svg);
    }

    // Copy current metrics as last metrics
    sidebarInfo.curGroup = 'last';
    sidebarStore.set(sidebarInfo);

    // Update the footer message
    footerStore.update(value => {
      value.help = '<b>Drag</b> the <b>selected region</b> to change score';
      return value;
    });
    
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
      .call(moveMenubar, svg, component);

    // Save this change to lastEdit, update lastEdit graph
    if (state.additiveDataLastEdit !== undefined) {
      state.additiveDataLastLastEdit = JSON.parse(JSON.stringify(state.additiveDataLastEdit));
    }
    state.additiveDataLastEdit = JSON.parse(JSON.stringify(state.additiveData));

    // Update metrics
    sidebarInfo.curGroup = 'commit';
    sidebarStore.set(sidebarInfo);

    // Update the footer message
    let curEditBaseline = 0;
    footerStore.update(value => {
      // Reset the baseline
      curEditBaseline = value.baseline;
      value.baseline = 0;
      value.baselineInit = false;
      value.type = '';
      value.state = '';
      value.help = '<b>Drag</b> to marquee select, <b>Scroll</b> to zoom';
      return value;
    });

    // Save into the history
    // Generate the description message
    const binNum = state.selectedInfo.nodeData.length;
    const binLeft = state.selectedInfo.nodeData[0];
    const binRight = state.pointData[state.pointData[state.selectedInfo.nodeData[binNum - 1].id].rightPointID];
    const binRange = binRight === undefined ? `${binLeft.x} <= x` : `${binLeft.x} <= x < ${binRight.x}`;
    const message = `${curEditBaseline >= 0 ? 'Increased' : 'Decreased'} scores of ${binNum} ` +
      `bins (${binRange}) by ${round(Math.abs(curEditBaseline), 2)}.`;
    pushCurStateToHistoryStack('move', message);
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
        .call(moveMenubar, svg, component);
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

    // Update the metrics
    sidebarInfo.curGroup = 'recover';
    sidebarStore.set(sidebarInfo);

    // Update the footer message
    footerStore.update(value => {
      // Reset the baseline
      value.baseline = 0;
      value.baselineInit = false;
      value.state = '';
      value.type = '';
      value.help = '<b>Drag</b> to marquee select, <b>Scroll</b> to zoom';
      return value;
    });
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

    state.selectedInfo.nodeData.forEach((d) => {
      xs.push(state.pointData[d.id].x);
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

    // Update EBM
    sidebarInfo.curGroup = 'last';
    sidebarStore.set(sidebarInfo);
    updateEBM('current');

    // Update the footer message
    footerStore.update(value => {
      value.state = `Made ${xs.length} bins <b>monotonically increasing</b>`;
      value.type = 'increasing';
      return value;
    });
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
    let ws = [];

    state.selectedInfo.nodeData.forEach((d) => {
      xs.push(state.pointData[d.id].x);
      ys.push(state.pointData[d.id].y);
      ws.push(state.pointData[d.id].count);
    });

    // WASM only uses 1-3ms for the whole graph!
    decreasingISO.reset();
    decreasingISO.fit(xs, ys, ws);
    let isoYs = decreasingISO.predict(xs);

    state.pointDataBuffer = JSON.parse(JSON.stringify(state.pointData));
    state.additiveDataBuffer = JSON.parse(JSON.stringify(state.additiveData));

    // Update the last edit graph
    drawLastEdit(svg);

    redrawMonotone(svg, isoYs);
    myContextMenu.showConfirmation('decreasing', 600);

    // Update EBM
    sidebarInfo.curGroup = 'last';
    sidebarStore.set(sidebarInfo);
    updateEBM('current');
    
    // Update the footer message
    footerStore.update(value => {
      value.state = `Made ${xs.length} bins <b>monotonically decreasing</b>`;
      value.type = 'decreasing';
      return value;
    });
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

    // Update EBM
    sidebarInfo.curGroup = 'last';
    sidebarStore.set(sidebarInfo);

    // Set the EBM model (need to change bin definition)
    setEBM('current', state.pointDataBuffer);

    // Update the footer message
    footerStore.update(value => {
      value.state = `<b>Interpolated</b> ${state.selectedInfo.nodeData.length} bins <b>in place</b>`;
      value.interpolateEqual = 'in place';
      if (multiMenuControlInfo.interpolationMode === 'equal') {
        value.type = 'equal-interpolate';
      } else {
        value.type = 'inplace-interpolate';
      }
      return value;
    });
  };

  /**
   * Event handler when user clicks the control button in the interpolation sub-menu
  */
  const multiMenuInterpolateUpdated = () => {
    console.log('interpolation updated');
    let footerValue = get(footerStore);

    if (multiMenuControlInfo.interpolationMode === 'inplace') {
      // Special case: we want to do inplace interpolation from the original data
      // Need to recover original data
      state.pointDataBuffer = JSON.parse(JSON.stringify(state.pointData));
      state.additiveDataBuffer = JSON.parse(JSON.stringify(state.additiveData));
      state.selectedInfo.nodeDataBuffer = JSON.parse(JSON.stringify(state.selectedInfo.nodeData));
      inplaceInterpolate(svg);

      footerValue.interpolateStyle = 'Interpolated';
      footerValue.interpolateEqual = 'in place';

    } else if (multiMenuControlInfo.interpolationMode === 'equal') {
      // Here we don't reset the pointDataBuffer
      // If user clicks here direction => step interpolate between start & end
      // If user has clicked regression => regression with equal bins
      stepInterpolate(svg, multiMenuControlInfo.step);

      footerValue.interpolateEqual = `with ${multiMenuControlInfo.step} equal-size bins`;

    } else if (multiMenuControlInfo.interpolationMode === 'regression') {
      // Need to recover original data
      state.pointDataBuffer = JSON.parse(JSON.stringify(state.pointData));
      state.additiveDataBuffer = JSON.parse(JSON.stringify(state.additiveData));
      state.selectedInfo.nodeDataBuffer = JSON.parse(JSON.stringify(state.selectedInfo.nodeData));

      regressionInterpolate(svg);

      footerValue.interpolateStyle = 'Regression transformed';
      footerValue.interpolateEqual = 'in place';

    } else {
      console.error('Unknown regression mode ', multiMenuControlInfo.interpolationMode);
    }

    setEBM('current', state.pointDataBuffer);

    // Update the footer message
    footerValue.state = `<b>${footerValue.interpolateStyle}</b> ${state.selectedInfo.nodeData.length}
      bins <b>${footerValue.interpolateEqual}</b>`;

    if (footerValue.interpolateEqual !== 'in place') {
      if (footerValue.interpolateStyle === 'Interpolated') {
        footerValue.type = 'equal-interpolate';
      } else {
        footerValue.type = 'equal-regression';
      }
    } else {
      if (footerValue.interpolateStyle === 'Interpolated') {
        footerValue.type = 'inplace-interpolate';
      } else {
        footerValue.type = 'inplace-regression';
      }
    }

    footerStore.set(footerValue);
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

    // Update EBM
    sidebarInfo.curGroup = 'last';
    sidebarStore.set(sidebarInfo);
    updateEBM('current');

    // Update the footer message
    footerStore.update(value => {
      value.type = 'merge';
      value.state = `Set scores of ${state.selectedInfo.nodeData.length} bins to
        <b>${round(state.selectedInfo.nodeData[0].y, 4)}</b>`;
      return value;
    });
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

    // Update EBM
    sidebarInfo.curGroup = 'last';
    sidebarStore.set(sidebarInfo);
    updateEBM('current');

    // Update the footer message
    footerStore.update(value => {
      value.type = 'merge';
      value.state = `Set scores of ${state.selectedInfo.nodeData.length} bins to <b>${multiMenuControlInfo.setValue}</b>`;
      return value;
    });
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

    // Update EBM
    sidebarInfo.curGroup = 'last';
    sidebarStore.set(sidebarInfo);
    updateEBM('current');

    // Update the footer message
    footerStore.update(value => {
      value.type = 'delete';
      value.state = `Set scores of ${state.selectedInfo.nodeData.length} bins to <b>${0}</b>`;
      return value;
    });
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
      .call(moveMenubar, svg, component);
    
    // Exit the sub-item mode
    multiMenuControlInfo.subItemMode = null;

    // Update metrics
    sidebarInfo.curGroup = 'commit';
    sidebarStore.set(sidebarInfo);

    // Update the footer message
    let editType = '';
    footerStore.update(value => {
      editType = value.type;
      // Reset the baseline
      value.baseline = 0;
      value.baselineInit = false;
      value.state = '';
      value.type = '';
      value.help = '<b>Drag</b> to marquee select, <b>Scroll</b> to zoom';
      return value;
    });

    // Push the commit to history

    // Get the info of edited bins
    const binNum = state.selectedInfo.nodeData.length;
    const binLeft = state.selectedInfo.nodeData[0];
    const binRight = state.pointData[state.pointData[state.selectedInfo.nodeData[binNum - 1].id].rightPointID];
    const binRange = binRight === undefined ? `${binLeft.x} <= x` : `${binLeft.x} <= x < ${binRight.x}`;
    let description = '';

    switch(editType) {
    case 'increasing':
      description = `Made ${binNum} bins (${binRange}) monotonically increasing.`;
      break;
    case 'decreasing':
      description = `Made ${binNum} bins (${binRange}) monotonically decreasing.`;
      break;
    case 'inplace-interpolate':
      description = `Interpolated ${binNum} bins (${binRange}) inplace.`;
      break;
    case 'inplace-regression':
      description = `Regression transformed ${binNum} bins (${binRange}) inplace.`;
      break;
    case 'equal-interpolate':
      description = `Interpolated ${binNum} bins (${binRange}) into ${multiMenuControlInfo.step} equal-size bins.`;
      break;
    case 'equal-regression':
      description = `Regression transformed ${binNum} bins (${binRange}) into ${multiMenuControlInfo.step} equal-size bins.`;
      break;
    case 'merge':
      description = `Set ${binNum} bins (${binRange}) to score ${round(state.selectedInfo.nodeData[0].y, 4)}.`;
      break;
    case 'delete':
      description = `Set ${binNum} bins (${binRange}) to score 0.`;
      break;
    default:
      break;
    }

    pushCurStateToHistoryStack(editType, description);
    console.log(get(historyStore));
  };

  /**
   * Event handler when user clicks the cross icon in the sub-menu
   */
  const multiMenuSubItemCancelClicked = (cancelFromMove = false) => {
    console.log('sub item cancel clicked');
    if (!cancelFromMove && multiMenuControlInfo.subItemMode === null) {
      console.error('No sub item is selected but check is clicked!');
    }

    const existingModes = new Set(['increasing', 'decreasing', 'interpolation', 'change', 'merge', 'delete']);
    if (!cancelFromMove && !existingModes.has(multiMenuControlInfo.subItemMode)) {
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

    // If the current edit is interpolation, we need to recover the bin definition
    // in the EBM model
    if (multiMenuControlInfo.subItemMode === 'interpolation') {
      setEBM('current', state.pointData);
    }
    
    // Update metrics
    if (!cancelFromMove) {
      sidebarInfo.curGroup = 'recover';
      sidebarStore.set(sidebarInfo);
    }

    // Recover the original graph
    redrawOriginal(svg, true, () => {
      // Move the menu bar after the animation
      d3.select(multiMenu)
        .call(moveMenubar, svg, component);
    });

    // Hide the confirmation panel
    myContextMenu.hideConfirmation(multiMenuControlInfo.subItemMode);

    // Exit the sub-item mode
    multiMenuControlInfo.subItemMode = null;

    // Update the footer message
    footerStore.update(value => {
      // Reset the baseline
      value.baseline = 0;
      value.baselineInit = false;
      value.state = '';
      value.type = '';
      value.help = '<b>Drag</b> to marquee select, <b>Scroll</b> to zoom';
      return value;
    });
  };

  $: featureData && ebm && drawFeature(featureData);

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