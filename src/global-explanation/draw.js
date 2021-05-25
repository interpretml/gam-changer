import * as d3 from 'd3';

/**
 * Create a horizontal color legend.
 * @param legendGroup
 * @param legendConfig
 * @param largestAbs
 */
export const drawHorizontalColorLegend = (legendGroup, legendConfig, largestAbs) => {
  // Define the gradient
  let legendGradientDef = legendGroup.append('defs')
    .append('linearGradient')
    .attr('x1', 0)
    .attr('y1', 0)
    .attr('x2', 1)
    .attr('y2', 0)
    // TODO: use state to track the number of legend-gradient and make each of
    // them unique
    .attr('id', 'legend-gradient');

  legendGradientDef.append('stop')
    .attr('stop-color', legendConfig.startColor)
    .attr('offset', 0);

  legendGradientDef.append('stop')
    .attr('stop-color', '#ffffff')
    .attr('offset', 0.5);

  legendGradientDef.append('stop')
    .attr('stop-color', legendConfig.endColor)
    .attr('offset', 1);

  legendGroup.append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', legendConfig.width)
    .attr('height', legendConfig.height)
    .style('fill', 'url(#legend-gradient)')
    .style('stroke', 'hsla(0, 0%, 0%, 0.5)')
    .style('stroke-width', 0.3);

  // Draw the legend axis
  let legendScale = d3.scaleLinear()
    .domain([-largestAbs, largestAbs])
    .range([0, legendConfig.width]);

  legendGroup.append('g')
    .attr('transform', `translate(${0}, ${legendConfig.height})`)
    .call(d3.axisBottom(legendScale).ticks(5));

  legendGroup.append('text')
    .attr('class', 'legend-title')
    .attr('x', -10)
    .attr('y', 0)
    .style('dominant-baseline', 'hanging')
    .style('text-anchor', 'end')
    .text('Score');
};