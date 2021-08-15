import d3 from '../../utils/d3-import';
import { rScale } from './cat-zoom';
import { round } from '../../utils/utils';

let dragTimeout = null;

export const dragged = (e, state, svg, sidebarStore, sidebarInfo, ebm, setEBM, footerStore) => {

  const dataYChange = state.curYScale.invert(e.y) - state.curYScale.invert(e.y - e.dy);

  // Change the data based on the y-value changes, then redraw nodes (preferred method)
  state.selectedInfo.nodeData.forEach(d => {

    // Step 1.1: update point data
    state.pointDataBuffer[d.id].y += dataYChange;
  });

  // Step 1.2: update the bbox info
  state.selectedInfo.updateNodeData(state.pointDataBuffer);
  state.selectedInfo.computeBBox(state.pointDataBuffer);

  // Draw the new graph
  drawBufferGraph(state, svg, false, 400);

  const useTimeout = sidebarInfo.totalSampleNum > 2000;

  // Update the sidebar info
  if (dragTimeout !== null) {
    clearTimeout(dragTimeout);
  }

  dragTimeout = setTimeout(() => {
    setEBM(state, ebm, 'current', state.pointDataBuffer, sidebarStore, sidebarInfo);
  }, useTimeout ? 300 : 0);

  // Update the footer message
  footerStore.update(value => {
    value.baseline += dataYChange;
    value.state = `Scores <b>${value.baseline >= 0 ? 'increased' : 'decreased'}</b> by <b>${round(Math.abs(value.baseline), 2)}</b>`;
    return value;
  });
};

export const drawBufferGraph = (state, svg, animated, duration, callback = () => { }) => {
  const svgSelect = d3.select(svg);

  let trans = d3.transition('buffer')
    .duration(duration)
    .ease(d3.easeCubicInOut)
    .on('end', () => {
      callback();
    });

  let nodes = svgSelect.select('g.scatter-plot-dot-group')
    .selectAll('.additive-dot');

  let bars = svgSelect.select('g.scatter-plot-bar-group.real')
    .selectAll('.additive-bar');

  // Only update, no enter or exit
  if (animated) {
    nodes.data(Object.values(state.pointDataBuffer), d => d.id)
      .transition(trans)
      .attr('cx', d => state.oriXScale(d.x))
      .attr('cy', d => state.oriYScale(d.y));

    bars.data(Object.values(state.pointDataBuffer), d => d.id)
      .transition(trans)
      .attr('y', d => d.y > 0 ? state.oriYScale(d.y) : state.oriYScale(0))
      .attr('height', d => Math.abs(state.oriYScale(d.y) - state.oriYScale(0)));
  } else {
    nodes.data(Object.values(state.pointDataBuffer), d => d.id)
      .attr('cx', d => state.oriXScale(d.x))
      .attr('cy', d => state.oriYScale(d.y));

    bars.data(Object.values(state.pointDataBuffer), d => d.id)
      .attr('y', d => d.y > 0 ? state.oriYScale(d.y) : state.oriYScale(0))
      .attr('height', d => Math.abs(state.oriYScale(d.y) - state.oriYScale(0)));
  }

  // Move the selected bbox
  let curPadding = rScale(state.curTransform.k) + state.bboxPadding * state.curTransform.k;

  if (animated) {
    svgSelect.select('g.scatter-plot-content-group g.select-bbox-group')
      .selectAll('rect.select-bbox')
      .datum(state.selectedInfo.boundingBox[0])
      .transition(trans)
      .attr('y', d => state.curYScale(d.y1) - curPadding)
      .attr('height', d => state.curYScale(d.y2) - state.curYScale(d.y1) + 2 * curPadding);
  } else {
    svgSelect.select('g.scatter-plot-content-group g.select-bbox-group')
      .selectAll('rect.select-bbox')
      .datum(state.selectedInfo.boundingBox[0])
      .attr('y', d => state.curYScale(d.y1) - curPadding)
      .attr('height', d => state.curYScale(d.y2) - state.curYScale(d.y1) + 2 * curPadding);
  }
};

export const drawLastEdit = (state, svg, barWidth) => {
  if (state.pointDataLastEdit === undefined) {
    return;
  }

  const svgSelect = d3.select(svg);

  let trans = d3.transition('lastEdit')
    .duration(400)
    .ease(d3.easeCubicInOut);

  let bars = svgSelect.select('g.scatter-plot-bar-group.last-edit-back')
    .selectAll('.additive-bar');

  let lines = svgSelect.select('g.scatter-plot-bar-group.last-edit-front')
    .selectAll('.additive-line');

  bars.data(Object.values(state.pointDataLastEdit), d => d.id)
    .join(
      enter => enter.append('rect')
        .attr('class', 'additive-bar')
        .attr('x', d => state.oriXScale(d.x) - barWidth / 2)
        .attr('y', state.oriYScale(0))
        .attr('width', barWidth)
        .attr('height', 0)
        .call(enter => enter.transition(trans)
          .attr('y', d => d.y > 0 ? state.oriYScale(d.y) : state.oriYScale(0))
          .attr('height', d => Math.abs(state.oriYScale(d.y) - state.oriYScale(0)))
        ),
      update => update.call(update => update.transition(trans)
        .attr('y', d => d.y > 0 ? state.oriYScale(d.y) : state.oriYScale(0))
        .attr('height', d => Math.abs(state.oriYScale(d.y) - state.oriYScale(0)))
      )
    );

  lines.data(Object.values(state.pointDataLastEdit), d => d.id)
    .join(
      enter => enter.append('path')
        .attr('class', 'additive-line')
        .attr('d', d => `M ${state.oriXScale(d.x) - barWidth / 2}, ${state.oriYScale(d.y)} l ${barWidth}, 0`),
      update => update.call(update => update.transition(trans)
        .attr('d', d => `M ${state.oriXScale(d.x) - barWidth / 2}, ${state.oriYScale(d.y)} l ${barWidth}, 0`)
      )
    );

};

export const grayOutConfidenceLine = (state, svg) => {
  let editingIDs = new Set();
  state.selectedInfo.nodeData.forEach(d => editingIDs.add(d.id));

  d3.select(svg)
    .selectAll('.scatter-plot-confidence-group .dot-confidence')
    .filter(d => editingIDs.has(d.id))
    .classed('edited', true);
};

export const redrawOriginal = (state, svg, bounce=true, animationEndFunc=undefined) => {
  const svgSelect = d3.select(svg);

  let trans = d3.transition('restore')
    .duration(500)
    .ease(d3.easeElasticOut
      .period(0.35)
    );

  let transNoBounce = d3.transition('restoreNo')
    .duration(500)
    .ease(d3.easeLinear);

  if (!bounce) {
    trans = transNoBounce;
  }

  if (animationEndFunc !== undefined) {
    trans.on('end', animationEndFunc);
  }

  // Step 1: update the bbox info
  state.selectedInfo.updateNodeData(state.pointData);
  state.selectedInfo.computeBBox(state.pointData);

  // Step 2: redraw the nodes and bars with original data
  let nodes = svgSelect.select('g.scatter-plot-dot-group')
    .selectAll('.additive-dot');

  let bars = svgSelect.select('g.scatter-plot-bar-group.real')
    .selectAll('.additive-bar');

  // Only update, no enter or exit
  nodes.data(Object.values(state.pointData), d => d.id)
    .transition(trans)
    .attr('cx', d => state.oriXScale(d.x))
    .attr('cy', d => state.oriYScale(d.y));

  bars.data(Object.values(state.pointData), d => d.id)
    .transition(trans)
    .attr('y', d => d.y > 0 ? state.oriYScale(d.y) : state.oriYScale(0))
    .attr('height', d => Math.abs(state.oriYScale(d.y) - state.oriYScale(0)));

  // Step 4: move the selected bbox to their original place
  let curPadding = rScale(state.curTransform.k) + state.bboxPadding * state.curTransform.k;

  svgSelect.select('g.scatter-plot-content-group g.select-bbox-group')
    .selectAll('rect.select-bbox')
    .datum(state.selectedInfo.boundingBox[0])
    .transition(trans)
    .attr('y', d => state.curYScale(d.y1) - curPadding)
    .attr('height', d => state.curYScale(d.y2) - state.curYScale(d.y1) + 2 * curPadding);
};

export const merge = (state, svg, value, callBack) => {
  // Step 1: Find the left and right point in the selected region
  let leftPoint = { x: Infinity, y: null, id: null };
  let rightPoint = { x: -Infinity, y: null, id: null };

  let sum = 0;
  let count = 0;

  let selectedNodeXs = new Set();

  state.selectedInfo.nodeData.forEach((d, i) => {
    if (i === 0) {
      leftPoint = state.pointDataBuffer[d.id];
    }
    if (i === state.selectedInfo.nodeData.length - 1) {
      rightPoint = state.pointDataBuffer[d.id];
    }
    selectedNodeXs.add(d.x);
    sum += state.pointDataBuffer[d.id].y * state.pointDataBuffer[d.id].count;
    count += state.pointDataBuffer[d.id].count;
  });

  const average = sum / count;

  // Compute the merge values
  let target = 0;

  if (value === 'left') {
    target = leftPoint.y;
  } else if (value === 'right') {
    target = rightPoint.y;
  } else if (value === 'average') {
    target = average;
  } else {
    target = value;
  }

  // Step 2: Iterate through all nodes in the region and change their values
  Object.keys(state.pointDataBuffer).forEach(k => {
    let curPoint = state.pointDataBuffer[k];
    if (selectedNodeXs.has(curPoint.x)) {
      state.pointDataBuffer[k].y = target;
    }
  });

  // Step 3: update the bbox info
  state.selectedInfo.updateNodeData(state.pointDataBuffer);
  state.selectedInfo.computeBBox(state.pointDataBuffer);

  // Step 5: Update the graph using new data
  drawBufferGraph(state, svg, true, 500, callBack);

  return target;
};
