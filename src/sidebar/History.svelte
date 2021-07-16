<script>

  import * as d3 from 'd3';
  import { onMount, afterUpdate } from 'svelte';
  import { flip } from 'svelte/animate';
  import { quadInOut, expoInOut, cubicInOut } from 'svelte/easing';
  import { round, shuffle } from '../utils/utils';
  import { bindInlineSVG } from '../utils/svg-icon-binding';
  
  export let sidebarStore;

  let component = null;
  let historyList = [];
  let sidebarInfo = null;
  let needToBindSVGs = false;

  const editTypeIconMap = {
    'increasing': 'icon-increasing',
    'decreasing': 'icon-decreasing',
    'move': 'icon-updown',
    'merge': 'icon-merge',
    'equal-interpolate': 'icon-interpolation',
    'inplace-interpolate': 'icon-inplace',
    'equal-regression': 'icon-interpolation',
    'inplace-regression': 'icon-regression',
    'delete': 'icon-delete'
  };

  sidebarStore.subscribe(value => {
    sidebarInfo = value;
  });
  
  const initData = async() => {
    historyList = await d3.json('/data/history.json');

    // Flag historyList changed, so we need to bind svgs after the divs are created
    needToBindSVGs = true;
    historyList.forEach(d => d.reviewed = false);
    historyList.forEach(d => d.preview = false);
    historyList[0].reviewed = true;
    console.log(historyList);
  };

  /**
   * Format the millisecond time to string
   * @param time Time in millisecond
   */
  const getTime = (time) => {
    let date = new Date(time);
    let hour = date.getHours();
    let minute = date.getMinutes();
    let months = ['January','February','March','April','May','June','July',
      'August','September','October','November','December'].map(d => d.substring(0, 3));
    let month = months[date.getMonth()];
    let day = date.getDate();
    let year  = date.getFullYear();

    return `${hour}:${minute} ${month} ${day}, ${year}`;
  };

  const checkboxClicked = (i) => {
    historyList[i].reviewed = !historyList[i].reviewed;
    historyList = historyList;
  };

  const previewClicked = (i) => {
    if (historyList[i].preview) {
      historyList[i].preview = false;
    } else  {
      // Only allow previewing one commit
      historyList.forEach(d => d.preview = false);
      historyList[i].preview = true;
    }
    historyList = historyList; 
  };

  const deleteClicked = (i) => {
    // Need user to confirm the delete action
    let result = confirm('Delete this commit will also remove all commits after it.');

    if (result) {
      historyList = historyList.slice(0, i);
    }

    console.log(historyList);
  };

  initData();

  afterUpdate(() => {
    if (needToBindSVGs) {
      bindInlineSVG(component);
      needToBindSVGs = false;
    }
  });

  onMount(() => {
    bindInlineSVG(component);
  });

</script>

<style type='text/scss'>

  @import '../define';

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

    &:active {
      border-color: $gray-border;
    }

    &.selected {
      background: $gray-200;
    }
  }

  .history-tab {
    height: 100%;
  }

  .history {
    height: 100%;
    width: 100%;
    overflow-y: scroll;
    overflow-x: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .commit {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    border-bottom: 1px solid $gray-border;
    padding: 5px 10px;
    font-size: 0.9em;
    gap: 5px;
  }

  .commit-title {
    width: 100%;
    display: flex;
    flex-direction: row;
    align-items: baseline;
    justify-content: space-between;
    cursor: default;
  }

  .commit-feature {
    font-weight: 600;
    color: $blue-dark;
  }

  .commit-time {
    font-size: 0.9em;
    color: $gray-700;
  }

  .commit-content {
    width: 100%;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.5em;
  }

  .commit-message {
    width: 100%;
    background: $gray-100;
    padding: 5px 10px;
    border: 1px solid $gray-border;
    border-radius: 2px;

    .commit-message-text {
      margin-right: 0.2em;
    }

    &:focus {
      background: none;
    }
  }

  .commit-checkbox {
    // margin-left: auto;
    cursor: pointer;
    width: 1em;
    height: 1em;
  }

  @keyframes thumbup {
    0%{
      transform: scale(0);
    }
    80%{
      transform: scale(1.3);
    }
    100%{
      transform: scale(1);
    }
  }

  .commit-icon {
    .svg-icon {
      color: $blue-dark;
      fill: $blue-dark;

      :global(svg) {
        width: 1.2em;
        height: 1.2em;
      }
    }
  }

  .commit-bar {
    @extend .commit-title;
    justify-content: flex-end;
    align-items: flex-start;
    gap: 10px;

    .svg-icon {
      cursor: pointer;
      color: $indigo-dark;
      fill: $indigo-dark;

      :global(svg) {
        width: 1em;
        height: 1em;
      }

      &:hover {
        color: $blue-600;
        fill: $blue-600;
      }

      &.selected {
        color: $orange-400;
        fill: $orange-400;
      }
    }

    .checkbox-box {
      &.hidden {
        display: none;
      }

      .svg-icon {
        opacity: 0.3;
      }
    }

    .checkbox-check {
      animation: thumbup 150ms ease-in;
      &.hidden {
        display: none;
      }

      .svg-icon {
        color: $blue-600;
        fill: $blue-600;
      }
    }
  }

  .commit-hash {
    font-family: ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace;
    font-size: 0.9em;
    color: $gray-700;
    margin-right: auto;
    cursor: copy;

    &:hover {
      color: $blue-600;
    }
  }

</style>

<div class='history-tab' bind:this={component}>

  <div class='icon-loading'>

  </div>

  <div class='history'>

    {#each historyList as history, i}

      <div class='commit'>
        <!-- Header -->
        <div class='commit-title'>

          <div class='commit-feature'>
            {history.featureName}
          </div>

          <div class='commit-time'>
            {getTime(history.time)}
          </div>

        </div>

        <!-- Content -->
        <div class='commit-content'>

          {#if history.type !== 'original'}
            <div class='commit-icon'>
              <div class={`svg-icon ${editTypeIconMap[history.type]}`}
                title={history.type}
              ></div>
            </div>
          {/if}

          <span class='commit-message' contenteditable bind:innerHTML={history.description}>
          </span>

        </div>

        <!-- Footer -->
        <div class='commit-bar'>
          <div class='commit-hash' title={'copy hash: ' + history.hash}
            on:click={() => navigator.clipboard.writeText(history.hash)}
          >
            {history.hash.substring(0, 7)}
          </div>

          <div class='commit-checkbox' title='confirm the edit'
            on:click={() => checkboxClicked(i)}
          >
            <div class='checkbox-box' class:hidden={history.reviewed}>
              <div class='svg-icon icon-box'></div>
            </div>

            <div class='checkbox-check' class:hidden={!history.reviewed}>
              <div class='svg-icon icon-thumbup'></div>
            </div>
          </div>

          <div class='svg-icon icon-eye' class:selected={history.preview} title='preview'
            on:click={() => previewClicked(i)}
          ></div>

          {#if history.type !== 'original'}
            <div class='svg-icon icon-commit-delete' title='delete'
              on:click={() => deleteClicked(i)}
            ></div>
          {/if}

        </div>

      </div>

    {/each}

  </div>

</div>