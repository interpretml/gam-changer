<script>
  import ClassificationMetrics from './ClassificationMetrics.svelte';
  import RegressionMetrics from './RegressionMetrics.svelte';
  import Feature from './Feature.svelte';
  import History from './History.svelte';

  export let sidebarStore;

  let selectedTab = 'effect';
  let sidebarInfo = {};

  sidebarStore.subscribe(value => {
    sidebarInfo = value;
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
  }

  .header {
    height: 53px;
    border-bottom: 1px solid $gray-border;
    padding: 10px 0;

    display: flex;
    align-items: flex-end;
    justify-content: space-around;
  }

  .tab-button {
    color: $gray-light;
    border-bottom: 2px solid white;
    border: 1px solid transparent;
    cursor: pointer;
    text-align: center;
    position: relative;

    &.selected {
      color: currentColor;

      &::after {
        content: '';
        position: absolute;
        width: 100%;
        top: 135%;
        left: 0;
        border-bottom: 4px solid $blue-600;
      }
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
  }


</style>

<div class='sidebar'>

  <div class='header'>
    <div class='tab-button'
      class:selected={selectedTab === 'effect'}
      on:click={() => {selectedTab = 'effect';}}
    >
      Effect
    </div>

    <div class='tab-button'
      class:selected={selectedTab === 'feature'}
      on:click={() => {selectedTab = 'feature';}}
    >
      Feature
    </div>

    <div class='tab-button'
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