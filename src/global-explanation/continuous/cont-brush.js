import * as d3 from 'd3';
import { SelectedInfo } from './cont-class';
import { moveMenubar } from './cont-bbox';
import { rScale } from './cont-zoom';
import { state } from './cont-state';
import { redrawOriginal, drawLastEdit } from './cont-edit';

// Need a timer to avoid the brush event call after brush.move()
let idleTimeout = null;
const idleDelay = 300;

// Brush zooming
const zoomTransitionTime = 700;

/**
 * Reset the idleTimeout timer
 */
const idled = () => {
  idleTimeout = null;
};

/**
 * Stop animating all flowing lines
 */
const stopAnimateLine = (svg) => {
  d3.select(svg)
    .select('g.line-chart-line-group')
    .selectAll('path.additive-line-segment.flow-line')
    .interrupt()
    .attr('stroke-dasharray', '0 0')
    .classed('flow-line', false);
};

export const brushDuring = (event, svg, multiMenu) => {
  // Get the selection boundary
  let selection = event.selection;
  let svgSelect = d3.select(svg);

  if (selection === null) {
    if (idleTimeout === null) {
      return idleTimeout = setTimeout(idled, idleDelay);
    }
  } else {
    // Compute the selected data region
    let xRange = [state.curXScale.invert(selection[0][0]), state.curXScale.invert(selection[1][0])];
    let yRange = [state.curYScale.invert(selection[1][1]), state.curYScale.invert(selection[0][1])];

    // Clean up the previous flowing lines
    state.selectedInfo = new SelectedInfo();

    // Remove the selection bbox
    svgSelect.selectAll('g.line-chart-content-group g.select-bbox-group').remove();

    d3.select(multiMenu)
      .classed('hidden', true);

    // Highlight the selected dots
    svgSelect.select('g.line-chart-node-group')
      .selectAll('circle.node')
      .classed('selected', d =>
        (d.x >= xRange[0] && d.x <= xRange[1] && d.y >= yRange[0] && d.y <= yRange[1])
      );

    // Highlight the paths associated with the selected dots
    svgSelect.select('g.line-chart-line-group.real')
      .selectAll('path.additive-line-segment')
      .classed('selected', d =>
        (d.sx >= xRange[0] && d.sx <= xRange[1] && d.sy >= yRange[0] && d.sy <= yRange[1]) ||
        (d.x1 === d.x2 && d.x2 >= xRange[0] && d.x2 <= xRange[1] && d.y2 >= yRange[0] && d.y2 <= yRange[1])
      );
  }
};

export const brushEndSelect = (event, svg, multiMenu, bboxStrokeWidth,
  brush, component, resetContextMenu
) => {
  // Get the selection boundary
  let selection = event.selection;
  let svgSelect = d3.select(svg);

  if (selection === null) {
    if (idleTimeout === null) {
      // Clean up the previous flowing lines
      stopAnimateLine();
      state.selectedInfo = new SelectedInfo();

      svgSelect.select('g.line-chart-content-group g.brush rect.overlay')
        .attr('cursor', null);

      d3.select(multiMenu)
        .classed('hidden', true);

      // End move mode
      resetContextMenu();

      // Do not save the user's change (same as clicking the cancel button)
      // Redraw the graph with original data
      redrawOriginal(svg);

      // Redraw the last edit if possible
      if (state.additiveDataLastLastEdit !== undefined) {
        state.additiveDataLastEdit = JSON.parse(JSON.stringify(state.additiveDataLastLastEdit));
        drawLastEdit(svg);
        // Prepare for next redrawing after recovering the last last edit graph
        state.additiveDataLastEdit = JSON.parse(JSON.stringify(state.additiveData));
      }

      // Remove the selection bbox
      svgSelect.selectAll('g.line-chart-content-group g.select-bbox-group').remove();

      return idleTimeout = setTimeout(idled, idleDelay);
    }
  } else {

    // Compute the selected data region
    let xRange = [state.curXScale.invert(selection[0][0]), state.curXScale.invert(selection[1][0])];
    let yRange = [state.curYScale.invert(selection[1][1]), state.curYScale.invert(selection[0][1])];

    // Highlight the selected dots
    svgSelect.select('g.line-chart-node-group')
      .selectAll('circle.node')
      .classed('selected', d => {
        if (d.x >= xRange[0] && d.x <= xRange[1] && d.y >= yRange[0] && d.y <= yRange[1]) {
          state.selectedInfo.nodeData.push({x: d.x, y: d.y, id: d.id});
          return true;
        } else {
          return false;
        }
      });

    // Compute the bounding box
    state.selectedInfo.computeBBox();

    let curPadding = (rScale(state.curTransform.k) + state.bboxPadding) * state.curTransform.k;

    let bbox = svgSelect.select('g.line-chart-content-group')
      .append('g')
      .attr('class', 'select-bbox-group')
      .selectAll('rect.select-bbox')
      .data(state.selectedInfo.boundingBox)
      .join('rect')
      .attr('class', 'select-bbox original-bbox')
      .attr('x', d => state.curXScale(d.x1) - curPadding)
      .attr('y', d => state.curYScale(d.y1) - curPadding)
      .attr('width', d => state.curXScale(d.x2) - state.curXScale(d.x1) + 2 * curPadding)
      .attr('height', d => state.curYScale(d.y2) - state.curYScale(d.y1) + 2 * curPadding)
      .style('stroke-width', bboxStrokeWidth)
      .style('stroke', 'hsl(230, 100%, 10%)')
      .style('stroke-dasharray', '5 3');

    bbox.clone(true)
      .classed('original-bbox', false)
      .style('stroke', 'white')
      .style('stroke-dasharray', null)
      .style('stroke-width', bboxStrokeWidth * 3)
      .lower();

    state.selectedInfo.hasSelected = svgSelect.selectAll('g.line-chart-node-group circle.node.selected').size() > 0;

    if (state.selectedInfo.hasSelected) {
      // Show the context menu near the selected region
      d3.select(multiMenu)
        .call(moveMenubar, svg, component)
        .classed('hidden', false);
    }

    // Remove the brush box
    svgSelect.select('g.line-chart-content-group g.brush')
      .call(brush.move, null)
      .select('rect.overlay')
      .attr('cursor', null);
  }
};

export const brushEndZoom = (event, xScale, yScale, initXDomain, initYDomain, svg, brush) => {
  // Get the selection boundary
  let selection = event.selection;

  // If there is no selection, return to the initial stage
  // Double click returns to the initial stage
  if (selection === null) {
    if (idleTimeout === null) {
      return idleTimeout = setTimeout(idled, idleDelay);
    }

    xScale.domain(initXDomain);
    yScale.domain(initYDomain);
  } else {
    // Rescale the x and y axises
    xScale.domain([xScale.invert(selection[0][0]), xScale.invert(selection[1][0])]);
    yScale.domain([yScale.invert(selection[1][1]), yScale.invert(selection[0][1])]);

    // Remove the brush box
    d3.select(svg)
      .select('g.line-chart-content-group g.brush')
      .call(brush.move, null);
  }

  // Zoom in to the new selection
  brushZoom(xScale, yScale);
};

const brushZoom = (xScale, yScale, svg) => {

  // Create a common transition
  let svgSelect = d3.select(svg);
  let trans = svgSelect.transition('zoom')
    .duration(zoomTransitionTime);

  // Update the axises
  svgSelect.select('g.x-axis')
    .transition(trans)
    .call(d3.axisBottom(xScale));

  svgSelect.select('g.y-axis')
    .transition(trans)
    .call(d3.axisLeft(yScale));

  // Redraw the lines using the new scale
  svgSelect.select('g.line-chart-line-group')
    .selectAll('path.additive-line-segment')
    .transition(trans)
    .attr('d', d => {
      return `M ${xScale(d.x1)}, ${yScale(d.y1)} L ${xScale(d.x2)} ${yScale(d.y2)}`;
    });

};