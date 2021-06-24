<script>
  import * as d3 from 'd3';
  import { round } from '../utils';
  import { config } from '../config';
  import { drawHorizontalColorLegend } from './draw';

  import { state } from './inter-cont-cat/cont-cat-state';
  import { SelectedInfo } from './inter-cont-cat/cont-cat-class';
  import { zoomStart, zoomEnd, zoomedLine, zoomedBar, zoomScaleExtent, rExtent } from './inter-cont-cat/cont-cat-zoom';
  import { brushDuring, brushEndSelect } from './inter-cont-cat/cont-cat-brush';

  import ToggleSwitch from '../components/ToggleSwitch.svelte';
  // import ContextMenu from '../components/ContextMenu.svelte';

  export let featureData = null;
  export let scoreRange = null;
  export let svgHeight = 400;
  export let chartType = 'bar';

  let svg = null;
  let component = null;
  let multiMenu = null;
  let myContextMenu = null;
  let multiMenuControlInfo = null;

  // Interactions
  let selectMode = false;
  state.selectedInfo = new SelectedInfo();

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
   * Create additiveData which is used to draw line segments for each categorical
   * level.
   * @param {[object]} featureData Original feature data passed from the parent component
   * @param {[object]} data Processed feature data (separated by cont/cat variables)
   */
  const createAdditiveData = (featureData, data) => {
    let additiveData = [];

    if (data.catDim === 0) {
      for (let c = 0; c < featureData.additive.length; c++) {
        let curValues = [];

        for (let i = 0; i < featureData.additive[0].length - 1; i++) {
          curValues.push({
            sx: data.contBinLabel[i],
            sAdditive: featureData.additive[c][i],
            sError: featureData.error[c][i],
            tx: data.contBinLabel[i + 1],
            tAdditive: featureData.additive[c][i + 1],
            tError: featureData.error[c][i + 1]
          });
        }

        // Finally, add the ending point (xMax without additive value)
        // We would use the second last point's additive value and error value
        let endI = featureData.additive[0].length - 1;
        curValues.push({
          sx: data.contBinLabel[endI],
          sAdditive: featureData.additive[c][endI],
          sError: featureData.error[c][endI],
          tx: data.contBinLabel[endI + 1],
          tAdditive: featureData.additive[c][endI],
          tError: featureData.error[c][endI]
        });

        additiveData.push(curValues);
      }
    } else {
      for (let c = 0; c < featureData.additive[0].length; c++) {
        let curValues = [];

        for (let i = 0; i < featureData.additive.length - 1; i++) {
          curValues.push({
            sx: data.contBinLabel[i],
            sAdditive: featureData.additive[i][c],
            sError: featureData.error[i][c],
            tx: data.contBinLabel[i + 1],
            tAdditive: featureData.additive[i + 1][c],
            tError: featureData.error[i + 1][c]
          });
        }

        // Finally, add the ending point (xMax without additive value)
        // We would use the second last point's additive value and error value
        let endI = featureData.additive.length - 1;
        curValues.push({
          sx: data.contBinLabel[endI],
          sAdditive: featureData.additive[endI][c],
          sError: featureData.error[endI][c],
          tx: data.contBinLabel[endI + 1],
          tAdditive: featureData.additive[endI][c],
          tError: featureData.error[endI][c]
        });

        additiveData.push(curValues);
      }
    }

    return additiveData;
  };

  /**
   * Separate feature data into categorical and continuous variables.
   * @param {object} featureData
   */
  const preProcessData = (featureData) => {
    let data = {};

    if (featureData.type1 === 'continuous' && featureData.type2 === 'categorical') {
      data.contBinLabel = featureData.binLabel1;
      data.catBinLabel = featureData.binLabel2;
      data.contName = featureData.name1;
      data.catName = featureData.name2;
      data.contHistEdge = featureData.histEdge1;
      data.catHistEdge = featureData.histEdge2;
      data.contHistCount = featureData.histCount1;
      data.catHistCount = featureData.histCount2;
      data.contDim = 0;
      data.catDim = 1;
    } else if (featureData.type2 === 'continuous' && featureData.type1 === 'categorical'){
      data.contBinLabel = featureData.binLabel2;
      data.catBinLabel = featureData.binLabel1;
      data.contName = featureData.name2;
      data.catName = featureData.name1;
      data.contHistEdge = featureData.histEdge2;
      data.catHistEdge = featureData.histEdge1;
      data.contHistCount = featureData.histCount2;
      data.catHistCount = featureData.histCount1;
      data.contDim = 1;
      data.catDim = 0;
    } else {
      console.error('The interaction is not continuous x categorical.');
    }

    return data;
  };

  /**
   * Draw the plot in the SVG component
   * @param featureData
   */
  const drawFeatureLine = (featureData) => {
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

    // We want to draw continuous variable on the x-axis, and categorical variable
    // as lines. Need to figure out individual variable type.
    let data = preProcessData(featureData);

    console.log(data);

    // Some constant lengths of different elements
    const yAxisWidth = 30;

    let legendConfig = {
      maxWidth: 100,
      leftMargin: 15,
      rightMargin: 8,
      lineHeight: 21,
      rectWidth: 25,
      rectHeight: 3,
      rectGap: 7,
      leftPadding: 5,
      topPadding: 8,
      btmPadding: 15
    };

    // Pre-populate the categorical variable legend to compute its width
    let hiddenLegendGroup = content.append('g')
      .style('visibility', 'hidden');
    
    hiddenLegendGroup.append('text')
      .attr('class', 'legend-title')
      .text(data.catName);
    
    let hiddenLegendContent = hiddenLegendGroup.append('g')
      .attr('transform', `translate(${0}, ${legendConfig.lineHeight})`);
    
    let hiddenLegendValues = hiddenLegendContent.selectAll('g.legend-value')
      .data(data.catHistEdge)
      .join('g')
      .attr('class', 'legend-value')
      .attr('transform', (d, i) => `translate(${0}, ${i * legendConfig.lineHeight})`);
    
    hiddenLegendValues.append('rect')
      .attr('y', -legendConfig.rectHeight / 2)
      .attr('width', legendConfig.rectWidth)
      .attr('height', legendConfig.rectHeight)
      .style('fill', 'navy');

    hiddenLegendValues.append('text')
      .attr('x', legendConfig.rectWidth + legendConfig.rectGap)
      .text(d => d);
    
    // Get the width and height of the legend box
    let bbox = hiddenLegendGroup.node().getBBox();

    // TODO: need to handle case where categorical labels are too long
    legendConfig.width = Math.min(round(bbox.width, 2), legendConfig.maxWidth);
    legendConfig.height = round(bbox.height, 2);

    // Compute the offset for the content box so we can center it
    let innerBbox = hiddenLegendContent.node().getBBox();
    legendConfig.centerOffset = (legendConfig.width - round(innerBbox.width, 2)) / 2;

    hiddenLegendGroup.remove();
    
    const chartWidth = width - svgPadding.left - svgPadding.right - yAxisWidth -
      legendConfig.width - legendConfig.rightMargin - legendConfig.leftMargin;
    const chartHeight = height - svgPadding.top - svgPadding.bottom - densityHeight;

    let xMin = data.contBinLabel[0];
    let xMax = data.contBinLabel[data.contBinLabel.length - 1];

    let xScale = d3.scaleLinear()
      .domain([xMin, xMax])
      .range([0, chartWidth]);

    // For the y scale, it seems InterpretML presets the center at 0 (offset
    // doesn't really matter in EBM because we can modify intercept)
    // TODO: Provide interaction for users to change the center point
    // Normalize the Y axis by the global score range
    let yScale = d3.scaleLinear()
      .domain(scoreRange)
      .range([chartHeight, 0]);

    // Create a data array by combining the bin labels, additive terms, and errors
    // Each line only counts additive term at one categorical level
    let additiveData = createAdditiveData(featureData, data);

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
    
    // Draw the line chart
    let lineChart = content.append('g')
      .attr('class', 'line-chart-group');

    lineChart.append('clipPath')
      .attr('id', `${featureData.name.replace(/\s/g, '')}-chart-clip`)
      .append('rect')
      .attr('width', chartWidth)
      .attr('height', chartHeight - 1);

    lineChart.append('clipPath')
      .attr('id', `${featureData.name.replace(/\s/g, '')}-x-axis-clip`)
      .append('rect')
      .attr('x', yAxisWidth)
      .attr('y', chartHeight)
      .attr('width', chartWidth)
      .attr('height', densityHeight);

    let axisGroup = lineChart.append('g')
      .attr('class', 'axis-group');
    
    let lineChartContent = lineChart.append('g')
      .attr('class', 'line-chart-content-group')
      .attr('clip-path', `url(#${featureData.name.replace(/\s/g, '')}-chart-clip)`)
      .attr('transform', `translate(${yAxisWidth}, 0)`);

    // Append a rect so we can listen to events
    lineChartContent.append('rect')
      .attr('width', chartWidth)
      .attr('height', chartHeight)
      .style('opacity', 0);

    // Create a group to draw grids
    lineChartContent.append('g')
      .attr('class', 'line-chart-grid-group');

    let confidenceGroup = lineChartContent.append('g')
      .attr('class', 'line-chart-confidence-group');

    let lineGroup = lineChartContent.append('g')
      .attr('class', 'line-chart-line-group');

    // We draw the shape function with many line segments (path)
    // We draw it line by line
    let colorMap = new Map();

    for (let c = 0; c < additiveData.length; c++) {

      // Create line color
      let lineColor = d3.schemeTableau10[c];

      lineGroup.style('stroke-width', 2)
        .style('fill', 'none')
        .append('g')
        .style('stroke', lineColor)
        .attr('class', `line-group-${c}`)
        .selectAll('path')
        .data(additiveData[c])
        .join('path')
        .attr('class', 'additive-line-segment')
        .attr('d', d => {
          return `M ${xScale(d.sx)}, ${yScale(d.sAdditive)} L ${xScale(d.tx)}
            ${yScale(d.sAdditive)} L ${xScale(d.tx)}, ${yScale(d.tAdditive)}`;
        });

      // Draw the underlying confidence interval
      confidenceGroup.append('g')
        .attr('class', `confidence-group-${c}`)
        .selectAll('rect')
        .data(additiveData[c])
        .join('rect')
        .attr('class', 'line-confidence')
        .attr('x', d => xScale(d.sx))
        .attr('y', d => yScale(d.sAdditive + d.sError))
        .attr('width', d => xScale(d.tx) - xScale(d.sx))
        .attr('height', d => yScale(d.sAdditive - d.sError) - yScale(d.sAdditive + d.sError))
        .style('fill', lineColor)
        .style('opacity', 0.2);
      
      colorMap.set(data.catHistEdge[c], lineColor);
    }

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

    yAxisGroup.append('g')
      .attr('transform', `translate(${-yAxisWidth - 5}, ${chartHeight / 2}) rotate(-90)`)
      .append('text')
      .attr('class', 'y-axis-text')
      .text('score')
      .style('fill', 'black');

    // Draw the histograms at the bottom
    let histData = [];
    
    // Transform the count to frequency (percentage)
    let histCountSum = d3.sum(data.contHistCount);
    let histFrequency = data.contHistCount.map(d => d / histCountSum);

    for (let i = 0; i < histFrequency.length; i++) {
      histData.push({
        x1: data.contHistEdge[i],
        x2: data.contHistEdge[i + 1],
        height: histFrequency[i]
      });
    }

    let histYScale = d3.scaleLinear()
      .domain(d3.extent(histFrequency))
      .range([0, densityHeight]);

    let histWidth = Math.min(50, xScale(histData[0].x2) - xScale(histData[0].x1));

    // Draw the density histogram 
    let histChartContent = histChart.append('g')
      .attr('class', 'hist-chart-content-group')
      .attr('transform', `translate(${yAxisWidth}, ${chartHeight})`);

    histChartContent.selectAll('rect')
      .data(histData)
      .join('rect')
      .attr('class', 'hist-rect')
      .attr('x', d => xScale(d.x1))
      .attr('y', 0)
      .attr('width', histWidth)
      .attr('height', d => histYScale(d.height))
      .style('fill', colors.hist);
    
    // Draw a Y axis for the histogram chart
    let yAxisHistGroup = lineChart.append('g')
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
      .attr('class', 'y-axis-text')
      .attr('transform', `translate(${-yAxisWidth - 5}, ${densityHeight / 2}) rotate(-90)`)
      .append('text')
      .text('density')
      .style('fill', colors.histAxis);

    // Add panning and zooming
    let zoom = d3.zoom()
      .scaleExtent(zoomScaleExtent)
      .on('zoom', e => zoomedLine(e, xScale, yScale, svg, 2,
        1, yAxisWidth, chartWidth, chartHeight, null, component))
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

    // Draw a legend for the categorical data
    let legendGroup = content.append('g')
      .attr('class', 'legend-group')
      .attr('transform', `translate(${yAxisWidth + chartWidth + legendConfig.leftMargin}, ${0})`);

    legendGroup.append('rect')
      .attr('x', -legendConfig.leftPadding)
      .attr('y', -legendConfig.topPadding)
      .attr('width', legendConfig.width + legendConfig.leftPadding * 2)
      .attr('height', legendConfig.height + legendConfig.topPadding + legendConfig.btmPadding)
      .style('stroke', 'hsla(0, 0%, 0%, 0.1)')
      .style('fill', 'none');

    legendGroup.append('text')
      .attr('class', 'legend-title')
      .attr('x', legendConfig.width / 2)
      .style('text-anchor', 'middle')
      .text(data.catName);
    
    let legendContent = legendGroup.append('g')
      .attr('class', 'legend-content')
      .attr('transform', `translate(${legendConfig.centerOffset}, ${legendConfig.lineHeight + 10})`);
    
    let legendValues = legendContent.selectAll('g.legend-value')
      .data(data.catHistEdge)
      .join('g')
      .attr('class', 'legend-value')
      .attr('transform', (d, i) => `translate(${0}, ${i * legendConfig.lineHeight})`);
    
    legendValues.append('rect')
      .attr('y', -legendConfig.rectHeight / 2)
      .attr('width', legendConfig.rectWidth)
      .attr('height', legendConfig.rectHeight)
      .style('fill', d => colorMap.get(d));

    legendValues.append('text')
      .attr('x', legendConfig.rectWidth + legendConfig.rectGap)
      .text(d => d);

  };

  const drawFeatureBar = (featureData) => {
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

    // We want to draw continuous variable on the x-axis, and categorical variable
    // as lines. Need to figure out individual variable type.
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

    // We put continuous variable on the x-axis
    let xMin = data.contBinLabel[0];
    let xMax = data.contBinLabel[data.contBinLabel.length - 1];

    let xScale = d3.scaleLinear()
      .domain([xMin, xMax])
      .range([0, chartWidth]);

    // Categorical variable on the y-axis
    let yScale = d3.scalePoint()
      .domain(data.catHistEdge)
      .padding(0.7)
      .range([chartHeight, 0])
      .round(true);

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

    let additiveData = createAdditiveData(featureData, data);
    console.log(additiveData);

    // Create color scale for the bar chart
    let maxAbsScore = 0;
    additiveData.forEach(curArray => {
      curArray.forEach(d => {
        if (Math.abs(d.sAdditive) > maxAbsScore) maxAbsScore = Math.abs(d.sAdditive);
      });
    });
    console.log(maxAbsScore);

    // One can consider to use the color scale to encode the global range
    // let maxAbsScore = Math.max(Math.abs(scoreRange[0]), Math.abs(scoreRange[1]));
    let colorScale = d3.scaleLinear()
      .domain([-maxAbsScore, 0, maxAbsScore])
      .range([legendConfig.startColor, 'white', legendConfig.endColor]);

    // Draw the bar chart
    let barChart = content.append('g')
      .attr('transform', `translate(${0}, ${legendHeight})`)
      .attr('class', 'bar-chart-group');

    barChart.append('clipPath')
      .attr('id', `${featureData.name.replace(/\s/g, '')}-chart-clip`)
      .append('rect')
      .attr('width', chartWidth)
      .attr('height', chartHeight - 1);

    barChart.append('clipPath')
      .attr('id', `${featureData.name.replace(/\s/g, '')}-y-axis-clip`)
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', yAxisWidth)
      .attr('height', chartHeight);
    
    let barChartContent = barChart.append('g')
      .attr('class', 'bar-chart-content-group')
      .attr('clip-path', `url(#${featureData.name.replace(/\s/g, '')}-chart-clip)`)
      .attr('transform', `translate(${yAxisWidth}, 0)`);

    // Append a rect so we can listen to events
    barChartContent.append('rect')
      .attr('width', chartWidth)
      .attr('height', chartHeight)
      .style('opacity', 0);

    // Create a group to draw grids
    barChartContent.append('g')
      .attr('class', 'bar-plot-grid-group');

    let barGroup = barChartContent.append('g')
      .attr('class', 'bar-chart-bar-group');

    let axisGroup = barChart.append('g')
      .attr('class', 'axis-group');

    // Draw the bars one by one (iterate through the categorical levels)
    for (let l = 0; l < additiveData.length; l++) {
      barGroup.append('g')
        .attr('class', `bar-group-${l}`)
        .attr('transform', `translate(${0}, ${yScale(data.catHistEdge[l])})`)
        .selectAll('rect.bar')
        .data(additiveData[l])
        .join('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(d.sx))
        .attr('y', - barHeight / 2)
        .attr('width', d => xScale(d.tx) - xScale(d.sx))
        .attr('height', barHeight)
        .style('fill', d => colorScale(d.sAdditive));
    }

    // Draw the line chart X axis
    let xAxisGroup = axisGroup.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(${yAxisWidth}, ${chartHeight})`)
      .call(d3.axisBottom(xScale));
    
    xAxisGroup.attr('font-family', defaultFont);

    xAxisGroup.append('g')
      .attr('transform', `translate(${chartWidth / 2}, ${25})`)
      .append('text')
      .attr('class', 'x-axis-text')
      .text(data.contName)
      .style('fill', 'black');
    
    // Draw the line chart Y axis
    let yAxisGroup = axisGroup.append('g')
      .attr('class', 'x-axis-wrapper')
      .attr('clip-path', `url(#${featureData.name.replace(/\s/g, '')}-y-axis-clip)`)
      .append('g')
      .attr('class', 'y-axis')
      .attr('transform', `translate(${yAxisWidth}, 0)`);
    
    yAxisGroup.call(d3.axisLeft(yScale));
    yAxisGroup.attr('font-family', defaultFont);

    yAxisGroup.append('g')
      .attr('class', 'y-axis-text')
      .attr('transform', `translate(${-yAxisWidth - 5}, ${chartHeight / 2}) rotate(-90)`)
      .append('text')
      .text(data.catName)
      .style('fill', 'black');

    // Add panning and zooming
    let zoom = d3.zoom()
      .translateExtent([[-Infinity, 0], [Infinity, height]])
      .scaleExtent(zoomScaleExtent)
      .on('zoom', e => zoomedBar(e, xScale, yScale, svg, 2,
        1, yAxisWidth, chartWidth, chartHeight, legendHeight, null, component))
      .on('start', () => zoomStart(multiMenu))
      .on('end', () => zoomEnd(multiMenu))
      .filter(e => {
        if (selectMode) {
          return (e.type === 'wheel' || e.button === 2);
        } else {
          return (e.button === 0 || e.type === 'wheel');
        }
      });

    barChartContent.call(zoom)
      .call(zoom.transform, d3.zoomIdentity);

    barChartContent.on('dblclick.zoom', null);
    
    // Listen to double click to reset zoom
    barChartContent.on('dblclick', () => {
      barChartContent.transition('reset')
        .duration(750)
        .ease(d3.easeCubicInOut)
        .call(zoom.transform, d3.zoomIdentity);
    });
    
    // Draw a color legend
    let legendGroup = content.append('g')
      .attr('class', 'legend-group')
      .attr('transform', `translate(${width - legendConfig.width - svgPadding.right - svgPadding.left}, ${-5})`);
    
    drawHorizontalColorLegend(legendGroup, legendConfig, maxAbsScore);

    // Draw the cont histograms at the bottom
    let histData = [];
    
    // Transform the count to frequency (percentage)
    let histCountSum = d3.sum(data.contHistCount);
    let histFrequency = data.contHistCount.map(d => d / histCountSum);

    for (let i = 0; i < histFrequency.length; i++) {
      histData.push({
        x1: data.contHistEdge[i],
        x2: data.contHistEdge[i + 1],
        height: histFrequency[i]
      });
    }

    let histYScale = d3.scaleLinear()
      .domain(d3.extent(histFrequency))
      .range([0, densityHeight]);

    // Draw the density histogram 
    let histChartContent = histChart.append('g')
      .attr('class', 'hist-chart-content-group')
      .attr('transform', `translate(${yAxisWidth}, ${chartHeight + legendHeight})`);

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
    let yAxisHistGroup = barChart.append('g')
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

  let drawFeature = null;

  if (chartType === 'bar') {
    drawFeature = drawFeatureBar;
  } else if (chartType === 'line') {
    drawFeature = drawFeatureLine;
  } else {
    console.error('The provided chart type is not supported.');
  }

  /**
   * Event handler for the select button in the header
   */
  const selectModeSwitched = () => {
    selectMode = !selectMode;

    let lineChartContent = d3.select(svg)
      .select('g.scatter-plot-content-group')
      .classed('select-mode', selectMode);
    
    lineChartContent.select('g.brush rect.overlay')
      .attr('cursor', null);
  };

  $: featureData && drawFeature(featureData);

</script>

<style type='text/scss'>
  @import '../define';
  @import './common.scss';


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
    visibility: hidden;
    pointer-events: none;
  }

  :global(.explain-panel .legend-title) {
    font-size: 0.9em;
    dominant-baseline: hanging;
  }

  :global(.explain-panel .legend-value) {
    font-size: 13px;
    dominant-baseline: middle;
  }

  :global(.explain-panel .bar-chart-content-group) {
    cursor: grab;
  }

</style>

<div class='explain-panel' bind:this={component}>

  <!-- <div class='context-menu-container hidden' bind:this={multiMenu}>
    <ContextMenu 
      bind:controlInfo={multiMenuControlInfo}
      bind:this={myContextMenu}
      type='cat'
      on:inputChanged={multiMenuInputChanged}
      on:moveButtonClicked={multiMenuMoveClicked}
      on:mergeClicked={multiMenuMergeClicked}
      on:deleteClicked={multiMenuDeleteClicked}
      on:moveCheckClicked={multiMenuMoveCheckClicked}
      on:moveCancelClicked={multiMenuMoveCancelClicked}
      on:subItemCheckClicked={multiMenuSubItemCheckClicked}
      on:subItemCancelClicked={multiMenuSubItemCancelClicked}
    /> 
  </div> -->

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
        <ToggleSwitch name='cont-cat' on:selectModeSwitched={selectModeSwitched}/>
      </div>
    </div>

  </div>


  <div class='svg-container'>
    <svg class='svg-explainer' bind:this={svg}></svg>
  </div>
  
</div>