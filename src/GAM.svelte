
<script>
  import ContGlobalExplain from './global-explanation/ContFeature.svelte';
  import CatGlobalExplain from './global-explanation/CatFeature.svelte';
  import InterContCatGlobalExplain from './global-explanation/InterContCatFeature.svelte';
  import InterContContGlobalExplain from './global-explanation/InterContContFeature.svelte';
  import InterCatCatGlobalExplain from './global-explanation/InterCatCatFeature.svelte';
  import Sidebar from './sidebar/Sidebar.svelte';
  import ToggleSwitch from './components/ToggleSwitch.svelte';

  import * as d3 from 'd3';
  import { initEBM } from './ebm';
  import { onMount } from 'svelte';
  import { writable, derived, get } from 'svelte/store';
  import { downloadJSON, round } from './utils/utils';

  import redoIconSVG from './img/redo-icon.svg';
  import undoIconSVG from './img/undo-icon.svg';
  import exportIconSVG from './img/export-icon.svg';

  let data = null;
  let ebm = null;
  let component = null;
  let changer = null;
  let featureSelect = null;

  // Create stores to pass to child components
  let sidebarInfo = {};
  let sidebarStore = writable({
    rmse: 0,
    mae: 0,
    accuracy: 0,
    rocAuc: 0,
    balancedAccuracy: 0,
    confusionMatrix: [],
    prCurve: [],
    rocCurve: [],
    curGroup: '',
    selectedTab: 'effect',
    effectScope: 'global',
    historyHead: 0,
    previewHistory: false,
  });

  let footerStore = writable({
    sample: '',
    slice: '',
    help: '',
    state: '',
    baselineInit: false,
    baseline: 0,
  });

  let footerActionStore = writable('');

  sidebarStore.subscribe(value => {
    sidebarInfo = value;
  });

  let historyStore = writable([]);

  // Bind the SVGs
  const preProcessSVG = (svgString) => {
    return svgString.replaceAll('black', 'currentcolor')
      .replaceAll('fill:none', 'fill:currentcolor')
      .replaceAll('stroke:none', 'fill:currentcolor');
  };

  /**
   * Dynamically bind SVG files as inline SVG strings in this component
   */
  const bindInlineSVG = () => {
    d3.select(component)
      .selectAll('.svg-icon.icon-redo')
      .html(preProcessSVG(redoIconSVG));

    d3.select(component)
      .selectAll('.svg-icon.icon-undo')
      .html(preProcessSVG(undoIconSVG));

    d3.select(component)
      .selectAll('.svg-icon.icon-export')
      .html(preProcessSVG(exportIconSVG));
  };

  const initData = async () => {
    console.log('loading data');
    let isClassification = true;
    let loadedData = await d3.json('/data/iow-house-ebm-binary.json');
    // let loadedData = await d3.json('/data/iow-house-ebm.json');
    // let loadedData = await d3.json('/data/medical-ebm.json');

    data = loadedData;
    console.log('loaded data');
    console.log(data);

    // Initialize an EBM object
    let sampleData = await d3.json('/data/iow-house-sample-binary.json');

    ebm = await initEBM(data, sampleData, 'LotFrontage', isClassification);

    // Get the distribution of test data on each variable
    const testDataHistCount = ebm.getHistBinCounts();

    // Create the sidebar feature data
    let featurePlotData = {cont: [], cat: []};
    let featureDataNameMap = new Map();
    data.features.forEach((d, i) => featureDataNameMap.set(d.name, i));

    let sampleDataNameMap = new Map();
    sampleData.featureNames.forEach((d, i) => sampleDataNameMap.set(d, i));

    for (let j = 0; j < testDataHistCount.length; j++) {
      let curName = sampleData.featureNames[j];
      let curType = sampleData.featureTypes[j];

      if (curType === 'continuous') {
        let histEdge = data.features[featureDataNameMap.get(curName)].histEdge.slice(0, -1);
        featurePlotData.cont.push({
          id: sampleDataNameMap.get(curName),
          name: curName,
          histEdge: histEdge,
          histCount: testDataHistCount[j],
          histSelectedCount: new Array(testDataHistCount[j].length).fill(0)
        });
      } else {
        let histEdge = data.features[featureDataNameMap.get(curName)].histEdge;
        featurePlotData.cat.push({
          id: sampleDataNameMap.get(curName),
          name: curName,
          histEdge: histEdge,
          histCount: testDataHistCount[j],
          histSelectedCount: new Array(testDataHistCount[j].length).fill(0)
        });
      }
    }

    sidebarInfo.featurePlotData = featurePlotData;

    // Remember the number of total samples
    ebm.totalSampleNum = sampleData.samples.length;
    sidebarInfo.totalSampleNum = ebm.totalSampleNum;
    footerStore.update(value => {
      value.totalSampleNum = ebm.totalSampleNum;
      value.sample = `<b>0/${ebm.totalSampleNum }</b> test samples selected`;
      return value;
    });

    // Get the initial metrics
    let metrics = ebm.getMetrics();

    if (ebm.isClassification) {
      sidebarInfo.accuracy = metrics.accuracy;
      sidebarInfo.rocAuc = metrics.rocAuc;
      sidebarInfo.balancedAccuracy = metrics.balancedAccuracy;
      sidebarInfo.confusionMatrix = metrics.confusionMatrix;
    } else {
      sidebarInfo.rmse = metrics.rmse;
      sidebarInfo.mae = metrics.mae;
    }

    sidebarInfo.curGroup = 'original';

    // Get the list of all categorical variables and their values to popularize
    // the select dropdown
    let sliceOptions = [];
    data.features.forEach(f => {
      if (f.type === 'categorical') {
        let curOptionGroup = [];
        f.binLabel.forEach(b => curOptionGroup.push(
          {
            name: f.name,
            level: b,
            levelName: data.labelEncoder[f.name][parseInt(b)],
            featureID: sampleDataNameMap.get(f.name)
          }
        ));
        sliceOptions.push(curOptionGroup);
      }
    });
    
    sliceOptions.sort((a, b) => a[0].name.localeCompare(b[0].name));
    sidebarInfo.sliceOptions = sliceOptions;
    
    sidebarStore.set(sidebarInfo);

    // Create a list of feature select options (grouped by types, sorted by importance)
    let featureSelectList = {
      continuous: [],
      categorical: [],
      interaction: []
    };

    data.features.forEach((f, i) => {
      featureSelectList[f.type].push({
        name: f.name,
        featureID: i,
        sampleFeatureID: f.type !== 'interaction' ? sampleDataNameMap.get(f.name) : null,
        importance: f.importance
      });
    });

    // Sort each feature type by importance score
    Object.keys(featureSelectList).forEach(k => featureSelectList[k].sort((a, b) => b.importance - a.importance));

    // Popularize the slice option list
    let selectElement = d3.select(component).select('#feature-select');
    let featureGroups = ['continuous', 'categorical', 'interaction'];

    featureGroups.forEach(type => {
      let groupName = type.charAt(0).toUpperCase() + type.slice(1);
      let optGroup = selectElement.append('optgroup')
        .attr('label', groupName + ' (name - importance)');
      
      featureSelectList[type].forEach(opt => {
        optGroup.append('option')
          .attr('value', opt.featureID)
          .attr('data-level', opt.level)
          .text(`${opt.name} - ${round(opt.importance, 3)}`);
      });
    });

    resizeFeatureSelect();
  };

  /**
   * Wrapper to call the child changer's handler
  */
  const selectModeSwitched = () => {
    changer.selectModeSwitched();
  };

  const footerActionTriggered = (message) => {
    footerActionStore.set(message);

    if (message === 'save') {
      let historyList = get(historyStore);
      // Check if the user has confirmed all edits
      let allReviewed = true;
      historyList.forEach(d => allReviewed = allReviewed && d.reviewed);
      if (allReviewed) {
        downloadJSON(historyList, d3.select(component).select('#download-anchor'), 'history');
      } else {
        alert('You need to confirm all edits in the History panel (click 👍 icons) before saving the model.');
      }
    }
  };

  /**
   * Change the width of the select button so it fits the current content
   */
  const resizeFeatureSelect = () => {
    let opt = featureSelect.options[featureSelect.selectedIndex];

    let hiddenSelect = d3.select(component)
      .select('#hidden-select')
      .style('display', 'initial');

    hiddenSelect.select('#hidden-option')
      .text(opt.text);
    
    let selectWidth = hiddenSelect.node().clientWidth + 'px';
    hiddenSelect.style('display', 'none');
      
    d3.select(component)
      .select('#feature-select')
      .style('width', selectWidth);
  };

  const featureChanged = () => {
    console.log('feature select changed');
    resizeFeatureSelect();
  };

  const bindUndoKey = (undoCallback, redoCallback) => {
    d3.select('body')
      .on('keydown', e => {
        if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'z') {
          e.preventDefault();
          e.stopPropagation();
          undoCallback();
        } else if ((e.metaKey && e.shiftKey && e.key === 'z') ||
          (e.ctrlKey && e.shiftKey && e.key === 'Z')) {
          e.preventDefault();
          e.stopPropagation();
          redoCallback();
        }
      });
  };

  initData();

  onMount(() => {
    bindInlineSVG();
    bindUndoKey(() => footerActionTriggered('undo'), () => footerActionTriggered('redo'));
  });

</script>

<style type='text/scss'>

  @import 'define';

  $tool-width: $svg-width + $sidebar-width + 2px;

  .main-tool {
    display: flex;
    flex-direction: column;
    border: 1px solid $gray-border;
    border-radius: 5px;
    background: white;
    width: $tool-width;
  }

  .tool {
    display: flex;
    flex-direction: row;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 10px;
    border-bottom: 1px solid $gray-border;
    background: white;
    border-top-left-radius: 5px;
    height: 53px;

    .header__info {
      display: flex;
      align-items: center;
    }

    .header__control-panel {
      display: flex;
      align-items: center;
    }

    .header__history {
      background: hsl(225, 53%, 93%);
      border-radius: 5px;
      padding: 1px 7px;
      font-size: 0.9em;
      color: $gray-900;
      margin-left: 1em;

      &.past {
        background: hsl(35.3, 100%, 90%);
      }
    }
  }

  .select {
    display: flex;
    flex-direction: column;
    justify-content: center;

    select {
      height: 2em;
      border-radius: 5px;
      padding-top: 0;
      padding-bottom: 0;
      padding-left: 10px;
      border: 1px solid hsl(0, 0%, 85.9%);
      background: hsl(0, 20%, 99%);

      &:hover {
        border: 1px solid hsl(0, 0%, 71%);
      }

      &:focus {
        box-shadow: none;
      }
    }
  }

  .select:not(.is-multiple):not(.is-loading)::after {
    border-color: $blue-dark;
    right: 12px;
  }

  .select select:not([multiple]) {
    padding-right: 30px;
  }

  #hidden-select {
    display: none;
  }

  .toggle-switch-wrapper {
    width: 180px;
  }

  .sidebar-wrapper {
    width: $sidebar-width;
  }

  .tool-footer {
    display: flex;
    border-top: 1px solid $gray-border;
    height: 2em;
    align-items: center;
    border-bottom-left-radius: 5px;
    border-bottom-right-radius: 5px;
    padding: 5px 0px 5px 10px;

  }

  .message-line {
    display: flex;
    gap: 5px;
    flex-grow: 1;
    font-size: 0.9em;
    height: 100%;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;

    span {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
  }

  .button-group {
    display: flex;
  }

  .field {
    border-bottom-right-radius: 5px;
  }

  .button {
    padding: 3px 0.8em;
    height: auto;
    border-radius: 0;
    border-top-width: 0px;
    border-bottom-width: 0px;
    border-color: $gray-border;
    border: 0px;

    &:hover {
      background: $gray-200;
      border-color: $gray-border;
    }

    &.right-button {
      border-right: 0px;
      border-bottom-right-radius: 5px;
      padding-right: 1em;
    }

    &:focus:not(:active) {
      box-shadow: none;
    }
  }

  .svg-icon {
    height: 100%;
    color: $indigo-dark;
    display: inline-flex;
    align-items: center;

    :global(svg) {
      width: 0.9em;
      height: 0.9em;
    }
  }

  .separator {
    margin: 0 3px;
    width: 1px;
    background-color: $gray-border;
    height: 100%;
    flex-shrink: 0;
  }

  .feature-window {
    background-color: $brown-50;
    border-radius: 5px;
  }

</style>

<div class='main-tool' bind:this={component}>
  <a id="download-anchor" style="display:none"> </a>

  <div class='tool'>
    <div class='feature-window'>

      <div class='header'>

        <div class='header__info'>

          <div class='select'>
            <select name='feature'
              bind:this={featureSelect}
              id='feature-select'
              title='Select a feature'
              on:blur={() => {}}
              on:change={featureChanged}
            >
            </select>
          </div>

          <div class='select'>
            <select id='hidden-select'>
              <option id='hidden-option'></option>
            </select>
          </div>

          <div class='header__history' class:past={sidebarInfo.previewHistory}>
            <span class='hash'>
              {#if sidebarInfo.historyHead === 0}
                Original
              {:else}
                {#if sidebarInfo.previewHistory}
                  Previous Edit:
                {:else}
                  Latest Edit:
                {/if}
                {get(historyStore)[sidebarInfo.historyHead].hash.substring(0, 7)}
              {/if}
            </span>
          </div>

        </div>

        <div class='header__control-panel'>
          <div class='toggle-switch-wrapper'>
            <ToggleSwitch name='cont' on:selectModeSwitched={selectModeSwitched}/>
          </div>
        </div>

      </div>

      <ContGlobalExplain
        featureData = {data === null ? null : data.features[2]}
        scoreRange = {data === null ? null : data.scoreRange}
        bind:ebm = {ebm}
        bind:this = {changer}
        sidebarStore = {sidebarStore}
        footerStore = {footerStore}
        footerActionStore = {footerActionStore}
        historyStore = {historyStore}
        svgHeight = 500
      />
    </div>

    <div class='sidebar-wrapper'>
      <Sidebar sidebarStore={sidebarStore} historyStore={historyStore}/>
    </div>
  </div>

  <div class='tool-footer'>
    <div class='message-line'>
      <span>{@html $footerStore.help}</span>
      <div class='separator'></div>

      <span>{@html $footerStore.sample}</span>
      <span>{@html $footerStore.slice}</span>
      <div class='separator'></div>

      <span>{@html $footerStore.state}</span>
    </div>
      
    <div class='field has-addons'>

      <div class='control'>
        <button class='button' title='undo last edit' on:click={() => footerActionTriggered('undo')}>
          <span class='icon is-small'>
            <div class='svg-icon icon-undo'></div>
          </span>
        </button>
      </div>

      <div class='control'>
        <button class='button' title='redo last undo' on:click={() => footerActionTriggered('redo')}>
          <span class='icon is-small'>
            <div class='svg-icon icon-redo'></div>
          </span>
        </button>
      </div>

      <div class='control'>
        <button class='button right-button' title='save edits' on:click={() => footerActionTriggered('save')}>
          <span class='icon is-small'>
            <div class='svg-icon icon-export'></div>
          </span>
        </button>
      </div>

    </div>


  </div>



    <!-- <div class='feature-window'>
      <CatGlobalExplain
        featureData = {data === null ? null : data.features[26]}
        scoreRange = {data === null ? null : data.scoreRange}
        svgHeight = 400
      />
    </div> -->

    <!-- <ContextMenu /> -->

    <!-- <div class='feature-window'>
      <CatGlobalExplain
        featureData = {data === null ? null : data.features[12]}
        scoreRange = {data === null ? null : data.scoreRange}
        svgHeight = 500
      />
    </div> -->

    <!-- <div class='feature-window'>
      <ContGlobalExplain
        featureData = {data === null ? null : data.features[2]}
        scoreRange = {data === null ? null : data.scoreRange}
        svgHeight = 500
      />
    </div> -->

    <!-- <div class='feature-window'>
      <InterContCatGlobalExplain
        featureData = {data === null ? null : data.features[90]}
        scoreRange = {data === null ? null : data.scoreRange}
        svgHeight = 500
        chartType = 'line'
      />
    </div> -->

    <!-- <div class='feature-window'>
      <InterContCatGlobalExplain
        featureData = {data === null ? null : data.features[89]}
        scoreRange = {data === null ? null : data.scoreRange}
        svgHeight = 500
        chartType = 'bar'
      />
    </div> -->

    <!-- <div class='feature-window'>
      <InterContContGlobalExplain
        featureData = {data === null ? null : data.features[86]}
        scoreRange = {data === null ? null : data.scoreRange}
        svgHeight = 500
      />
    </div> -->

    <!-- <div class='feature-window'>
      <InterCatCatGlobalExplain
        featureData = {data === null ? null : data.features[81]}
        scoreRange = {data === null ? null : data.scoreRange}
        svgHeight = 500
      />
    </div> -->
  

</div>