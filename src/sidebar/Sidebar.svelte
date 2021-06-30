<script>
  import { onMount } from 'svelte';
  import * as d3 from 'd3';

  import ClassificationMetrics from './ClassificationMetrics.svelte';
  import RegressionMetrics from './RegressionMetrics.svelte';
  import Feature from './Feature.svelte';
  import History from './History.svelte';

  export let sidebarStore;

  let selectedTab = 'effect';
  let sidebarInfo = {};
  let component = null;

  sidebarStore.subscribe(value => {
    sidebarInfo = value;

    if (value.height !== undefined) {
      component.style.height = `${value.height}px`;
      sidebarInfo.setHeight = sidebarInfo.height;
      delete sidebarInfo.height;
      sidebarStore.set(sidebarInfo);
    }
  });

</script>

<style type='text/scss'>

  @import '../define';

  .sidebar {
    width: 250px;
    height: 100%;
    border-left: 1px solid $gray-border;
    display: flex;
    flex-direction: column;
    background: white;
    border-top-right-radius: 5px;
    border-bottom-right-radius: 5px;
  }

  .header {
    height: 53px;
    border-bottom: 1px solid $gray-border;
    padding: 10px 0;
    border-top-right-radius: 5px;
    background: $gray-background;

    display: flex;
    align-items: flex-end;
    justify-content: space-around;
    flex-shrink: 0;
  }

  .tab-button {
    color: $gray-900;
    border-bottom: 2px solid white;
    border: 1px solid transparent;
    cursor: pointer;
    text-align: center;
    position: relative;

    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;

    &.selected {
      color: currentColor;
      font-weight: 600;

      &::before {
        content: '';
        position: absolute;
        width: 100%;
        top: 135%;
        left: 0;
        border-bottom: 4px solid $blue-600;
      }
    }

    &::after {
      content: attr(data-text);
      content: attr(data-text) / '';
      visibility: hidden;
      height: 0;
      pointer-events: none;
      overflow: hidden;
      font-weight: 600;
    }
  }

  .tab {
    height: 100%;
    &.hidden {
      display: none;
    }
  }

  .content {
    flex-grow: 1;
    overflow-y: scroll;
    overflow-x: hidden;
  }


</style>

<div class='sidebar' bind:this={component}>

  <div class='header'>
    <div class='tab-button'
      data-text='Effect'
      class:selected={selectedTab === 'effect'}
      on:click={() => {selectedTab = 'effect';}}
    >
      Effect
    </div>

    <div class='tab-button'
      data-text='Feature'
      class:selected={selectedTab === 'feature'}
      on:click={() => {selectedTab = 'feature';}}
    >
      Feature
    </div>

    <div class='tab-button'
      data-text='History'
      class:selected={selectedTab === 'history'}
      on:click={() => {selectedTab = 'history';}}
    >
      History
    </div>

  </div>

  <div class='content'>

    <div class='tab' class:hidden={selectedTab !== 'effect'}>
      <ClassificationMetrics sidebarStore={sidebarStore}/>
    </div>

    <div class='tab' class:hidden={selectedTab !== 'feature'}>
      <Feature />
    </div>

    <div class='tab' class:hidden={selectedTab !== 'history'}>
      <History />
    </div>
    
  </div>

</div>