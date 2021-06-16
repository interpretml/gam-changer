import * as d3 from 'd3';
import { state } from './cont-state';
import { rScale } from './cont-zoom';

export const dragged = (e, svg) => {

  let dataYChange = state.curYScale.invert(e.y) - state.curYScale.invert(e.y - e.dy);

  // Change the data based on the y-value changes, then redraw nodes (preferred method)
  state.selectedInfo.nodeData.forEach(d => {
    let i = d.id;

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
  state.selectedInfo.updateNodeData(state.pointDataBuffer);
  state.selectedInfo.computeBBox();

  // Update the visualization with new data
  // Step 2: redraw the nodes that are changed
  drawBufferGraph(svg, false);
};

export const redrawOriginal = (svg, bounce=true, animationEndFunc=undefined) => {
  const svgSelect = d3.select(svg);

  let trans = d3.transition('restore')
    .duration(500)
    .ease(d3.easeElasticOut
      .period(0.35)
    );
  
  if (!bounce) {
    trans = d3.transition('restore')
      .duration(500)
      .ease(d3.easeCubicInOut);
  }

  if (animationEndFunc !== undefined) {
    trans.on('end', animationEndFunc);
  }

  // Step 1: update the bbox info
  state.selectedInfo.updateNodeData(state.pointData);
  state.selectedInfo.computeBBox();

  // Step 2: redraw the nodes with original data
  let nodes = svgSelect.select('g.line-chart-node-group')
    .selectAll('circle.node');

  nodes.data(state.pointData, d => d.id)
    .join('circle')
    .transition(trans)
    .attr('cy', d => state.oriYScale(d.y));

  // Step 3: redraw the paths with original data
  let paths = svgSelect.select('g.line-chart-line-group.real')
    .selectAll('path.additive-line-segment');

  paths.data(state.additiveData, d => `${d.id}-${d.pos}`)
    .join('path')
    .transition(trans)
    .attr('d', d => {
      return `M ${state.oriXScale(d.x1)}, ${state.oriYScale(d.y1)}
        L ${state.oriXScale(d.x2)} ${state.oriYScale(d.y2)}`;
    });

  // Step 4: move the selected bbox to their original place
  let curPadding = (rScale(state.curTransform.k) + state.bboxPadding) * state.curTransform.k;

  svgSelect.select('g.line-chart-content-group g.select-bbox-group')
    .selectAll('rect.select-bbox')
    .datum(state.selectedInfo.boundingBox[0])
    .transition(trans)
    .attr('y', d => state.curYScale(d.y1) - curPadding);
};

export const redrawMonotone = (svg, isoYs) => {

  // Change the data based on the y-value changes, then redraw nodes (preferred method)
  state.selectedInfo.nodeData.forEach((d, j) => {
    let i = d.id;

    // Step 1.1: update point data
    state.pointDataBuffer[i].y = isoYs[j];

    // Step 1.2: update path data
    // Here are some hacky math: the way I constructed the additive data is
    // ordered such that first node has a R line, second has a L line, a R line,
    // the third has a L line, a R line, the second last has a L line, a R line,
    // and we don't need to worry about the last point dragging
    // The corresponding indexes for id i is 2 * i and 2 * i - 1 (when i > 0)

    // i's Left line
    if (i > 0) {
      state.additiveDataBuffer[2 * i - 1].y2 = isoYs[j];
    }

    // i's Right line
    state.additiveDataBuffer[2 * i].y1 = isoYs[j];
    state.additiveDataBuffer[2 * i].y2 = isoYs[j];
    state.additiveDataBuffer[2 * i].sy = isoYs[j];

    // (i + 1)'s Left line
    if (2 * i + 1 < state.additiveDataBuffer.length) {
      state.additiveDataBuffer[2 * i + 1].y1 = isoYs[j];
      state.additiveDataBuffer[2 * i + 1].sy = isoYs[j];
    }
  });

  // Step 1.3: update the bbox info
  state.selectedInfo.updateNodeData(state.pointDataBuffer);
  state.selectedInfo.computeBBox();

  // Step 2 Update the visualization with new data
  drawBufferGraph(svg, true);

};

const drawBufferGraph = (svg, animated=true) => {

  const svgSelect = d3.select(svg);

  let trans = d3.transition('monotone')
    .duration(400)
    .ease(d3.easeCubicInOut);

  // Change the node data and node position based on the y-value changes
  let nodes = svgSelect.select('g.line-chart-node-group')
    .selectAll('circle.node');

  if (animated) {
    nodes.data(state.pointDataBuffer, d => d.id)
      .join('circle')
      .transition(trans)
      .attr('cy', d => state.oriYScale(d.y));
  } else {
    nodes.data(state.pointDataBuffer, d => d.id)
      .join('circle')
      .attr('cy', d => state.oriYScale(d.y));
  }

  // Step 2.2: redraw the paths that are changed
  let paths = svgSelect.select('g.line-chart-line-group.real')
    .selectAll('path.additive-line-segment');

  if (animated) {
    paths.data(state.additiveDataBuffer, d => `${d.id}-${d.pos}`)
      .join('path')
      .transition(trans)
      .attr('d', d => {
        return `M ${state.oriXScale(d.x1)}, ${state.oriYScale(d.y1)}
        L ${state.oriXScale(d.x2)} ${state.oriYScale(d.y2)}`;
      });
  } else {
    paths.data(state.additiveDataBuffer, d => `${d.id}-${d.pos}`)
      .join('path')
      .attr('d', d => {
        return `M ${state.oriXScale(d.x1)}, ${state.oriYScale(d.y1)}
        L ${state.oriXScale(d.x2)} ${state.oriYScale(d.y2)}`;
      });
  }

  // Step 2.3: move the selected bbox
  let curPadding = (rScale(state.curTransform.k) + state.bboxPadding) * state.curTransform.k;

  if (animated) {
    svgSelect.select('g.line-chart-content-group g.select-bbox-group')
      .selectAll('rect.select-bbox')
      .datum(state.selectedInfo.boundingBox[0])
      .transition(trans)
      .attr('y', d => state.curYScale(d.y1) - curPadding)
      .attr('height', d => state.curYScale(d.y2) - state.curYScale(d.y1) + 2 * curPadding);
  } else {
    svgSelect.select('g.line-chart-content-group g.select-bbox-group')
      .selectAll('rect.select-bbox')
      .datum(state.selectedInfo.boundingBox[0])
      .attr('y', d => state.curYScale(d.y1) - curPadding)
      .attr('height', d => state.curYScale(d.y2) - state.curYScale(d.y1) + 2 * curPadding);
  }

};


