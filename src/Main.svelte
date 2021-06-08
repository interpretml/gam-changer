<script>
  import Header from './Header.svelte';
  import ContGlobalExplain from './global-explanation/ContFeature.svelte';
  import CatGlobalExplain from './global-explanation/CatFeature.svelte';
  import InterContCatGlobalExplain from './global-explanation/InterContCatFeature.svelte';
  import InterContContGlobalExplain from './global-explanation/InterContContFeature.svelte';
  import InterCatCatGlobalExplain from './global-explanation/InterCatCatFeature.svelte';
  import ToggleSwitch from './components/ToggleSwitch.svelte';
  import * as d3 from 'd3';
  import { onMount } from 'svelte';

  let data = null;

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

  onMount(async () => {
    console.log('loading data');
    let loadedData = await d3.json('/data/iow-house-ebm.json');
    // loadedData = processData(loadedData);
    data = loadedData;
    console.log('loaded data');
    console.log(data);
  });

</script>

<style type='text/scss'>

  @import 'define';
  
  .main-standalone {
    display: flex;
    flex-direction: column;
  }

  .content {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 50px;
    padding: 30px 0 30px 0;
    justify-content: center;
    height: min(800px, calc(100vh - 50px));
    overflow-y: scroll;
    width: 100vw;
    box-sizing: border-box;
    border: 1px solid $gray-border;
  }

  .feature-window {
    border: 1px solid $gray-border;
    margin: auto 0;
    border-radius: 5px;
  }

</style>

<div class='main-standalone'>
  <div class='header'>
    <Header />
  </div>

  <div class='content'>
    <!-- <div class='feature-window'>
      <CatGlobalExplain
        featureData = {data === null ? null : data.features[26]}
        scoreRange = {data === null ? null : data.scoreRange}
        svgHeight = 400
      />
    </div> -->

    <ToggleSwitch />
    
    <!-- <div class='feature-window'>
      <CatGlobalExplain
        featureData = {data === null ? null : data.features[12]}
        scoreRange = {data === null ? null : data.scoreRange}
        svgHeight = 400
      />
    </div> -->

    <div class='feature-window'>
      <ContGlobalExplain
        featureData = {data === null ? null : data.features[2]}
        scoreRange = {data === null ? null : data.scoreRange}
        svgHeight = 500
      />
    </div>

    <!-- <div class='feature-window'>
      <InterContCatGlobalExplain
        featureData = {data === null ? null : data.features[90]}
        scoreRange = {data === null ? null : data.scoreRange}
        svgHeight = 400
        chartType = 'line'
      />
    </div>

    <div class='feature-window'>
      <InterContCatGlobalExplain
        featureData = {data === null ? null : data.features[89]}
        scoreRange = {data === null ? null : data.scoreRange}
        svgHeight = 400
        chartType = 'bar'
      />
    </div>


    <div class='feature-window'>
      <InterContContGlobalExplain
        featureData = {data === null ? null : data.features[86]}
        scoreRange = {data === null ? null : data.scoreRange}
        svgHeight = 400
      />
    </div>

    <div class='feature-window'>
      <InterCatCatGlobalExplain
        featureData = {data === null ? null : data.features[81]}
        scoreRange = {data === null ? null : data.scoreRange}
        svgHeight = 400
      />
    </div> -->

  </div>
  

</div>