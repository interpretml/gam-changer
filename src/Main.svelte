<script>
  import Header from './Header.svelte';
  import ContinuousGlobalExplain from './global-explaination/ContinuousFeature.svelte';
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
  }

  onMount(async () => {
    console.log('loading data');
    let loadedData = await d3.json('/data/iow-house-ebm.json');
    loadedData = processData(loadedData);
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
    height: min(800px, calc(100vh - 50px));
    width: 100vw;
    box-sizing: border-box;
    border: 1px solid $gray-border;
  }

  .feature-window {
    width: 600px;
    height: 437px;
    border: 1px solid $gray-border;
    margin: auto;
  }

</style>

<div class='main-standalone'>
  <div class='header'>
    <Header />
  </div>

  <div class='content'>
    <div class='feature-window'>
      <ContinuousGlobalExplain
        featureData = {data === null ? null : data.features[1]}
        scoreRange = {data === null ? null : data.scoreRange}
      />
    </div>
  </div>
  

</div>