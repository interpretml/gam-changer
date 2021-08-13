<script>
  import * as d3 from 'd3';
  import { onMount, onDestroy } from 'svelte';
  import { round } from '../utils/utils';
  import { config } from '../config';

  import { drawBarLegend } from './draw';
  import { SelectedInfo } from './categorical/cat-class';
  import { zoomStart, zoomEnd, zoomed, zoomScaleExtent, rExtent } from './categorical/cat-zoom';
  import { brushDuring, brushEndSelect, quitSelection, selectAllBins } from './categorical/cat-brush';
  import { moveMenubar } from './continuous/cont-bbox';
  import { drawLastEdit, dragged, grayOutConfidenceLine, redrawOriginal, merge } from './categorical/cat-edit';
  import { getEBMMetrics, transferMetricToSidebar, setEBM } from './categorical/cat-ebm';
  import { pushCurStateToHistoryStack, undoHandler, redoHandler, checkoutCommitHead,
    tryRestoreLastEdit } from './categorical/cat-history';

  import ContextMenu from '../components/ContextMenu.svelte';

  export let featureData = null;
  export let labelEncoder = null;
  export let scoreRange = null;
  export let svgHeight = 400;
  export let ebm = null;
  export let sidebarStore = null;
  export let footerStore = null;
  export let footerActionStore = null;
  export let historyStore = null;

  let svg = null;
  let component = null;
  let brush = null;
  let multiMenu = null;
  let myContextMenu = null;

  let mounted = false;
  let initialized = false;

  // Visualization constants
  const svgPadding = config.svgPadding;
  const densityHeight = 90;

  // Viewbox width and height
  let width = 600;
  const height = 400;

  // Context menu info
  let multiMenuControlInfo = {
    moveMode: false,
    toSwitchMoveMode: false,
    subItemMode: null,
    setValue: null
  };

  // Subscribe the history store
  let redoStack = [];
  let historyList = null;
  let historyStoreUnsubscribe = historyStore.subscribe(value => {historyList = value;});

  // Sidebar store
  let sidebarInfo = null;
  let sidebarStoreUnsubscribe = sidebarStore.subscribe(async value => {
    sidebarInfo = value;

    // Listen to events ['globalClicked', 'selectedClicked', 'sliceClicked']
    // from the sidebar
    switch(value.curGroup) {
    case 'globalClicked':
      console.log('globalClicked');

      // footerStore.update(value => {
      //   if (value.sample.includes(',')) {
      //     value.sample = value.sample.slice(0, -1);
      //   }
      //   value.slice = '';
      //   return value;
      // });

      // We keep track of the global metrics in history in any current scope
      // To restore the global tab, we just need to query the history stack
      sidebarInfo.curGroup = 'overwrite';
      sidebarStore.set(sidebarInfo);
      break;

    case 'selectedClicked':
      console.log('selectedClicked');

      footerStore.update(value => {
        if (value.sample.includes(',')) {
          value.sample = value.sample.slice(0, -1);
        }
        value.slice = '';
        return value;
      });

      // Step 1: If there is no selected nodes, then the metrics are all NAs
      if (!state.selectedInfo.hasSelected) {
        sidebarInfo.curGroup = 'nullify';
        sidebarStore.set(sidebarInfo);
      } else {
        // Step 2: Reset/Update EBM 3 times and compute three metrics on the selected nodes

        // Step 2.1: Original
        // Here we reset the EBM model completely, because
        // the intermediate historical events might update() different portions
        // of the EBM
        // Be careful! The first commit might be on a different feature!
        // It is way too complicated to load the initial edit then come back (need to revert
        // every edit on every feature!)
        // Here we just use ignore it [better than confusing the users with some other "original"]
        // await setEBM('original-only', historyList[0].state.pointData);

        // Nullify the original
        sidebarInfo.curGroup = 'nullify';
        sidebarStore.set(sidebarInfo);
        while (sidebarInfo.curGroup !== 'nullifyCompleted') {
          await new Promise(r => setTimeout(r, 300));
        }

        // Step 2.2: Last edit
        if (sidebarInfo.historyHead - 1 >= 0 &&
          historyList[sidebarInfo.historyHead - 1].type !== 'original' &&
          historyList[sidebarInfo.historyHead - 1].featureName === state.featureName) {
          await setEBM(state, ebm, 'last-only', historyList[sidebarInfo.historyHead - 1].state.pointData,
            sidebarStore, sidebarInfo);
        }

        // // Step 2.3: Current edit
        let curPointData = state.pointDataBuffer === null ?
          historyList[sidebarInfo.historyHead].state.pointData :
          state.pointDataBuffer;

        // await setEBM('current-only', curPointData);
        await setEBM(state, ebm, 'current-only', curPointData, sidebarStore, sidebarInfo);
      }

      break;

    case 'sliceClicked': {
      console.log('sliceClicked');

      // Step 1: set the slice feature ID and level ID to EBM
      let sliceSize = ebm.setSliceData(sidebarInfo.sliceInfo.featureID, sidebarInfo.sliceInfo.level);

      footerStore.update(value => {
        if (!value.sample.includes(',')) value.sample += ',';
        value.slice = `<b>${sliceSize}</b> sliced`;
        return value;
      });

      // Step 2: Reset/Update EBM 3 times and compute three metrics on the selected nodes

      // Step 2.1: Original
      // Here we reset the EBM model completely, because
      // the intermediate historical events might update() different portions
      // of the EBM
      // await setEBM('original-only', historyList[0].state.pointData);

      // Nullify the original
      sidebarInfo.curGroup = 'nullify';
      sidebarStore.set(sidebarInfo);
      while (sidebarInfo.curGroup !== 'nullifyCompleted') {
        await new Promise(r => setTimeout(r, 300));
      }

      // Step 2.2: Last edit
      if (sidebarInfo.historyHead - 1 >= 0 &&
        historyList[sidebarInfo.historyHead - 1].type !== 'original' &&
        historyList[sidebarInfo.historyHead - 1].featureName === state.featureName) { 
        await setEBM(state, ebm, 'last-only', historyList[sidebarInfo.historyHead - 1].state.pointData,
          sidebarStore, sidebarInfo);
      }

      // Step 2.3: Current edit
      let curPointData = state.pointDataBuffer === null ?
        historyList[sidebarInfo.historyHead].state.pointData :
        state.pointDataBuffer;

      await setEBM(state, ebm, 'current-only', curPointData, sidebarStore, sidebarInfo);

      break;
    }

    // User clicks to preview a previous edit
    case 'headChanged': {
      const headFeatureName = historyList[value.historyHead].featureName;
      // // Only checkout the commit if it is still on the same feature
      // // Otherwise, this component should wait for its parent to kill it
      if (headFeatureName === state.featureName) {
        checkoutCommitHead(state, svg, multiMenu, resetContextMenu, resetFeatureSidebar,
          historyStore, ebm, sidebarStore, barWidth);
      }
      break;
    }

    default:
      break;
    }
  });

  let footerValue = null;
  let footerValueUnsubscribe = footerStore.subscribe(value => {
    footerValue = value;
  });  

  // Listen to footer buttons
  let footerActionUnsubscribe = footerActionStore.subscribe(message => {
    switch(message){
    case 'undo': {
      console.log('undo clicked');

      if (historyList.length > 1) {
        undoHandler(state, svg, multiMenu, resetContextMenu, resetFeatureSidebar,
          historyStore, redoStack, ebm, sidebarStore, barWidth);
      }
      break;
    }

    case 'redo': {
      console.log('redo clicked');

      if (redoStack.length > 0) {
        redoHandler(state, svg, multiMenu, resetContextMenu, resetFeatureSidebar,
          historyStore, redoStack, ebm, sidebarStore);
      }
      break;
    }
    
    case 'save':
      console.log('save clicked');
      break;

    case 'selectAll':
      console.log('selectAll clicked');

      // Select all bins if in select mode and nothing has been selected yet
      if (selectMode) {
        // Discard any existing selection
        quitSelection(svg, state, multiMenu, resetContextMenu, resetFeatureSidebar);

        // Cheeky way to select all nodes by fake a brush event
        selectAllBins(svg, state, multiMenu, component, updateFeatureSidebar,
          brush, nullifyMetrics, computeSelectedEffects, footerStore, ebm);
      }
      break;
    
    default:
      break;
    }

    footerActionStore.set('');
  });

  // Real width (depends on the svgHeight prop)
  let svgWidth = svgHeight * (width / height);

  // Show some hidden elements for development
  const showRuler = false;

  // Some styles
  const colors = config.colors;
  const defaultFont = config.defaultFont;
  let barWidth = null;

  // Select mode
  let state = {
    curXScale: null,
    curYScale: null,
    curTransform: null,
    selectedInfo: null,
    pointData: null,
    pointDataBuffer: null,
    oriXScale: null,
    oriYScale: null,
    bboxPadding: 5,
  };
  let selectMode = false;
  state.selectedInfo = new SelectedInfo();

  /**
   * Create a path to indicate the confidence interval for the additive score of
   * categorical variables.
   * @param d
   * @param xScale
   * @param yScale
   */
  const createDotConfidencePath = (d, width, xScale, yScale) => {

    let topMid = {
      x: xScale(d.x),
      y: yScale(d.y + d.error)
    };

    let btmMid = {
      x: xScale(d.x),
      y: yScale(d.y - d.error)
    };
    
    // Draw the top line
    let pathStr = `M ${topMid.x - width}, ${topMid.y} L ${topMid.x + width}, ${topMid.y} `;

    // Draw the vertical line
    pathStr = pathStr.concat(`M ${topMid.x}, ${topMid.y} L ${btmMid.x}, ${btmMid.y} `);

    // Draw the bottom line
    pathStr = pathStr.concat(`M ${btmMid.x - width}, ${btmMid.y} L ${btmMid.x + width}, ${btmMid.y} `);

    return pathStr;
  };

  onMount(() => {mounted = true;});

  onDestroy(() => {
    sidebarStoreUnsubscribe();
    footerActionUnsubscribe();
    footerValueUnsubscribe();
    historyStoreUnsubscribe();
  });

  /**
   * Draw the plot in the SVG component
   * @param featureData
   */
  const drawFeature = async (featureData) => {
    console.log(featureData);

    initialized = true;

    // Register the feature name
    state.featureName = featureData.name;

    let svgSelect = d3.select(svg);

    // For categorical variables, the width depends on the number of levels
    // Level # <= 4 => 300, level # <= 10 => 450, others => 600
    // let levelNum = featureData.binLabel.length;
    // if (levelNum <= 10) width = 450;
    // if (levelNum <= 4) width = 300;

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
    // Approximate the longest width of score (y-axis)
    const yAxisWidth = 5 * d3.max(scoreRange.map(d => String(round(d, 1)).length));
    const chartWidth = width - svgPadding.left - svgPadding.right - yAxisWidth;
    const chartHeight = height - svgPadding.top - svgPadding.bottom - densityHeight;

    // Draw the bar legend
    drawBarLegend(svgSelect, width, svgPadding);

    let content = svgSelect.append('g')
      .attr('class', 'content')
      .attr('transform', `translate(${svgPadding.left}, ${svgPadding.top})`);
    
    let binValues = featureData.binLabel.map(d => labelEncoder[d]);

    let xScale = d3.scalePoint()
      .domain(binValues)
      .padding(0.7)
      .range([0, chartWidth]);

    // For the y scale, it seems InterpretML presets the center at 0 (offset
    // doesn't really matter in EBM because we can modify intercept)
    // TODO: Provide interaction for users to change the center point
    // Normalize the Y axis by the global score range
    let yScale = d3.scaleLinear()
      .domain(scoreRange)
      .range([chartHeight, 0]);

    state.oriXScale = xScale;
    state.oriYScale = yScale;
    state.curXScale = xScale;
    state.curYScale = yScale;

    // Use the # of ticks and y score range to set the default change unit for
    // the up and down in the context menu bar
    multiMenuControlInfo.changeUnit = round((scoreRange[1] - scoreRange[0]) / yScale.ticks().length, 4);

    // Create a data array by combining the bin labels, additive terms, and errors
    let pointData = {};

    for (let i = 0; i < featureData.binLabel.length; i++) {
      pointData[featureData.binLabel[i]] = {
        x: labelEncoder[featureData.binLabel[i]],
        y: featureData.additive[i],
        id: featureData.binLabel[i],
        error: featureData.error[i],
        count: featureData.count[i]
      };
    }

    state.pointData = pointData;

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
    let gridGroup = scatterPlotContent.append('g')
      .attr('class', 'scatter-plot-grid-group');

    let confidenceGroup = scatterPlotContent.append('g')
      .attr('class', 'scatter-plot-confidence-group');

    let barGroup = scatterPlotContent.append('g')
      .attr('class', 'scatter-plot-bar-group real');

    let scatterGroup = scatterPlotContent.append('g')
      .attr('class', 'scatter-plot-dot-group');

    barWidth = Math.min(30, xScale(pointData[2].x) - xScale(pointData[1].x));

    // We draw bars from the 0 baseline to the dot position
    barGroup.style('fill', colors.bar)
      .selectAll('rect')
      .data(Object.values(pointData), d => d.id)
      .join('rect')
      .attr('class', 'additive-bar')
      .attr('x', d => xScale(d.x) - barWidth / 2)
      .attr('y', d => d.y > 0 ? yScale(d.y) : yScale(0))
      .attr('width', barWidth)
      .attr('height', d => Math.abs(yScale(d.y) - yScale(0)));

    // We draw the shape function with many line segments (path)
    scatterGroup.selectAll('circle')
      .data(Object.values(pointData), d => d.id)
      .join('circle')
      .attr('class', 'additive-dot')
      .attr('cx', d => xScale(d.x))
      .attr('cy', d => yScale(d.y))
      .attr('r', rExtent[0])
      .style('stroke-width', 1);

    // Draw the underlying confidence interval
    confidenceGroup.style('stroke', colors.dotConfidence)
      .style('stroke-width', 2)
      .selectAll('path')
      .data(Object.values(pointData))
      .join('path')
      .attr('class', 'dot-confidence')
      .attr('d', d => createDotConfidencePath(d, 5, xScale, yScale));

    // Clone the rects and dots for original and last edit
    confidenceGroup.lower();

    barGroup.clone(true)
      .classed('last-edit-back', true)
      .classed('real', false)
      .lower()
      .selectAll('rect')
      .remove();

    barGroup.clone(true)
      .classed('last-edit-front', true)
      .classed('real', false)
      .raise()
      .selectAll('rect')
      .remove();

    barGroup.clone(true)
      .classed('original', true)
      .classed('real', false)
      .style('fill', 'hsl(0, 0%, 85%)')
      .style('opacity', 1)
      .lower();
    
    // Add level lines to the original bar group
    let originalFront = barGroup.clone(true)
      .classed('original-front', true)
      .classed('real', false)
      .raise();

    originalFront.selectAll('rect')
      .remove();

    originalFront.selectAll('path.original-line')
      .data(Object.values(pointData), d => d.id)
      .join('path')
      .attr('class', 'original-line')
      .style('stroke', 'hsl(0, 0%, 75%)')
      .attr('d', d => `M ${state.oriXScale(d.x) - barWidth / 2}, ${state.oriYScale(d.y)} l ${barWidth}, 0`);

    // Make sure the dots are on top
    confidenceGroup.raise();
    scatterGroup.raise();
    gridGroup.lower();
    

    // Draw the chart X axis
    // Hack: create a wrapper so we can apply clip before transformation
    let xAxisGroup = axisGroup.append('g')
      .attr('class', 'x-axis-wrapper')
      .attr('clip-path', `url(#${featureData.name.replace(/\s/g, '')}-x-axis-clip)`)
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(${yAxisWidth}, ${chartHeight})`)
      .call(d3.axisBottom(xScale));
    
    xAxisGroup.attr('font-family', defaultFont)
      .select('path')
      .style('stroke-width', 1.5);

    // Rotate the x axis label if there are too many values
    if (featureData.binLabel.length > 6) {
      xAxisGroup.selectAll('g.tick text')
        .attr('y', 0)
        .attr('x', 9)
        .attr('dy', '-0.6em')
        .attr('transform', 'rotate(90)')
        .style('text-anchor', 'start');
    }
    
    // Draw the chart Y axis
    let yAxisGroup = axisGroup.append('g')
      .attr('class', 'y-axis')
      .attr('transform', `translate(${yAxisWidth}, 0)`);
    
    yAxisGroup.call(d3.axisLeft(yScale));
    yAxisGroup.attr('font-family', defaultFont);

    yAxisGroup.append('g')
      .attr('class', 'y-axis-text')
      .attr('transform', `translate(${-yAxisWidth - 15}, ${chartHeight / 2}) rotate(-90)`)
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
        x1: labelEncoder[featureData.histEdge[i]],
        x2: labelEncoder[featureData.histEdge[i + 1]],
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
      .attr('transform', `translate(${-yAxisWidth - 15}, ${densityHeight / 2}) rotate(-90)`)
      .append('text')
      .attr('class', 'y-axis-text')
      .text('Density')
      .style('fill', colors.histAxis);

    // Add brush
    brush = d3.brush()
      .on('end', e => brushEndSelect(
        e, state, svg, multiMenu, brush, component, resetContextMenu, barWidth,
        ebm, sidebarStore, sidebarInfo, updateFeatureSidebar, resetFeatureSidebar,
        nullifyMetrics, computeSelectedEffects
      ))
      .on('start brush', e => brushDuring(e, state, svg, multiMenu, ebm, footerStore))
      .extent([[0, 0], [chartWidth, chartHeight]])
      .filter((e) => {
        if (selectMode) {
          return e.button === 0;
        } else {
          return e.button === 2;
        }
      });

    let brushGroup = scatterPlotContent.append('g')
      .attr('class', 'brush')
      .call(brush);
    
    // Change the style of the select box
    brushGroup.select('rect.overlay')
      .attr('cursor', null);

    // Add panning and zooming
    let zoom = d3.zoom()
      .scaleExtent(zoomScaleExtent)
      .translateExtent([[0, -Infinity], [width, Infinity]])
      .on('zoom', e => zoomed(e, state, xScale, yScale, svg, 2,
        1, yAxisWidth, chartWidth, chartHeight, multiMenu, component))
      .on('start', () => zoomStart(state, multiMenu))
      .on('end', () => zoomEnd(state, multiMenu))
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

    // Update the footer for more instruction
    footerStore.update(value => {
      value.help = '<b>Drag</b> to pan view, <b>Scroll</b> to zoom';
      return value;
    });

    // Try to restore the last edit if possible
    let hasBeenCreated = await tryRestoreLastEdit(state, svg, historyStore, ebm,
      sidebarStore, barWidth);

    if (!hasBeenCreated) {
      // Push the initial state into the history stack
      pushCurStateToHistoryStack(state, 'original', 'Original graph', historyStore, sidebarStore);
    } else {
      pushCurStateToHistoryStack(state, 'original',
        `Reloaded commit ${hasBeenCreated.substring(0, 7)}`,
        historyStore, sidebarStore);
    }

    sidebarInfo.historyHead = historyList.length - 1;
    sidebarInfo.previewHistory = false;
    sidebarStore.set(sidebarInfo);
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

    multiMenuControlInfo.setValue = null;

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

  const multiMenuMoveClicked = () => {

    // Step 1. create data clone buffers for user to change
    // We only do this when buffer has not been created --- it is possible that
    // user switch to move from other editing mode
    if (state.pointDataBuffer === null) {
      state.pointDataBuffer = JSON.parse(JSON.stringify(state.pointData));
    }

    let bboxGroup = d3.select(svg)
      .select('g.scatter-plot-content-group g.select-bbox-group')
      .style('cursor', 'row-resize')
      .call(d3.drag()
        .on('start', () => {
          grayOutConfidenceLine(state, svg);
          // Update footer
          footerStore.update(value => {
            if (!value.baselineInit) {
              value.baseline = 0;
              value.baselineInit = true;
            }
            return value;
          });
        })
        .on('drag', (e) => dragged(e, state, svg, sidebarStore, sidebarInfo,
          ebm, setEBM, footerStore))
      );
    
    bboxGroup.select('rect.original-bbox')
      .classed('animated', true);
    
    // Show the last edit
    if (state.pointDataLastEdit !== undefined) {
      drawLastEdit(state, svg, barWidth);
    }

    // Copy current metrics as last metrics
    if (!sidebarInfo.hasUpdatedLastMetrics) {
      sidebarInfo.curGroup = 'last';
      sidebarInfo.hasUpdatedLastMetrics = true;
      sidebarStore.set(sidebarInfo);
    }

    // Update the footer message
    footerStore.update(value => {
      value.help = '<b>Drag</b> the <b>selected bars</b> to change score';
      return value;
    });

  };

  const multiMenuMergeClicked = () => {
    console.log('merge clicked');

    // Animate the bbox
    d3.select(svg)
      .select('g.scatter-plot-content-group g.select-bbox-group')
      .select('rect.original-bbox')
      .classed('animated', true);

    state.pointDataBuffer = JSON.parse(JSON.stringify(state.pointData));

    // Update EBM
    const callBack = () => {
      console.log(state.pointDataBuffer);
      setEBM(state, ebm, 'current', state.pointDataBuffer, sidebarStore, sidebarInfo);
    };

    // Update the last edit graph
    drawLastEdit(state, svg);

    merge(state, svg, 'left', callBack);

    myContextMenu.showConfirmation('merge', 600);

    if (!sidebarInfo.hasUpdatedLastMetrics) {
      sidebarInfo.curGroup = 'last';
      sidebarInfo.hasUpdatedLastMetrics = true;
      sidebarStore.set(sidebarInfo);
    }


    // Update the footer message
    footerStore.update(value => {
      value.type = 'align';
      value.state = `Set scores of ${state.selectedInfo.nodeData.length} bins to
        <b>${round(state.selectedInfo.nodeData[0].y, 4)}</b>`;
      return value;
    });
  };

  const multiMenuInputChanged = () => {
    // Animate the bbox
    d3.select(svg)
      .select('g.scatter-plot-content-group g.select-bbox-group')
      .select('rect.original-bbox')
      .classed('animated', true);

    state.pointDataBuffer = JSON.parse(JSON.stringify(state.pointData));

    if (!sidebarInfo.hasUpdatedLastMetrics) {
      sidebarInfo.curGroup = 'last';
      sidebarInfo.hasUpdatedLastMetrics = true;
      sidebarStore.set(sidebarInfo);
    }

    // Update EBM
    const callBack = () => {
      setEBM(state, ebm, 'current', state.pointDataBuffer, sidebarStore, sidebarInfo);
    };
    merge(state, svg, multiMenuControlInfo.setValue, callBack);

    myContextMenu.showConfirmation('change', 600);

    const target = round(multiMenuControlInfo.setValue, 4);

    // Update the footer message
    footerStore.update(value => {
      value.type = 'align';
      value.state = `Set scores of ${state.selectedInfo.nodeData.length} bins to <b>${target}</b>`;
      return value;
    });
  };

  const multiMenuMergeUpdated = () => {
    state.pointDataBuffer = JSON.parse(JSON.stringify(state.pointData));

    // Update EBM
    const callBack = () => {
      setEBM(state, ebm, 'current', state.pointDataBuffer, sidebarStore, sidebarInfo);
    };

    let target = merge(state, svg, multiMenuControlInfo.mergeMode, callBack);
    target = round(target, 4);

    // Update the footer message
    footerStore.update(value => {
      value.type = 'align';
      value.state = `Set scores of ${state.selectedInfo.nodeData.length} bins to <b>${target}</b>`;
      return value;
    });
  };

  const multiMenuDeleteClicked = () => {
    console.log('delete clicked');

    // Animate the bbox
    d3.select(svg)
      .select('g.scatter-plot-content-group g.select-bbox-group')
      .select('rect.original-bbox')
      .classed('animated', true);

    state.pointDataBuffer = JSON.parse(JSON.stringify(state.pointData));

    // Update the last edit graph
    drawLastEdit(state, svg);

    // Update EBM
    const callBack = () => {
      setEBM(state, ebm, 'current', state.pointDataBuffer, sidebarStore, sidebarInfo);
    };

    merge(state, svg, 0, callBack);

    myContextMenu.showConfirmation('delete', 600);

    // Copy current metrics as last metrics
    if (!sidebarInfo.hasUpdatedLastMetrics) {
      sidebarInfo.curGroup = 'last';
      sidebarInfo.hasUpdatedLastMetrics = true;
      sidebarStore.set(sidebarInfo);
    }

    // Update the footer message
    footerStore.update(value => {
      value.type = 'delete';
      value.state = `Set scores of ${state.selectedInfo.nodeData.length} bins to <b>${0}</b>`;
      return value;
    });
  };

  const multiMenuMoveCheckClicked = async () => {
    // Check if user is in previous commit
    if (sidebarInfo.previewHistory) {
      let proceed = confirm('Current graph is not on the latest edit, committing' +
        ' this edit would overwrite all later edits on this feature. Is it OK?'
      );
      if (!proceed) {
        multiMenuMoveCancelClicked();
        return;
      }
    }

    // Save the changes
    state.pointData = JSON.parse(JSON.stringify(state.pointDataBuffer));

    // Remove the drag
    let bboxGroup = d3.select(svg)
      .select('g.scatter-plot-content-group g.select-bbox-group')
      .style('cursor', null)
      .on('.drag', null);
    
    // stop the animation
    bboxGroup.select('rect.original-bbox')
      .classed('animated', false);

    // Move the menu bar
    d3.select(multiMenu)
      .call(moveMenubar, svg, component);

    // Save this change to lastEdit, update lastEdit graph
    if (state.pointDataLastEdit !== undefined) {
      state.pointDataLastLastEdit = JSON.parse(JSON.stringify(state.pointDataLastEdit));
    }
    state.pointDataLastEdit = JSON.parse(JSON.stringify(state.pointData));

    // Update metrics
    sidebarInfo.curGroup = 'commit';
    sidebarInfo.hasUpdatedLastMetrics = false;
    sidebarStore.set(sidebarInfo);

    // Query the global metrics and save it in the history if the scope is not in global
    if (sidebarInfo.effectScope !== 'global') {
      let metrics = await getEBMMetrics(state, ebm, 'global');
      transferMetricToSidebar(metrics, 'commit-not-global', ebm, sidebarStore, sidebarInfo);
    }

    // Wait until the the effect sidebar is updated
    if (ebm.isDummy === undefined) {
      while (sidebarInfo.curGroup !== 'commitCompleted') {
        await new Promise(r => setTimeout(r, 500));
      }
    }

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
    const selectedBins = state.selectedInfo.nodeData.map(d => d.x);
    const binRange = `["${selectedBins.join('", "')}"]`;

    const message = `${curEditBaseline >= 0 ? 'Increased' : 'Decreased'} scores of ${binRange} ` +
      `by ${round(Math.abs(curEditBaseline), 2)}.`;

    pushCurStateToHistoryStack(state, 'move', message, historyStore, sidebarStore);

    // Any new commit purges the redo stack
    redoStack = [];
  };

  const multiMenuMoveCancelClicked = () => {
    // Discard the changes
    state.pointDataBuffer = null;
    state.additiveDataBuffer = null;

    // Recover the original graph
    redrawOriginal(state, svg, true, () => {
      // Move the menu bar after animation
      d3.select(multiMenu)
        .call(moveMenubar, svg, component);

      // Recover the EBM
      setEBM(state, ebm, 'recoverEBM', state.pointData, sidebarStore, sidebarInfo, undefined, false);
    });

    // Update the metrics
    sidebarInfo.curGroup = 'recover';
    sidebarInfo.hasUpdatedLastMetrics = false;
    sidebarStore.set(sidebarInfo);

    // Remove the drag
    let bboxGroup = d3.select(svg)
      .select('g.scatter-plot-content-group g.select-bbox-group')
      .style('cursor', null)
      .on('.drag', null);
    
    // stop the animation
    bboxGroup.select('rect.original-bbox')
      .classed('animated', false);
    
    // Redraw the last edit if possible
    if (state.pointDataLastLastEdit !== undefined){
      state.pointDataLastEdit = JSON.parse(JSON.stringify(state.pointDataLastLastEdit));
      drawLastEdit(state, svg);
      // Prepare for next redrawing after recovering the last last edit graph
      state.pointDataLastEdit = JSON.parse(JSON.stringify(state.pointData));
    }
    
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
   * Event handler when user clicks the check icon in the sub-menu
   */
  const multiMenuSubItemCheckClicked = () => {
    // Check if user is in previous commit
    if (sidebarInfo.previewHistory) {
      let proceed = confirm('Current graph is not on the latest edit, committing' +
        ' this edit would overwrite all later edits on this feature. Is it OK?'
      );
      if (!proceed) {
        multiMenuMoveCancelClicked();
        return;
      }
    }

    if (multiMenuControlInfo.subItemMode === null) {
      console.error('No sub item is selected but check is clicked!');
    }

    const existingModes = new Set(['change', 'merge', 'delete']);
    if (!existingModes.has(multiMenuControlInfo.subItemMode)) {
      console.error(`Encountered unknown subItemMode: ${multiMenuControlInfo.subItemMode}`);
    }

    // Stop the bbox animation
    d3.select(svg)
      .select('g.scatter-plot-content-group g.select-bbox-group')
      .select('rect.original-bbox')
      .classed('animated', false);

    // Save the changes
    state.pointData = JSON.parse(JSON.stringify(state.pointDataBuffer));

    // Update the last edit data to current data (redraw the graph only when user enters
    // editing mode next time)
    if (state.pointDataLastEdit !== undefined) {
      state.pointDataLastLastEdit = JSON.parse(JSON.stringify(state.pointDataLastEdit));
    }
    state.pointDataLastEdit = JSON.parse(JSON.stringify(state.pointData));

    // Hide the confirmation panel
    myContextMenu.hideConfirmation(multiMenuControlInfo.subItemMode);

    // Move the menu bar
    d3.select(multiMenu)
      .call(moveMenubar, svg, component);
    
    // Exit the sub-item mode
    multiMenuControlInfo.subItemMode = null;
    multiMenuControlInfo.setValue = null;

    // Update metrics
    sidebarInfo.curGroup = 'commit';
    sidebarInfo.hasUpdatedLastMetrics = false;
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
    const selectedBins = state.selectedInfo.nodeData.map(d => d.x);
    const binRange = `["${selectedBins.join('", "')}"]`;

    let description = '';

    switch(editType) {
    case 'align':
      description = `Set scores of ${binRange} to ${round(state.selectedInfo.nodeData[0].y, 4)}.`;
      break;
    case 'delete':
      description = `Set scores of ${binRange} to ${round(state.selectedInfo.nodeData[0].y, 0)}.`;
      break;
    default:
      break;
    }

    pushCurStateToHistoryStack(state, editType, description, historyStore, sidebarStore);

    // Any new commit purges the redo stack
    redoStack = [];
  };

  /**
   * Event handler when user clicks the cross icon in the sub-menu
   */
  const multiMenuSubItemCancelClicked = (e, cancelFromMove = false) => {
    console.log('sub item cancel clicked');
    if (!cancelFromMove && multiMenuControlInfo.subItemMode === null) {
      console.error('No sub item is selected but check is clicked!');
    }

    const existingModes = new Set(['change', 'merge', 'delete']);
    if (!cancelFromMove && !existingModes.has(multiMenuControlInfo.subItemMode)) {
      console.error(`Encountered unknown subItemMode: ${multiMenuControlInfo.subItemMode}`);
    }

    // Stop the bbox animation
    d3.select(svg)
      .select('g.scatter-plot-content-group g.select-bbox-group')
      .select('rect.original-bbox')
      .classed('animated', false);

    // Discard the change
    state.pointDataBuffer = null;

    // Recover the last edit graph
    if (state.pointDataLastLastEdit !== undefined){
      state.pointDataLastEdit = JSON.parse(JSON.stringify(state.pointDataLastLastEdit));
      drawLastEdit(state, svg);
      // Prepare for next redrawing after recovering the last last edit graph
      state.pointDataLastEdit = JSON.parse(JSON.stringify(state.pointData));
    }

    // If the current edit is interpolation, we need to recover the bin definition
    // in the EBM model
    let callBack = () => {};

    if (!cancelFromMove) {
      callBack = () => {
        setEBM(state, ebm, 'recoverEBM', state.pointData,
          sidebarStore, sidebarInfo, undefined, false);
      };
    }

    // Update the metrics
    sidebarInfo.curGroup = 'recover';
    sidebarInfo.hasUpdatedLastMetrics = false;
    sidebarStore.set(sidebarInfo);

    // Recover the original graph
    redrawOriginal(state, svg, true, () => {
      // Move the menu bar after the animation
      d3.select(multiMenu)
        .call(moveMenubar, svg, component);

      // Update the EBM in "background"
      callBack();
    });

    // Hide the confirmation panel
    myContextMenu.hideConfirmation(multiMenuControlInfo.subItemMode);

    // Exit the sub-item mode
    multiMenuControlInfo.subItemMode = null;
    multiMenuControlInfo.setValue = null;

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
   * Event handler for the select button in the header
   */
  export const selectModeSwitched = () => {
    selectMode = !selectMode;

    let lineChartContent = d3.select(svg)
      .select('g.scatter-plot-content-group')
      .classed('select-mode', selectMode);
    
    lineChartContent.select('g.brush rect.overlay')
      .attr('cursor', null);
  };

  /**
   * Count the feature distribution for the selected test samples
   * @param {[number]} binIndexes Selected bin indexes
   */
  const updateFeatureSidebar = async (binIndexes) => {
    if (ebm.isDummy !== undefined) return;

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
   * Update the selected scope metrics
  */
  const computeSelectedEffects = async () => {
    if (sidebarInfo.effectScope === 'selected' && state.selectedInfo.hasSelected) {
      // Step 1: compute the original metrics
      // Be careful! The first commit might be on a different feature!
      // It is way too complicated to load the initial edit then come back (need to revert
      // every edit on every feature!)
      // Here we just use ignore it [better than confusing the users with some other "original"]
      // if (historyList[0].featureName !== state.featureName) {
      //   ebm.setEditingFeature(historyList[0].featureName);
      // }
      // await setEBM('original-only', historyList[0].state.pointData);
      // ebm.setEditingFeature(state.featureName);

      // Nullify the original
      sidebarInfo.curGroup = 'nullify';
      sidebarStore.set(sidebarInfo);
      while (sidebarInfo.curGroup !== 'nullifyCompleted') {
        await new Promise(r => setTimeout(r, 300));
      }

      // Step 2: Last edit
      if (sidebarInfo.historyHead - 1 >= 0 &&
        historyList[sidebarInfo.historyHead - 1].type !== 'original' &&
        historyList[sidebarInfo.historyHead - 1].featureName === state.featureName) {
        await setEBM(state, ebm, 'last-only', historyList[sidebarInfo.historyHead - 1].state.pointData,
          sidebarStore, sidebarInfo);
      }

      // Step 3: Current edit
      await setEBM(state, ebm, 'current-only', historyList[sidebarInfo.historyHead].state.pointData,
        sidebarStore, sidebarInfo);
    }
  };

  /**
   * Reset the feature count of selected samples to 0
   */
  const resetFeatureSidebar = async () => {
    if (ebm.isDummy !== undefined) return;

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

  /**
   * Set all metrics to null if there is no selection and the scope is 'selected'.
  */
  const nullifyMetrics = () => {
    if (!state.selectedInfo.hasSelected && sidebarInfo.effectScope === 'selected') {
      sidebarInfo.curGroup = 'nullify';
      sidebarStore.set(sidebarInfo);
    }
  };

  $: featureData && ebm && mounted && !initialized && featureData.name === ebm.editingFeatureName && drawFeature(featureData);

</script>

<style type='text/scss'>
  @import '../define';
  @import './common.scss';

  :global(.explain-panel path.dot-confidence.edited) {
    stroke: hsl(0, 0%, 75%);
  }

  :global(.explain-panel rect.additive-bar.selected) {
    fill: $orange-300;
    opacity: 0.9;
  }

  :global(.explain-panel .last-edit-back rect.additive-bar) {
    fill: hsl(35, 100%, 85%);
    opacity: 0.7;
  }

  :global(.explain-panel .last-edit-front path.additive-line) {
    stroke: hsl(35, 100%, 85%);
    opacity: 1;
  }

  :global(.explain-panel circle.additive-dot) {
    fill: $blue-icon;
    stroke: white;
  }

  :global(.explain-panel circle.additive-dot.selected) {
    fill: $orange-400;
    stroke: white;
  }

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

  <div class='context-menu-container hidden' bind:this={multiMenu}>
    <ContextMenu 
      bind:controlInfo={multiMenuControlInfo}
      bind:this={myContextMenu}
      type='cat'
      on:inputChanged={multiMenuInputChanged}
      on:moveButtonClicked={multiMenuMoveClicked}
      on:mergeClicked={multiMenuMergeClicked}
      on:mergeUpdated={multiMenuMergeUpdated}
      on:deleteClicked={multiMenuDeleteClicked}
      on:moveCheckClicked={multiMenuMoveCheckClicked}
      on:moveCancelClicked={multiMenuMoveCancelClicked}
      on:subItemCheckClicked={multiMenuSubItemCheckClicked}
      on:subItemCancelClicked={multiMenuSubItemCancelClicked}
    /> 
  </div>

  <div class='svg-container'>
    <svg class='svg-explainer' bind:this={svg}></svg>
  </div>
  
</div>