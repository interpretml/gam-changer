<script>
  import ContGlobalExplain from './global-explanation/ContFeature.svelte';
  import CatGlobalExplain from './global-explanation/CatFeature.svelte';
  import InterContCatGlobalExplain from './global-explanation/InterContCatFeature.svelte';
  import InterContContGlobalExplain from './global-explanation/InterContContFeature.svelte';
  import InterCatCatGlobalExplain from './global-explanation/InterCatCatFeature.svelte';
  import Sidebar from './sidebar/Sidebar.svelte';
  import { writable } from 'svelte/store';

  import * as d3 from 'd3';
  import { initEBM } from './ebm';
  import { onMount } from 'svelte';

  let data = null;
  let ebm = null;

  let sidebarInfo = {};
  let sidebarStore = writable({
    rmse: 0,
    mae: 0,
    accuracy: 0,
    rocAuc: 0,
    averagePrecision: 0,
    confusionMatrix: [],
    prCurve: [],
    rocCurve: [],
    curGroup: 'original'
  });

  sidebarStore.subscribe(value => {
    sidebarInfo = value;
  });

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

    // Get the initial metrics
    let metrics = ebm.getMetrics();

    if (ebm.isClassification) {
      sidebarInfo.accuracy = metrics.accuracy;
      sidebarInfo.rocAuc = metrics.rocAuc;
      sidebarInfo.averagePrecision = metrics.averagePrecision;
      sidebarInfo.confusionMatrix = metrics.confusionMatrix;
      sidebarInfo.prCurve = metrics.prCurve;
      sidebarInfo.rocCurve = metrics.rocCurve;
    } else {
      sidebarInfo.rmse = metrics.rmse;
      sidebarInfo.mae = metrics.mae;
    }

    sidebarStore.set(sidebarInfo);
  };

  initData();

</script>

<style type='text/scss'>

  @import 'define';

  .main-tool {
    display: flex;
    flex-direction: row;
    border: 1px solid $gray-border;
    border-radius: 5px;
    // background: hsla(0, 0%, 99%);
  }

  .feature-window {
  }

</style>

<div class='main-tool'>

  <div class='feature-window'>
    <ContGlobalExplain
      featureData = {data === null ? null : data.features[2]}
      scoreRange = {data === null ? null : data.scoreRange}
      bind:ebm = {ebm}
      sidebarStore = {sidebarStore}
      svgHeight = 500
    />
  </div>

  <div class='sidebar-wrapper'>
    <Sidebar sidebarStore={sidebarStore}/>
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