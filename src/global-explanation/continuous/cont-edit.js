import * as d3 from 'd3';
import { state } from './cont-state';
import { rScale } from './cont-zoom';

export const dragged = (e, svg) => {

  const dataYChange = state.curYScale.invert(e.y) - state.curYScale.invert(e.y - e.dy);

  // Change the data based on the y-value changes, then redraw nodes (preferred method)
  state.selectedInfo.nodeData.forEach(d => {
    const id = d.id;
    const curPoint = state.pointDataBuffer[id];

    // Step 1.1: update point data
    state.pointDataBuffer[id].y += dataYChange;

    // Step 1.2: update path data

    // i's Left line
    const leftLineIndex = curPoint.leftLineIndex;
    if (leftLineIndex !== null) {
      state.additiveDataBuffer[leftLineIndex].y2 += dataYChange;
    }

    // i's Right line
    const rightLineIndex = curPoint.rightLineIndex;
    state.additiveDataBuffer[rightLineIndex].y1 += dataYChange;
    state.additiveDataBuffer[rightLineIndex].y2 += dataYChange;
    state.additiveDataBuffer[rightLineIndex].sy += dataYChange;

    // (i + 1)'s Left line
    if (curPoint.rightPointID !== null) {
      const nextLeftLineIndex = state.pointDataBuffer[curPoint.rightPointID].leftLineIndex;
      state.additiveDataBuffer[nextLeftLineIndex].y1 += dataYChange;
      state.additiveDataBuffer[nextLeftLineIndex].sy += dataYChange;
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

  nodes.data(Object.values(state.pointData), d => d.id)
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
    .attr('y', d => state.curYScale(d.y1) - curPadding)
    .attr('height', d => state.curYScale(d.y2) - state.curYScale(d.y1) + 2 * curPadding);
};

export const redrawMonotone = (svg, isoYs) => {

  // Change the data based on the y-value changes, then redraw nodes (preferred method)
  state.selectedInfo.nodeData.forEach((d, j) => {
    const id = d.id;
    const curPoint = state.pointDataBuffer[id];

    // Step 1.1: update point data
    state.pointDataBuffer[id].y = isoYs[j];

    // Step 1.2: update path data

    // i's Left line
    const leftLineIndex = curPoint.leftLineIndex;
    if (leftLineIndex !== null) {
      state.additiveDataBuffer[leftLineIndex].y2 = isoYs[j];
    }

    // i's Right line
    const rightLineIndex = curPoint.rightLineIndex;
    state.additiveDataBuffer[rightLineIndex].y1 = isoYs[j];
    state.additiveDataBuffer[rightLineIndex].y2 = isoYs[j];
    state.additiveDataBuffer[rightLineIndex].sy = isoYs[j];

    // (i + 1)'s Left line
    if (curPoint.rightPointID !== null) {
      const nextLeftLineIndex = state.pointDataBuffer[curPoint.rightPointID].leftLineIndex;
      state.additiveDataBuffer[nextLeftLineIndex].y1 = isoYs[j];
      state.additiveDataBuffer[nextLeftLineIndex].sy = isoYs[j];
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
    nodes.data(Object.values(state.pointDataBuffer), d => d.id)
      .join('circle')
      .transition(trans)
      .attr('cy', d => state.oriYScale(d.y));
  } else {
    nodes.data(Object.values(state.pointDataBuffer), d => d.id)
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


