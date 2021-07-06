<script>

  import * as d3 from 'd3';
  import { onMount, afterUpdate } from 'svelte';
  import { chiCdf } from './chi2';
  import { round } from '../utils';

  export let sidebarStore;
  // export let width = 0;

  let component = null;
  let selectedTab = 'cat';
  let sidebarInfo = {};
  let featureInitialized = false;
  let waitingToDrawDIV = false;
  
  let width = 0;
  let height = 0;

  const svgHeight = 40;

  let sortedContFeatures = [];
  let sortedCatFeatures = [];


  onMount(() => {
    width = component.getBoundingClientRect().width;
    height = component.getBoundingClientRect().height;

    console.log(width, height);
  });

  afterUpdate(() => {
    const totalSampleNum = sidebarInfo.totalSampleNum;

    if (waitingToDrawDIV) {
      sortedContFeatures.forEach(f => {
        const svgPadding = {top: 2, bottom: 2, left: 0, right: 0};

        const titleHeight = 10;

        let svg = d3.select(component)
          .select(`.feature-${f.id}`)
          .select('svg');

        let lowContent = svg.append('g')
          .attr('class', 'low-content')
          .attr('transform', `translate(${svgPadding.left}, ${svgPadding.top})`);

        let midContent = svg.append('g')
          .attr('class', 'mid-content')
          .attr('transform', `translate(${svgPadding.left}, ${svgPadding.top})`);

        let topContent = svg.append('g')
          .attr('class', 'top-content')
          .attr('transform', `translate(${svgPadding.left}, ${svgPadding.top})`);

        // Add the feature title
        topContent.append('text')
          .attr('class', 'feature-title')
          .attr('x', 3)
          .text(f.name);

        // Compute the frequency of test samples
        let curDensity = f.histCount.map((d, i) => [f.histEdge[i], d / totalSampleNum]);
        curDensity.unshift([f.histEdge[0], 0]);
        curDensity.push([f.histEdge[f.histEdge.length - 1], 0]);

        // Create the axis scales
        // histEdge, histCount, histDensity
        let xScale = d3.scaleLinear()
          .domain(d3.extent(f.histEdge))
          .range([0, width - svgPadding.left - svgPadding.right]);

        let yScale = d3.scaleLinear()
          .domain([0, d3.max(curDensity, d => d[1])])
          .range([svgHeight - svgPadding.bottom, svgPadding.top + titleHeight]);

        let curve = d3.line()
          .curve(d3.curveMonotoneX)
          .x(d => xScale(d[0]))
          .y(d => yScale(d[1]));
        
        // Draw the area curve
        lowContent.append('path')
          .attr('class', 'area-path')
          .datum(curDensity)
          .attr('d', curve);
        
        // Draw a bottom border
        lowContent.append('path')
          .attr('class', 'area-path')
          .attr('d', `M${xScale(curDensity[0][0])}, ${yScale(curDensity[0][1])}
            L${xScale(curDensity[curDensity.length - 1][0])}, ${yScale(curDensity[curDensity.length - 1][1])}`);

        // Draw overlay layer
        let curDensitySelected = new Array(f.histCount.length).fill(1);
        const binWidth = xScale(f.histEdge[1]) - xScale(f.histEdge[0]);

        let yScaleBar = d3.scaleLinear()
          .domain([0, d3.max(curDensitySelected)])
          .range([svgHeight - svgPadding.bottom, svgPadding.top + titleHeight]);

        midContent.selectAll('rect.selected-sample')
          .data(curDensitySelected)
          .join('rect')
          .attr('class', 'selected-sample')
          .attr('x', (d, i) => xScale(f.histEdge[i]))
          .attr('y', d => yScaleBar(d))
          .attr('width', binWidth)
          .attr('height', d => svgHeight - svgPadding.bottom - yScaleBar(d));

      });

      // Find the max equal bar width
      const svgPadding = {top: 2, bottom: 2, left: 10, right: 10};
      const barWidth = (width - svgPadding.left - svgPadding.right) / d3.max(sortedCatFeatures, d => d.histCount.length);

      sortedCatFeatures.forEach(f => {
        const titleHeight = 10;

        let svg = d3.select(component)
          .select(`.feature-${f.id}`)
          .select('svg');

        let lowContent = svg.append('g')
          .attr('class', 'low-content')
          .attr('transform', `translate(${svgPadding.left}, ${svgPadding.top})`);

        let midContent = svg.append('g')
          .attr('class', 'mid-content')
          .attr('transform', `translate(${svgPadding.left}, ${svgPadding.top})`);

        let topContent = svg.append('g')
          .attr('class', 'top-content')
          .attr('transform', `translate(${svgPadding.left}, ${svgPadding.top})`);

        // Add the feature title
        topContent.append('text')
          .attr('class', 'feature-title')
          .attr('x', -barWidth / 2)
          .text(f.name);

        // Sort the bins from high count to low count, and save the sorting order
        // (needed to update selected bins)
        let curData = f.histEdge.map((d, i) => ({
          edge: f.histEdge[i],
          count: f.histCount[i],
          density: f.histCount[i] / totalSampleNum,
          selectedCount: 0,
          selectedDensity: 1
        }));

        curData.sort((a, b) => b.count - a.count);

        // Create the axis scales
        // histEdge, histCount, histDensity
        let xScale = d3.scalePoint()
          .domain(curData.map(d => d.edge))
          .padding(0)
          .range([0, width - svgPadding.left - svgPadding.right]);

        let yScale = d3.scaleLinear()
          .domain([0, d3.max(curData, d => d.density)])
          .range([svgHeight - svgPadding.bottom, svgPadding.top + titleHeight]);

        // Draw the global histogram
        lowContent.selectAll('rect.global-bar')
          .data(curData)
          .join('rect')
          .attr('class', 'global-bar')
          .attr('x', d => xScale(d.edge) - barWidth / 2)
          .attr('y', d => yScale(d.density))
          .attr('width', barWidth)
          .attr('height', d => svgHeight - svgPadding.bottom - yScale(d.density));

        // Draw overlay layer
        let curDensitySelected = new Array(f.histCount.length).fill(1);

        let yScaleSelected = d3.scaleLinear()
          .domain([0, d3.max(curData, d => d.selectedDensity)])
          .range([svgHeight - svgPadding.bottom, svgPadding.top + titleHeight]);

        midContent.selectAll('rect.selected-bar')
          .data(curData)
          .join('rect')
          .attr('class', 'selected-bar')
          .attr('x', d => xScale(d.edge) - barWidth / 2)
          .attr('y', d => yScaleSelected(d.selectedDensity))
          .attr('width', barWidth)
          .attr('height', d => svgHeight - svgPadding.bottom - yScaleSelected(d.selectedDensity));
      });

      waitingToDrawDIV = false;
    }

  });

  sidebarStore.subscribe(value => {
    sidebarInfo = value;

    // Initialize the feature elements in DOM when we have the data
    if (sidebarInfo.featurePlotData !== undefined && !featureInitialized) {
      console.log(sidebarInfo.featurePlotData);
      featureInitialized = true;

      sortedContFeatures = sidebarInfo.featurePlotData.cont;
      sortedCatFeatures = sidebarInfo.featurePlotData.cat;

      // Wait for the DOM to update (will trigger afterUpdate)
      waitingToDrawDIV = true;
    }

  });

</script>

<style type='text/scss'>

  @import '../define';

  .feature-tab {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .feature-list {
    height: 100%;
    width: 100%;
    overflow-y: scroll;
    overflow-x: hidden;
    position: relative;
  }

  .feature-cont, .feature-cat {
    position: absolute;
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0px;

    &.hidden {
      visibility: hidden;
      pointer-events: none;
    }
  }

  .feature {
    margin: auto;
    border-bottom: 1px solid change-color($blue-500, $alpha: 0.3);
  }

  .scope-selection {
    margin-top: 15px;
    margin-bottom: 5px;
  }

  .button {
    padding: 1px 11px;
    font-size: 0.9em;
    font-weight: 400;
    height: auto;
    border-color: $gray-border;

    &:hover {
      background: $gray-100;
    }

    &:focus:not(:active) {
      box-shadow: none;
    }

    &:focus {
      border-color: $gray-border;
    }

    &.selected {
      background: $gray-200;
    }
  }

  :global(.feature-tab .feature-title) {
    dominant-baseline: hanging;
    text-anchor: start;
    font-size: 0.7em;
    font-weight: 400;
    fill: black;

    &:global(.shadow) {
      stroke: white;
      fill: white;
    }
  }

  :global(.feature-tab .area-path) {
    fill: $blue-500;
    stroke: $blue-500;
    opacity: 0.3;
    stroke-linejoin: round;
  }

  :global(.feature-tab .global-bar) {
    fill: $blue-500;
    opacity: 0.3;
  }

  :global(.feature-tab .selected-bar) {
    fill: $orange-400;
    opacity: 0.3;
  }

  :global(.feature-tab rect.selected-sample) {
    fill: $orange-400;
    opacity: 0.3;
  }

</style>

<div class='feature-tab' bind:this={component}>

  <div class='scope-selection field has-addons'>

    <div class='control'>
      <button class='button' title='show continuous variables'
        class:selected={selectedTab === 'cont'}
        on:click={() => {selectedTab = 'cont';}}
      >
        <span class='is-small'>
          Continuous
        </span>
      </button>
    </div>

    <div class='control'>
      <button class='button' title='show categorical variables'
        class:selected={selectedTab === 'cat'}
        on:click={() => {selectedTab = 'cat';}}
      >
        <span class='is-small'>
          Categorical
        </span>
      </button>
    </div>

  </div>

  <div class='feature-list'>

    <div class='feature-cont' class:hidden={selectedTab !== 'cont'}>
      {#each sortedContFeatures as f (f.id)}
        <div class={`feature feature-${f.id}`} style={`height: ${svgHeight}px;`}>
          <svg width={width} height={svgHeight}></svg>
        </div>
      {/each}
    </div>

    <div class='feature-cat' class:hidden={selectedTab !== 'cat'}>
      {#each sortedCatFeatures as f (f.id)}
        <div class={`feature feature-${f.id}`} style={`height: ${svgHeight}px;`}>
          <svg width={width} height={svgHeight}></svg>
        </div>
      {/each}
    </div>

  </div>

</div>