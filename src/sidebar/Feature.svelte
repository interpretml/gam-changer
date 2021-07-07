<script>

  import * as d3 from 'd3';
  import { onMount, afterUpdate } from 'svelte';
  import { flip } from 'svelte/animate';
  import { quadInOut, expoInOut, cubicInOut } from 'svelte/easing';
  import { chiCdf } from './chi2';
  import { round, shuffle, l1Distance } from '../utils';

  export let sidebarStore;
  // export let width = 0;

  let component = null;
  let selectedTab = 'cont';
  let sidebarInfo = {};
  let featureInitialized = false;
  let waitingToDrawDIV = false;
  
  let width = 0;
  let height = 0;

  const svgHeight = 40;

  const svgCatPadding = {top: 2, bottom: 2, left: 10, right: 10};
  const svgContPadding = svgCatPadding;

  const titleHeight = 10;
  let catBarWidth = 0;

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

        let svg = d3.select(component)
          .select(`.feature-${f.id}`)
          .select('svg');

        let lowContent = svg.append('g')
          .attr('class', 'low-content')
          .attr('transform', `translate(${svgContPadding.left}, ${svgContPadding.top})`);

        let midContent = svg.append('g')
          .attr('class', 'mid-content')
          .attr('transform', `translate(${svgContPadding.left}, ${svgContPadding.top})`);

        let topContent = svg.append('g')
          .attr('class', 'top-content')
          .attr('transform', `translate(${svgContPadding.left}, ${svgContPadding.top})`);

        // Add the feature title
        topContent.append('text')
          .attr('class', 'feature-title')
          .attr('x', 0)
          .text(f.name);

        // Compute the frequency of test samples
        let curDensity = f.histCount.map((d, i) => [f.histEdge[i], d / totalSampleNum]);

        // Create the axis scales
        let expectedBarWidth = (width - svgCatPadding.left - svgCatPadding.right) / f.histEdge.length;
        let xScale = d3.scaleLinear()
          .domain(d3.extent(f.histEdge))
          .range([0, width - svgContPadding.left - svgContPadding.right - expectedBarWidth]);

        let barWidth = xScale(f.histEdge[1]) - xScale(f.histEdge[0]);

        let yScale = d3.scaleLinear()
          .domain([0, d3.max(curDensity, d => d[1])])
          .range([svgHeight - svgContPadding.bottom, svgContPadding.top + titleHeight]);

        lowContent.selectAll('rect.global-bar')
          .data(curDensity)
          .join('rect')
          .attr('class', 'global-bar')
          .attr('x', d => xScale(d[0]))
          .attr('y', d => yScale(d[1]))
          .attr('width', barWidth)
          .attr('height', d => svgHeight - svgCatPadding.bottom - yScale(d[1]));

        // Draw overlay layer
        let curDensitySelected = new Array(f.histCount.length).fill(0);

        const yMax = d3.max(curDensitySelected) === 0 ? 1 : d3.max(curDensitySelected);

        let yScaleBar = d3.scaleLinear()
          .domain([0, yMax])
          .range([svgHeight - svgContPadding.bottom, svgContPadding.top + titleHeight]);

        midContent.selectAll('rect.selected-bar')
          .data(curDensitySelected)
          .join('rect')
          .attr('class', 'selected-bar')
          .attr('x', (d, i) => xScale(f.histEdge[i]))
          .attr('y', d => yScaleBar(d))
          .attr('width', barWidth)
          .attr('height', d => svgHeight - svgContPadding.bottom - yScaleBar(d));

      });

      // Find the max equal bar width
      catBarWidth = (width - svgCatPadding.left - svgCatPadding.right) / d3.max(sortedCatFeatures, d => d.histCount.length);

      sortedCatFeatures.forEach(f => {

        let svg = d3.select(component)
          .select(`.feature-${f.id}`)
          .select('svg');

        let lowContent = svg.append('g')
          .attr('class', 'low-content')
          .attr('transform', `translate(${svgCatPadding.left}, ${svgCatPadding.top})`);

        let midContent = svg.append('g')
          .attr('class', 'mid-content')
          .attr('transform', `translate(${svgCatPadding.left}, ${svgCatPadding.top})`);

        let topContent = svg.append('g')
          .attr('class', 'top-content')
          .attr('transform', `translate(${svgCatPadding.left}, ${svgCatPadding.top})`);

        // Add the feature title
        topContent.append('text')
          .attr('class', 'feature-title')
          .attr('x', -catBarWidth / 2)
          .text(f.name);

        // Sort the bins from high count to low count, and save the sorting order
        // (needed to update selected bins)
        let curData = f.histEdge.map((d, i) => ({
          edge: f.histEdge[i],
          count: f.histCount[i],
          density: f.histCount[i] / totalSampleNum,
          // Initialize selected bars with 0 density
          selectedCount: 0,
          selectedDensity: 0
        }));

        curData.sort((a, b) => b.count - a.count);

        // Create the axis scales
        // histEdge, histCount, histDensity
        let xScale = d3.scalePoint()
          .domain(curData.map(d => d.edge))
          .padding(0)
          .range([0, width - svgCatPadding.left - svgCatPadding.right]);

        let yScale = d3.scaleLinear()
          .domain([0, d3.max(curData, d => d.density)])
          .range([svgHeight - svgCatPadding.bottom, svgCatPadding.top + titleHeight]);

        // Draw the global histogram
        lowContent.selectAll('rect.global-bar')
          .data(curData)
          .join('rect')
          .attr('class', 'global-bar')
          .attr('x', d => xScale(d.edge) - catBarWidth / 2)
          .attr('y', d => yScale(d.density))
          .attr('width', catBarWidth)
          .attr('height', d => svgHeight - svgCatPadding.bottom - yScale(d.density));

        // Draw overlay layer
        let yScaleSelected = d3.scaleLinear()
          .domain([0, 1])
          .range([svgHeight - svgCatPadding.bottom, svgCatPadding.top + titleHeight]);

        midContent.selectAll('rect.selected-bar')
          .data(curData)
          .join('rect')
          .attr('class', 'selected-bar')
          .attr('x', d => xScale(d.edge) - catBarWidth / 2)
          .attr('y', d => yScaleSelected(d.selectedDensity))
          .attr('width', catBarWidth)
          .attr('height', d => svgHeight - svgCatPadding.bottom - yScaleSelected(d.selectedDensity));
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

    // Update the feature graph
    if (sidebarInfo.curGroup === 'updateFeature' && featureInitialized) {

      let tempSortedContFeatures = sidebarInfo.featurePlotData.cont;
      let tempSortedCatFeatures = sidebarInfo.featurePlotData.cat;

      // Update the overlay histogram
      const selectedSampleCount = sortedContFeatures[0].histSelectedCount.reduce((a, b) => a + b);
      const totalSampleCount = sortedContFeatures[0].histCount.reduce((a, b) => a + b);
      let needToResort = false;

      // Step 1: update the continuous feature graph
      tempSortedContFeatures.forEach(f => {
        let svg = d3.select(component)
          .select(`svg#cont-feature-svg-${f.id}`);

        let curDensitySelected = f.histSelectedCount.map(c => selectedSampleCount === 0 ? 0 : c / selectedSampleCount);
        let globalDensity = f.histCount.map(c => c / totalSampleCount);

        // Compute teh distance between subset density vs. global density
        f.distanceScore = l1Distance(globalDensity, curDensitySelected);

        const yMax = d3.max(curDensitySelected) === 0 ? 1 : d3.max(curDensitySelected);
        needToResort = d3.max(curDensitySelected) === 0 ? false : true;

        let yScaleBar = d3.scaleLinear()
          .domain([0, yMax])
          .range([svgHeight - svgContPadding.bottom, svgContPadding.top + titleHeight]);

        svg.select('g.mid-content')
          .selectAll('rect.selected-bar')
          .data(curDensitySelected)
          .join('rect')
          .transition('bar')
          .duration(500)
          .attr('y', d => yScaleBar(d))
          .attr('height', d => svgHeight - svgContPadding.bottom - yScaleBar(d));
      });

      if (needToResort) {
        d3.timeout(() => {
          tempSortedContFeatures.sort((a, b) => b.distanceScore - a.distanceScore);
          sortedContFeatures = tempSortedContFeatures;
        }, 700);
      } else {
        sortedContFeatures = tempSortedContFeatures;
      }

      // Step 2: update the categorical feature graph
      needToResort = false;

      tempSortedCatFeatures.forEach(f => {

        let svg = d3.select(component)
          .select(`#cat-feature-svg-${f.id}`);

        let curData = f.histEdge.map((d, i) => ({
          edge: f.histEdge[i],
          count: f.histCount[i],
          selectedCount: f.histSelectedCount[i],
          selectedDensity: selectedSampleCount === 0 ? 0 : f.histSelectedCount[i] / selectedSampleCount
        }));

        // Compute the distance score
        let selectedDensity = curData.map(d => d.selectedDensity);
        let globalDensity = curData.map(d => d.count / totalSampleCount);
        f.distanceScore = l1Distance(globalDensity, selectedDensity);

        curData.sort((a, b) => b.count - a.count);

        const yMax = d3.max(curData, d => d.selectedDensity) === 0 ? 1 : d3.max(curData, d => d.selectedDensity);
        needToResort = d3.max(curData, d => d.selectedDensity) === 0 ? false : true;

        let yScaleSelected = d3.scaleLinear()
          .domain([0, yMax])
          .range([svgHeight - svgCatPadding.bottom, svgCatPadding.top + titleHeight]);

        svg.select('g.mid-content')
          .selectAll('rect.selected-bar')
          .data(curData, d => d.edge)
          .join('rect')
          .transition('cont-bar')
          .duration(500)
          .attr('y', d => yScaleSelected(d.selectedDensity))
          .attr('height', d => svgHeight - svgCatPadding.bottom - yScaleSelected(d.selectedDensity));
      });

      if (needToResort) {
        d3.timeout(() => {
          tempSortedCatFeatures.sort((a, b) => b.distanceScore - a.distanceScore);
          sortedCatFeatures = tempSortedCatFeatures;
        }, 700);
      } else {
        sortedCatFeatures = tempSortedCatFeatures;
      }
      
      sidebarInfo.curGroup = '';
      sidebarStore.set(sidebarInfo);
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
    will-change: transform, height;
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
    fill: $pastel1-blue;
    stroke: $pastel1-blue;
    opacity: 1;
    stroke-linejoin: round;
  }

  :global(.feature-tab .global-bar) {
    fill: $pastel1-blue;
    opacity: 1;
  }

  :global(.feature-tab .selected-bar) {
    fill: $orange-400;
    opacity: 0.4;
  }

  :global(.feature-tab rect.selected-sample) {
    fill: $orange-400;
    opacity: 0.4;
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
        <div class={`feature feature-${f.id}`}
          style={`height: ${svgHeight}px;`}
          animate:flip="{{duration: 800}}"
        >
          <svg id={`cont-feature-svg-${f.id}`} width={width} height={svgHeight}></svg>
        </div>
      {/each}
    </div>

    <div class='feature-cat' class:hidden={selectedTab !== 'cat'}>
      {#each sortedCatFeatures as f (f.id)}
        <div class={`feature feature-${f.id}`}
          style={`height: ${svgHeight}px;`}
          animate:flip="{{duration: 800}}"
        >
          <svg id={`cat-feature-svg-${f.id}`} width={width} height={svgHeight}></svg>
        </div>
      {/each}
    </div>

  </div>

</div>