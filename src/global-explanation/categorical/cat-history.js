// import { quitSelection } from './cat-brush';
import { drawLastEdit, redrawOriginal } from './cat-edit';
import { MD5 } from '../../utils/md5';

/**
 * Add a new commit to the history stack
 * @param {object} state Global state
 * @param {str} type Commit type
 * @param {str} description Commit description
 * @param {object} historyStore Store object of the history stack
 * @param {object} sidebarStore sidebar store object
 */
export const pushCurStateToHistoryStack = (state, type, description, historyStore, sidebarStore) => {
  // Push the new commit to the history stack
  let historyLength = 0;
  let sidebarInfo;

  sidebarStore.update(value => {
    sidebarInfo = value;
    return value;
  });

  historyStore.update(value => {
    const time = Date.now();

    value.push({
      state: {
        pointData: state.pointData,
      },
      metrics: {
        barData: JSON.parse(JSON.stringify(sidebarInfo.barData)),
        confusionMatrixData: JSON.parse(JSON.stringify(sidebarInfo.confusionMatrixData))
      },
      featureName: state.featureName,
      type: type,
      description: description,
      time: time,
      hash: MD5(`${type}${description}${time}`),
      reviewed: type === 'original'
    });

    historyLength = value.length;
    return value;
  });

  // Change the HEAD pointer to new commit
  sidebarStore.update(value => {
    value.historyHead = historyLength - 1;
    value.previewHistory = false;
    return value;
  });
};