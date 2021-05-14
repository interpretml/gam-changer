<script>
  import * as d3 from 'd3';

  export let featureData = null;
  let svg = null;

  const drawFeature = (featureData) => {
    console.log(featureData);
    let svgSelect = d3.select(svg);

    // Set svg viewbox
    svgSelect.attr('viewBox',)
    d3.select(svg)
      .append('circle')
      .attr('r', 100);
  }

  $: featureData && drawFeature(featureData);

</script>

<style type='text/scss'>
  @import '../define';

  .explain-panel {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
  }

  .header {
    display: flex;
    height: 2.2rem;
    padding: 5px 10px;
    border-bottom: 1px solid $gray-border;
  }

</style>

<div class='explain-panel'>
  <div class='header'>
    {featureData === null ? ' ' : featureData.name}
  </div>

  <div class='svg-container'>
    <svg class='svg-explainer' bind:this={svg}></svg>
  </div>
  
</div>