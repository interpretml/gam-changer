import * as d3 from 'd3';
import { state } from './cont-state';
import { rScale } from './cont-zoom';

export const dragged = (e, svg, oriXScale, oriYScale, bboxPadding) => {

  const svgSelect = d3.select(svg);

  // Change the node data and node position based on the y-value changes
  let nodes = svgSelect.select('g.line-chart-node-group')
    .selectAll('circle.node');

  let dataYChange = state.curYScale.invert(e.y) - state.curYScale.invert(e.y - e.dy);

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
  state.selectedInfo.nodeIndexes.forEach(i => {
    // Step 1.1: update point data
    state.pointDataBuffer[i].y += dataYChange;

    // Step 1.2: update path data
    // Here are some hacky math: the way I constructed the additive data is
    // ordered such that first node has a R line, second has a L line, a R line,
    // the third has a L line, a R line, the second last has a L line, a R line,
    // and we don't need to worry about the last point dragging
    // The corresponding indexes for id i is 2 * i and 2 * i - 1 (when i > 0)

    // i's Left line
    if (i > 0) {
      state.additiveDataBuffer[2 * i - 1].y2 += dataYChange;
    }

    // i's Right line
    state.additiveDataBuffer[2 * i].y1 += dataYChange;
    state.additiveDataBuffer[2 * i].y2 += dataYChange;
    state.additiveDataBuffer[2 * i].sy += dataYChange;

    // (i + 1)'s Left line
    if (2 * i + 1 < state.additiveDataBuffer.length) {
      state.additiveDataBuffer[2 * i + 1].y1 += dataYChange;
      state.additiveDataBuffer[2 * i + 1].sy += dataYChange;
    }
  });

  // Step 1.3: update the bbox info
  state.selectedInfo.updateNodeDataY(dataYChange);
  state.selectedInfo.computeBBox();

  // Update the visualization with new data

  // Step 2.1: redraw the nodes that are changed
  nodes.data(state.pointDataBuffer, d => d.id)
    .join('circle')
    .attr('cy', d => oriYScale(d.y));

  // Step 2.2: redraw the paths that are changed
  let paths = svgSelect.select('g.line-chart-line-group.real')
    .selectAll('path.additive-line-segment');

  paths.data(state.additiveDataBuffer, d => `${d.id}-${d.pos}`)
    .join('path')
    .attr('d', d => {
      return `M ${oriXScale(d.x1)}, ${oriYScale(d.y1)} L ${oriXScale(d.x2)} ${oriYScale(d.y2)}`;
    });

  // Step 2.3: move the selected bbox
  let curPadding = (rScale(state.curTransform.k) + bboxPadding) * state.curTransform.k;

  svgSelect.select('g.line-chart-content-group g.select-bbox-group')
    .selectAll('rect.select-bbox')
    .datum(state.selectedInfo.boundingBox[0])
    .attr('y', d => state.curYScale(d.y1) - curPadding);
};