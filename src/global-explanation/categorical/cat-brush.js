import d3 from '../../utils/d3-import';
import { SelectedInfo } from './cat-class';
import { moveMenubar } from '../continuous/cont-bbox';
import { rExtent } from './cat-zoom';
import { redrawOriginal, drawLastEdit } from './cat-edit';
import { setEBM } from './cat-ebm';

// Need a timer to avoid the brush event call after brush.move()
let idleTimeout = null;
const idleDelay = 300;

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

export const brushDuring = (event, state, svg, multiMenu, ebm, footerStore) => {
  // Get the selection boundary
  let selection = event.selection;
  let svgSelect = d3.select(svg);

  if (selection === null) {
    if (idleTimeout === null) {
      return idleTimeout = setTimeout(idled, idleDelay);
    }
  } else {
    // Compute the selected data region
    // X is ordinal, we just use the view coordinate instead of data
    let xRange = [selection[0][0], selection[1][0]];
    let yRange = [state.curYScale.invert(selection[1][1]), state.curYScale.invert(selection[0][1])];

    // Clean up the previous flowing lines
    state.selectedInfo = new SelectedInfo();

    // Remove the selection bbox
    svgSelect.selectAll('g.scatter-plot-content-group g.select-bbox-group').remove();

    d3.select(multiMenu)
      .classed('hidden', true);

    // Track the selected bins
    let selectedBinIndexes = [];

    // Highlight the selected dots
    svgSelect.select('g.scatter-plot-dot-group')
      .selectAll('circle.additive-dot')
      .classed('selected', d => {
        if (state.curXScale(d.x) >= xRange[0] && state.curXScale(d.x) <= xRange[1]
          && d.y >= yRange[0] && d.y <= yRange[1]) {
          // For categorical data, the ID is from Interpret's label encoder (starting from 1)
          // EBM.js uses 0-based indexes
          selectedBinIndexes.push(d.id - 1);
          return true;
        }
      });

    // Highlight the bars associated with the selected dots
    svgSelect.select('g.scatter-plot-bar-group.real')
      .selectAll('rect.additive-bar')
      .classed('selected', d => (state.curXScale(d.x) >= xRange[0] &&
        state.curXScale(d.x) <= xRange[1] && d.y >= yRange[0] && d.y <= yRange[1]));

    // Update the footer message
    footerStore.update(value => {
      let sampleNum = ebm.getSelectedSampleNum(selectedBinIndexes);
      value.sample = `<b>${sampleNum}/${value.totalSampleNum}</b> test samples selected`;
      return value;
    });
  }
};

export const brushEndSelect = (event, state, svg, multiMenu, brush, component,
  resetContextMenu, barWidth, ebm, sidebarStore, sidebarInfo, updateFeatureSidebar,
  resetFeatureSidebar, nullifyMetrics, computeSelectedEffects
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

      let modeInfo = resetContextMenu();

      if (modeInfo.moveMode || modeInfo.subItemMode !== null) {
        // Do not save the user's change (same as clicking the cancel button)
        // Redraw the graph with original data
        redrawOriginal(state, svg, true, () => {
          setEBM(state, ebm, 'recoverEBM', state.pointData, sidebarStore, sidebarInfo, undefined, false);
        });

        // Redraw the last edit if possible
        if (state.pointDataLastLastEdit !== undefined) {
          state.pointDataLastEdit = JSON.parse(JSON.stringify(state.pointDataLastLastEdit));
          drawLastEdit(state, svg, barWidth);
          // Prepare for next redrawing after recovering the last last edit graph
          state.pointDataLastEdit = JSON.parse(JSON.stringify(state.pointData));
        }
      }

      // Recover the metrics if user is quitting context menu without committing
      sidebarStore.update(value => {
        // Svelte would trigger an update when update() is called
        // So if we want to avoid call 'recover' twice, we need to set another
        // message
        if (modeInfo.moveMode || modeInfo.subItemMode !== null) {
          value.curGroup = 'recover';
        } else {
          value.curGroup = 'no action';
        }
        value.hasUpdatedLastMetrics = false;
        return value;
      });

      // Remove the selection bbox
      svgSelect.selectAll('g.scatter-plot-content-group g.select-bbox-group').remove();

      // Reset the feature sidebar
      resetFeatureSidebar();

      // Nullify the metrics if in selected tab
      nullifyMetrics();

      return idleTimeout = setTimeout(idled, idleDelay);
    }
  } else {

    // Compute the selected data region
    // X is ordinal, we just use the view coordinate instead of data
    let xRange = [selection[0][0], selection[1][0]];
    let yRange = [state.curYScale.invert(selection[1][1]), state.curYScale.invert(selection[0][1])];

    let selectedBinIndexes = [];

    // Highlight the selected dots
    svgSelect.select('g.scatter-plot-dot-group')
      .selectAll('circle.additive-dot')
      .classed('selected', d => {
        if (state.curXScale(d.x) >= xRange[0] && state.curXScale(d.x) <= xRange[1] && d.y >= yRange[0] && d.y <= yRange[1]) {
          state.selectedInfo.nodeData.push({ x: d.x, y: d.y, id: d.id });
          selectedBinIndexes.push(d.id - 1);
          return true;
        } else {
          return false;
        }
      });

    // Compute the bounding box
    state.selectedInfo.computeBBox();

    let curPadding = (rExtent[0] + state.bboxPadding) * state.curTransform.k;

    let bbox = svgSelect.select('g.scatter-plot-content-group')
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
      .style('stroke-width', 1)
      .style('stroke', 'hsl(230, 100%, 10%)')
      .style('stroke-dasharray', '5 3');

    bbox.clone(true)
      .classed('original-bbox', false)
      .style('stroke', 'white')
      .style('stroke-dasharray', null)
      .style('stroke-width', 1 * 3)
      .lower();

    state.selectedInfo.hasSelected = svgSelect.selectAll('g.scatter-plot-dot-group circle.additive-dot.selected').size() > 0;

    if (state.selectedInfo.hasSelected) {
      // Show the context menu near the selected region
      d3.select(multiMenu)
        .call(moveMenubar, svg, component)
        .classed('hidden', false);

      // Trigger a counting of the feature distribution of the selected sampels
      updateFeatureSidebar(selectedBinIndexes);
    }

    // Nullify the metrics if in selected tab and no selection
    nullifyMetrics();

    // Recompute the selected effects if in selected tab and we do have selection
    computeSelectedEffects();

    // Remove the brush box
    svgSelect.select('g.scatter-plot-content-group g.brush')
      .call(brush.move, null)
      .select('rect.overlay')
      .attr('cursor', null);
  }
};

/**
 * Discard the current marquee selection. This function does not handle any graph
 * drawing/redrawing.
 * @param {object} svg The svg object
 * @param {object} multiMenu The multimenu object
 * @param {func} resetContextMenu Function to reset the context menu
 * @param {func} resetFeatureSidebar Function to reset the feature sidebar
 */
export const quitSelection = (svg, state, multiMenu, resetContextMenu, resetFeatureSidebar) => {
  let svgSelect = d3.select(svg);

  state.selectedInfo = new SelectedInfo();

  // De-highlight the paths associated with the selected dots
  svgSelect.select('g.scatter-plot-dot-group')
    .selectAll('circle')
    .classed('selected', false);

  svgSelect.select('g.scatter-plot-bar-group.real')
    .selectAll('rect')
    .classed('selected', false);

  svgSelect.select('g.scatter-plot-content-group g.brush rect.overlay')
    .attr('cursor', null);

  d3.select(multiMenu)
    .classed('hidden', true);

  // End move mode
  resetContextMenu();

  // Remove the selection bbox
  svgSelect.selectAll('g.scatter-plot-content-group g.select-bbox-group').remove();

  // Reset the feature sidebar
  resetFeatureSidebar();
};

export const selectAllBins = (svg, state, multiMenu, component, updateFeatureSidebar,
  brush, nullifyMetrics, computeSelectedEffects, footerStore, ebm) => {
  let svgSelect = d3.select(svg);

  let xRange = [-Infinity, Infinity];
  let yRange = [-Infinity, Infinity];

  let selectedBinIndexes = [];

  // Highlight the selected dots
  svgSelect.select('g.scatter-plot-dot-group')
    .selectAll('circle.additive-dot')
    .classed('selected', d => {
      if (state.curXScale(d.x) >= xRange[0] && state.curXScale(d.x) <= xRange[1] && d.y >= yRange[0] && d.y <= yRange[1]) {
        state.selectedInfo.nodeData.push({ x: d.x, y: d.y, id: d.id });
        selectedBinIndexes.push(d.id - 1);
        return true;
      } else {
        return false;
      }
    });

  // Highlight the bars associated with the selected dots
  svgSelect.select('g.scatter-plot-bar-group.real')
    .selectAll('rect.additive-bar')
    .classed('selected', d => (state.curXScale(d.x) >= xRange[0] &&
      state.curXScale(d.x) <= xRange[1] && d.y >= yRange[0] && d.y <= yRange[1]));

  // Update the footer message
  footerStore.update(value => {
    let sampleNum = ebm.getSelectedSampleNum(selectedBinIndexes);
    value.sample = `<b>${sampleNum}/${value.totalSampleNum}</b> test samples selected`;
    return value;
  });

  // Compute the bounding box
  state.selectedInfo.computeBBox();

  let curPadding = (rExtent[0] + state.bboxPadding) * state.curTransform.k;

  let bbox = svgSelect.select('g.scatter-plot-content-group')
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
    .style('stroke-width', 1)
    .style('stroke', 'hsl(230, 100%, 10%)')
    .style('stroke-dasharray', '5 3');

  bbox.clone(true)
    .classed('original-bbox', false)
    .style('stroke', 'white')
    .style('stroke-dasharray', null)
    .style('stroke-width', 1 * 3)
    .lower();

  state.selectedInfo.hasSelected = svgSelect.selectAll('g.scatter-plot-dot-group circle.additive-dot.selected').size() > 0;

  if (state.selectedInfo.hasSelected) {
    // Show the context menu near the selected region
    d3.select(multiMenu)
      .call(moveMenubar, svg, component)
      .classed('hidden', false);

    // Trigger a counting of the feature distribution of the selected samples
    updateFeatureSidebar(selectedBinIndexes);
  }

  // Nullify the metrics if in selected tab and no selection
  nullifyMetrics();

  // Recompute the selected effects if in selected tab and we do have selection
  computeSelectedEffects();

  // Remove the brush box
  svgSelect.select('g.scatter-plot-content-group g.brush')
    .call(brush.move, null)
    .select('rect.overlay')
    .attr('cursor', null);
};
