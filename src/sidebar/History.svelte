<script>

  import * as d3 from 'd3';
  import { onMount, afterUpdate } from 'svelte';
  import { flip } from 'svelte/animate';
  import { quadInOut, expoInOut, cubicInOut } from 'svelte/easing';
  import { round, shuffle } from '../utils/utils';

  // SVGs
  import mergeIconSVG from '../img/merge-icon.svg';
  import increasingIconSVG from '../img/increasing-icon.svg';
  import decreasingIconSVG from '../img/decreasing-icon.svg';
  import upDownIconSVG from '../img/updown-icon.svg';
  import trashIconSVG from '../img/trash-icon.svg';
  import trashCommitIconSVG from '../img/trash-commit-icon.svg';
  import eyeIconSVG from '../img/eye-icon.svg';
  import upIconSVG from '../img/up-icon.svg';
  import downIconSVG from '../img/down-icon.svg';
  import interpolateIconSVG from '../img/interpolate-icon.svg';
  import inplaceIconSVG from '../img/inplace-icon.svg';
  import interpolationIconSVG from '../img/interpolation-icon.svg';
  import regressionIconSVG from '../img/regression-icon.svg';
  import thumbupIconSVG from '../img/thumbup-icon.svg';
  import boxIconSVG from '../img/box-icon.svg';

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
      .selectAll('.svg-icon.icon-merge')
      .html(preProcessSVG(mergeIconSVG));

    d3.select(component)
      .selectAll('.svg-icon.icon-increasing')
      .html(increasingIconSVG.replaceAll('black', 'currentcolor'));

    d3.select(component)
      .selectAll('.svg-icon.icon-decreasing')
      .html(decreasingIconSVG.replaceAll('black', 'currentcolor'));

    d3.select(component)
      .selectAll('.svg-icon.icon-updown')
      .html(preProcessSVG(upDownIconSVG));

    d3.select(component)
      .selectAll('.svg-icon.icon-input-up')
      .html(preProcessSVG(upIconSVG));

    d3.select(component)
      .selectAll('.svg-icon.icon-input-down')
      .html(preProcessSVG(downIconSVG));

    d3.select(component)
      .selectAll('.svg-icon.icon-delete')
      .html(trashIconSVG.replaceAll('black', 'currentcolor'));

    d3.select(component)
      .selectAll('.svg-icon.icon-commit-delete')
      .html(preProcessSVG(trashCommitIconSVG));

    d3.select(component)
      .selectAll('.svg-icon.icon-eye')
      .html(preProcessSVG(eyeIconSVG));

    d3.select(component)
      .selectAll('.svg-icon.icon-interpolate')
      .html(interpolateIconSVG.replaceAll('black', 'currentcolor'));

    d3.select(component)
      .selectAll('.svg-icon.icon-inplace')
      .html(inplaceIconSVG.replaceAll('black', 'currentcolor'));

    d3.select(component)
      .selectAll('.svg-icon.icon-interpolation')
      .html(interpolationIconSVG.replaceAll('black', 'currentcolor'));

    d3.select(component)
      .selectAll('.svg-icon.icon-regression')
      .html(regressionIconSVG.replaceAll('black', 'currentcolor'));

    d3.select(component)
      .selectAll('.svg-icon.icon-thumbup')
      .html(preProcessSVG(thumbupIconSVG));

    d3.select(component)
      .selectAll('.svg-icon.icon-box')
      .html(preProcessSVG(boxIconSVG));
  };
  
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

  initData();

  afterUpdate(() => {
    if (needToBindSVGs) {
      bindInlineSVG();
      needToBindSVGs = false;
    }
  });

  onMount(() => {
    bindInlineSVG();
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
    background: $pastel1-gray;
    padding: 5px 10px;
    border-radius: 2px;
  }

  .commit-checkbox {
    // margin-left: auto;
    cursor: pointer;
    width: 1em;
    height: 1em;
  }
  

  .checkbox-box {
    &.hidden {
      display: none;
    }
  }

  .checkbox-check {
    animation: thumbup 150ms ease-in;
    &.hidden {
      display: none;
    }
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
        color: $orange-300;
        fill: $orange-300;
      }
    }
  }

  .commit-hash {
    font-family: ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace;
    font-size: 0.9em;
    color: $gray-700;
    margin-right: auto;
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

          <div class='commit-message' contenteditable>
            {history.description}
          </div>

        </div>

        <!-- Footer -->
        <div class='commit-bar'>
          <div class='commit-hash' title={'hash: ' + history.hash}>
            {history.hash.substring(0, 7)}
          </div>

          <div class='commit-checkbox' title='check to confirm'
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

           <div class='svg-icon icon-commit-delete' title='delete'></div>
        </div>

      </div>

    {/each}

  </div>

</div>