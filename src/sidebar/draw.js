import * as d3 from 'd3';
import { config } from '../config';
import { round } from '../utils';

/**
* Function to draw a curve (PR curve or ROC curve).
*/
export const drawCurve = (curve, isPR, svg, lineGroup, groupColors) => {
  const svgPadding = { top: 10, right: 40, bottom: 40, left: 40 };
  const defaultFont = config.defaultFont;

  let axisColor = groupColors.axis;

  // Create data based on the curve type
  let xText = isPR ? 'Recall' : 'False Positive Rate';
  let yText = isPR ? 'Precision' : 'True Positive Rate';

  let chartWidth = 200 - svgPadding.left - svgPadding.right;
  let chartHeight = 170 - svgPadding.top - svgPadding.bottom;
  let yAxisWidth = 15;

  // Create x and y axis
  let xScale = d3.scaleLinear().domain([0, 1]).range([0, chartWidth]);
  let yScale = d3.scaleLinear().domain([0, 1]).range([chartHeight, 0]);

  let xAxis = d3.axisBottom(xScale).ticks(2);
  let yAxis = d3.axisLeft(yScale).ticks(2);

  // Draw axis if user does not specify the argument
  if (svg.select('.x-axis-group').size() === 0) {

    // Add border
    svg.append('rect')
      .attr('class', 'border-rect')
      .attr('x', svgPadding.left + yAxisWidth)
      .attr('y', svgPadding.top)
      .attr('width', chartWidth)
      .attr('height', chartHeight)
      .style('fill', 'none')
      .style('stroke', axisColor);

    // Add axis to the plot
    svg.append('g')
      .attr('class', 'x-axis-group')
      .attr('transform', `translate(${svgPadding.left + yAxisWidth}, ${chartHeight + svgPadding.top})`)
      .call(xAxis)
      .attr('font-family', defaultFont)
      .style('color', axisColor)
      .append('text')
      .attr('class', 'axis-label')
      .attr('x', chartWidth / 2)
      .attr('y', 30)
      .attr('fill', axisColor)
      .style('text-anchor', 'middle')
      .text(xText);

    svg.append('g')
      .attr('class', 'y-axis-group')
      .attr('transform', `translate(${svgPadding.left + yAxisWidth}, ${svgPadding.top})`)
      .call(yAxis)
      .attr('font-family', defaultFont)
      .style('color', axisColor)
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('class', 'axis-label')
      .attr('x', -chartHeight / 2)
      .attr('y', -30)
      .attr('fill', axisColor)
      .style('text-anchor', 'middle')
      .text(yText);
  }

  // Generate line path
  let lineValue = d3.line()
    .curve(d3.curveStepAfter)
    .x(d => xScale(round(d[1], 4)))
    .y(d => yScale(round(d[0], 4)));

  // Add lines to the plot
  svg.selectAll(`g.${lineGroup}`)
    .data([curve])
    .join(
      enter => enter.append('g')
        .attr('class', `${lineGroup}`)
        .attr('transform', `translate(${svgPadding.left + yAxisWidth}, ${svgPadding.top})`)
        .append('path')
        .attr('d', d => lineValue(d))
        .style('stroke', groupColors[lineGroup])
        .style('fill', 'none'),
      update => update.select('path')
        .attr('d', d => lineValue(d)),
      exit => exit.remove()
    );

};