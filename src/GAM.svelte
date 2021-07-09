
<script>
  import ContGlobalExplain from './global-explanation/ContFeature.svelte';
  import CatGlobalExplain from './global-explanation/CatFeature.svelte';
  import InterContCatGlobalExplain from './global-explanation/InterContCatFeature.svelte';
  import InterContContGlobalExplain from './global-explanation/InterContContFeature.svelte';
  import InterCatCatGlobalExplain from './global-explanation/InterCatCatFeature.svelte';
  import Sidebar from './sidebar/Sidebar.svelte';

  import * as d3 from 'd3';
  import { initEBM } from './ebm';
  import { onMount } from 'svelte';
  import { writable, derived } from 'svelte/store';

  import redoIconSVG from './img/redo-icon.svg';
  import undoIconSVG from './img/undo-icon.svg';
  import exportIconSVG from './img/export-icon.svg';

  let data = null;
  let ebm = null;
  let component = null;

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
    curGroup: 'original',
    selectedTab: 'effect',
  });

  let footerStore = writable({
    sample: '',
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

  /**
   * Pre-process the data loaded from a json file or passed from other sources
   * Sort the features based on their importance scores
   * @param {[object]} data An array of feature objects.
   * @return {[object]} processed data
   */
  const processData = (data) => {
    data.features.sort((a, b) => b.importance - a.importance);
    return data;
  };

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

    // loadedData = processData(loadedData);
    data = loadedData;
    console.log('loaded data');
    console.log(data);

    // Initialize an EBM object
    let sampleData = await d3.json('/data/iow-house-sample-binary.json');

    ebm = await initEBM(data, sampleData, 'LotFrontage', isClassification);

    // Get the distribution of test data on each variable
    const testDataHistCount = ebm.getHistBinCounts();

    // Create the sidebar feature data
    // const bandwidth = 10;
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
          // histDensity: kde(bandwidth, histEdge, testDataHistCount[j])
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

    sidebarStore.set(sidebarInfo);

    // Copy the original to current as well
    sidebarInfo.curGroup = 'current';
    sidebarStore.set(sidebarInfo);
  };

  const footerActionTriggered = (message) => {
    footerActionStore.set(message);
  };

  initData();

  onMount(() => {
    bindInlineSVG();
  });

</script>

<style type='text/scss'>

  @import 'define';

  .main-tool {
    display: flex;
    flex-direction: column;
    border: 1px solid $gray-border;
    border-radius: 5px;
    background: white;
  }

  .tool {
    display: flex;
    flex-direction: row;
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
    // overflow-x: scroll;
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

  <div class='tool'>
    <div class='feature-window'>
      <ContGlobalExplain
        featureData = {data === null ? null : data.features[2]}
        scoreRange = {data === null ? null : data.scoreRange}
        bind:ebm = {ebm}
        sidebarStore = {sidebarStore}
        footerStore = {footerStore}
        footerActionStore = {footerActionStore}
        historyStore = {historyStore}
        svgHeight = 500
      />
    </div>

    <div class='sidebar-wrapper'>
      <Sidebar sidebarStore={sidebarStore}/>
    </div>
  </div>

  <div class='tool-footer'>
    <div class='message-line'>
      <span>{@html $footerStore.help}</span>
      <div class='separator'></div>

      <span>{@html $footerStore.sample}</span>
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