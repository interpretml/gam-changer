import { quitSelection } from './cont-brush';
import { get } from 'svelte/store';
import { state } from './cont-state';
import { drawLastEdit, redrawOriginal } from './cont-edit';
import { MD5 } from '../../utils/md5';

export const undoHandler = (svg, multiMenu, resetContextMenu, resetFeatureSidebar,
  historyStore, redoStack, setEBM, sidebarStore) => {
  let curCommit;
  let lastCommit;

  // Step 1: If the user has selected some nodes, discard the selections
  quitSelection(svg, multiMenu, resetContextMenu, resetFeatureSidebar);

  // Step 2: Remove the current commit from history
  historyStore.update(value => {
    curCommit = value.pop();
    lastCommit = value[value.length - 1];
    return value;
  });

  let curHistoryStoreValue = get(historyStore);

  // Step 3: Save the current commit into the redo stack
  redoStack.push(curCommit);

  // Step 4: Replace the current state with last commit
  state.additiveData = lastCommit.state.additiveData;
  state.pointData = lastCommit.state.pointData;

  state.additiveDataBuffer = null;
  state.pointDataBuffer = null;

  // Step 5: Update the last edit state, redraw the last edit graphs
  if (curHistoryStoreValue.length > 1) {
    state.additiveDataLastEdit = curHistoryStoreValue[curHistoryStoreValue.length - 2].state.additiveData;
    drawLastEdit(svg);
  } else {
    // If there is no last edit, then it is the origin
    state.additiveDataLastEdit = undefined;
  }

  // Step 6: Update the last last edit state
  if (curHistoryStoreValue.length > 2) {
    state.additiveDataLastLastEdit = curHistoryStoreValue[curHistoryStoreValue.length - 3].state.additiveData;
  } else {
    // If there is no last last edit, then it is the origin or the first edit
    state.additiveDataLastLastEdit = undefined;
  }

  // Step 7: If the current edit has changed the EBM bin definition, then we need
  // to reset the definition in WASM
  if (curCommit.type.includes('equal')) {
    setEBM('current', state.pointData);
  }

  /**
   * Step 8: Update the metrics, last metrics
   * It depends on the current effect mode:
   * 1. Global: load the metrics from history stack => update the tab
   * 2. Selected: the selection is canceled => show NA everywhere
   * 3. Slice: Reset EBM to compute the metrics :(
   */
  let sidebarInfo = get(sidebarStore);
  switch (sidebarInfo.effectScope) {
  case 'global':
    sidebarStore.update(value => {
      value.curGroup = 'overwrite';
      value.barData = JSON.parse(JSON.stringify(lastCommit.metrics.barData));
      value.confusionMatrixData = JSON.parse(JSON.stringify(lastCommit.metrics.confusionMatrixData));
      return value;
    });
    break;
  case 'selected':
    sidebarStore.update(value => {
      value.curGroup = 'nullify';
      return value;
    });
    break;
  case 'slice':
    break;
  default:
    break;
  }

  // Redraw the graph
  redrawOriginal(svg);
};

export const redoHandler = (svg, multiMenu, resetContextMenu, resetFeatureSidebar,
  historyStore, redoStack, setEBM, sidebarStore) => {
  // Step 1: If the user has selected some nodes, discard the selections
  quitSelection(svg, multiMenu, resetContextMenu, resetFeatureSidebar);

  // Step 2: Pop the redo stack and add it to the history stack
  let newCommit = redoStack.pop();

  historyStore.update(value => {
    value.push(newCommit);
    return value;
  });

  let curHistoryStoreValue = get(historyStore);

  // Replace the current state with the new commit
  state.additiveData = newCommit.state.additiveData;
  state.pointData = newCommit.state.pointData;

  state.additiveDataBuffer = null;
  state.pointDataBuffer = null;

  // Update the last edit state, redraw the last edit graphs
  if (curHistoryStoreValue.length > 1) {
    state.additiveDataLastEdit = curHistoryStoreValue[curHistoryStoreValue.length - 2].state.additiveData;
    drawLastEdit(svg);
  } else {
    // If there is no last edit, then it is the origin
    state.additiveDataLastEdit = undefined;
  }

  // Update the last last edit state
  if (curHistoryStoreValue.length > 2) {
    state.additiveDataLastLastEdit = curHistoryStoreValue[curHistoryStoreValue.length - 3].state.additiveData;
  } else {
    // If there is no last last edit, then it is the origin or the first edit
    state.additiveDataLastLastEdit = undefined;
  }

  // If the current edit has changed the EBM bin definition, then we need
  // to reset the definition in WASM
  if (newCommit.type.includes('equal')) {
    setEBM('current', state.pointData);
  }

  /**
   * Update the metrics, last metrics
   * It depends on the current effect mode:
   * 1. Global: load the metrics from redo stack => update the tab
   * 2. Selected: the selection is canceled => show NA everywhere
   * 3. Slice: Reset EBM to compute the metrics :(
   */
  let sidebarInfo = get(sidebarStore);
  switch (sidebarInfo.effectScope) {
  case 'global':
    sidebarStore.update(value => {
      value.curGroup = 'overwrite';
      value.barData = JSON.parse(JSON.stringify(newCommit.metrics.barData));
      value.confusionMatrixData = JSON.parse(JSON.stringify(newCommit.metrics.confusionMatrixData));
      return value;
    });
    break;
  case 'selected':
    sidebarStore.update(value => {
      value.curGroup = 'nullify';
      return value;
    });
    break;
  case 'slice':
    break;
  default:
    break;
  }

  // Redraw the graph
  redrawOriginal(svg);
};

export const pushCurStateToHistoryStack = (type, description, historyStore, sidebarInfo) => {
  historyStore.update(value => {
    const time = Date.now();

    value.push({
      state: {
        pointData: state.pointData,
        additiveData: state.additiveData
      },
      metrics: {
        barData: JSON.parse(JSON.stringify(sidebarInfo.barData)),
        confusionMatrixData: JSON.parse(JSON.stringify(sidebarInfo.confusionMatrixData))
      },
      featureId: 1,
      type: type,
      description: description,
      time: time,
      hash: MD5(`${type}${description}${time}`)
    });

    console.log(value.map(d => d.metrics.barData));
    return value;
  });
};