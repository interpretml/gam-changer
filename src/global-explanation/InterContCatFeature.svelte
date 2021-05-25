<script>
  import * as d3 from 'd3';
  import { round } from '../utils';
  import { drawHorizontalColorLegend } from './draw';

  export let featureData = null;
  export let scoreRange = null;
  export let svgHeight = 400;
  export let chartType = 'bar';

  let svg = null;

  // Visualization constants
  const svgPadding = {
    top: 30, right: 10, bottom: 30, left: 25
  };
  const densityHeight = 90;

  // Viewbox width and height
  let width = 600;
  const height = 400;

  // Real width (depends on the svgHeight prop)
  let svgWidth = svgHeight * (width / height);

  // Show some hidden elements for development
  const showRuler = false;

  // Colors
  const colors = {
    line: 'hsl(222, 80%, 30%)',
    dot: 'hsla(222, 80%, 30%, 100%)',
    confidence: 'hsl(222, 55%, 70%)',
    hist: 'hsl(222, 10%, 93%)',
    histAxis: 'hsl(222, 10%, 70%)',
    line0: 'hsla(222, 0%, 0%, 5%)'
  };

  const defaultFont = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;';

  /**
   * Create addictiveData which is used to draw line segments for each categorical
   * level.
   * @param {[object]} featureData Original feature data passed from the parent component
   * @param {[object]} data Processed feature data (separated by cont/cat variables)
   */
  const createAddictiveData = (featureData, data) => {
    let addictiveData = [];

    if (data.catDim === 0) {
      for (let c = 0; c < featureData.addictive.length; c++) {
        let curValues = [];

        for (let i = 0; i < featureData.addictive[0].length - 1; i++) {
          curValues.push({
            sx: data.contBinLabel[i],
            sAddictive: featureData.addictive[c][i],
            sError: featureData.error[c][i],
            tx: data.contBinLabel[i + 1],
            tAddictive: featureData.addictive[c][i + 1],
            tError: featureData.error[c][i + 1]
          });
        }

        // Finally, add the ending point (xMax without addictive value)
        // We would use the second last point's addictive value and error value
        let endI = featureData.addictive[0].length - 1;
        curValues.push({
          sx: data.contBinLabel[endI],
          sAddictive: featureData.addictive[c][endI],
          sError: featureData.error[c][endI],
          tx: data.contBinLabel[endI + 1],
          tAddictive: featureData.addictive[c][endI],
          tError: featureData.error[c][endI]
        });

        addictiveData.push(curValues);
      }
    } else {
      for (let c = 0; c < featureData.addictive[0].length; c++) {
        let curValues = [];

        for (let i = 0; i < featureData.addictive.length - 1; i++) {
          curValues.push({
            sx: data.contBinLabel[i],
            sAddictive: featureData.addictive[i][c],
            sError: featureData.error[i][c],
            tx: data.contBinLabel[i + 1],
            tAddictive: featureData.addictive[i + 1][c],
            tError: featureData.error[i + 1][c]
          });
        }

        // Finally, add the ending point (xMax without addictive value)
        // We would use the second last point's addictive value and error value
        let endI = featureData.addictive.length - 1;
        curValues.push({
          sx: data.contBinLabel[endI],
          sAddictive: featureData.addictive[endI][c],
          sError: featureData.error[endI][c],
          tx: data.contBinLabel[endI + 1],
          tAddictive: featureData.addictive[endI][c],
          tError: featureData.error[endI][c]
        });

        addictiveData.push(curValues);
      }
    }

    return addictiveData;
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

    // Create a data array by combining the bin labels, addictive terms, and errors
    // Each line only counts addictive term at one categorical level
    let addictiveData = createAddictiveData(featureData, data);

    console.log(addictiveData);

    // Create histogram chart group
    let histChart = content.append('g')
      .attr('class', 'hist-chart-group')
      .attr('transform', `translate(${yAxisWidth}, ${chartHeight})`);
    
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
    // We draw it line by line
    let colorMap = new Map();

    for (let c = 0; c < addictiveData.length; c++) {

      // Create line color
      let lineColor = d3.schemeTableau10[c];

      lineGroup.append('g')
        .attr('class', `line-group-${c}`)
        .selectAll('path')
        .data(addictiveData[c])
        .join('path')
        .attr('class', 'addictive-line-segment')
        .attr('d', d => {
          return `M ${xScale(d.sx)}, ${yScale(d.sAddictive)} L ${xScale(d.tx)}
            ${yScale(d.sAddictive)} L ${xScale(d.tx)}, ${yScale(d.tAddictive)}`;
        })
        .style('stroke', lineColor)
        .style('stroke-width', 2)
        .style('fill', 'none');

      // Draw the underlying confidence interval
      confidenceGroup.append('g')
        .attr('class', `confidence-group-${c}`)
        .selectAll('rect')
        .data(addictiveData[c])
        .join('rect')
        .attr('class', 'line-confidence')
        .attr('x', d => xScale(d.sx))
        .attr('y', d => yScale(d.sAddictive + d.sError))
        .attr('width', d => xScale(d.tx) - xScale(d.sx))
        .attr('height', d => yScale(d.sAddictive - d.sError) - yScale(d.sAddictive + d.sError))
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

    histChart.selectAll('rect')
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
      .attr('class', 'hist-chart-group')
      .attr('transform', `translate(${yAxisWidth}, ${chartHeight + legendHeight})`);

    let addictiveData = createAddictiveData(featureData, data);
    console.log(addictiveData);

    // Create color scale for the bar chart
    let maxAbsScore = 0;
    addictiveData.forEach(curArray => {
      curArray.forEach(d => {
        if (Math.abs(d.sAddictive) > maxAbsScore) maxAbsScore = Math.abs(d.sAddictive);
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
    
    let barChartContent = barChart.append('g')
      .attr('class', 'bar-chart-content-group')
      .attr('transform', `translate(${yAxisWidth}, 0)`);

    let barGroup = barChartContent.append('g')
      .attr('class', 'bar-chart-bar-group');

    let axisGroup = barChart.append('g')
      .attr('class', 'axis-group');

    // Draw the bars one by one (iterate through the categorical levels)
    for (let l = 0; l < addictiveData.length; l++) {
      barGroup.append('g')
        .attr('class', `bar-group-${l}`)
        .attr('transform', `translate(${0}, ${yScale(data.catHistEdge[l])})`)
        .selectAll('rect.bar')
        .data(addictiveData[l])
        .join('rect')
        .attr('class', 'bar')
        .attr('x', d => xScale(d.sx))
        .attr('y', - barHeight / 2)
        .attr('width', d => xScale(d.tx) - xScale(d.sx))
        .attr('height', barHeight)
        .style('fill', d => colorScale(d.sAddictive));
    }

    // Draw the line chart X axis
    let xAxisGroup = axisGroup.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(${yAxisWidth}, ${chartHeight})`)
      .call(d3.axisBottom(xScale));
    
    xAxisGroup.attr('font-family', defaultFont);

    xAxisGroup.append('g')
      .attr('class', 'x-axis-text')
      .attr('transform', `translate(${chartWidth / 2}, ${25})`)
      .append('text')
      .text(data.contName)
      .style('fill', 'black');
    
    // Draw the line chart Y axis
    let yAxisGroup = axisGroup.append('g')
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
      .attr('class', 'y-axis-text')
      .attr('transform', `translate(${-yAxisWidth - 5}, ${densityHeight / 2}) rotate(-90)`)
      .append('text')
      .text('density')
      .style('fill', colors.histAxis);

  };

  let drawFeature = null;
  console.log(chartType);

  if (chartType === 'bar') {
    console.log(chartType, 'use bar chart!');
    drawFeature = drawFeatureBar;
  } else if (chartType === 'line') {
    console.log(chartType, 'use line chart!');
    drawFeature = drawFeatureLine;
  } else {
    console.error('The provided chart type is not supported.');
  }

  console.log(drawFeature);

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

  :global(.explain-panel .x-axis-text) {
    font-size: 1rem;
    text-anchor: middle;
    dominant-baseline: hanging;
  }

  :global(.explain-panel .addictive-line-segment) {
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  :global(.explain-panel .hidden) {
    display: none;
  }

  :global(.explain-panel .legend-title) {
    font-size: 0.9rem;
    dominant-baseline: hanging;
  }

  :global(.explain-panel .legend-value) {
    font-size: 13px;
    dominant-baseline: middle;
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