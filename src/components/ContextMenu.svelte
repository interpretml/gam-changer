<script>
  import * as d3 from 'd3';
  import { onMount, createEventDispatcher } from 'svelte';

  // Stores
  import { multiSelectMenuStore } from '../store';

  // SVGs
  import mergeIconSVG from '../img/merge-icon.svg';
  import increasingIconSVG from '../img/increasing-icon.svg';
  import decreasingIconSVG from '../img/decreasing-icon.svg';
  import upDownIconSVG from '../img/updown-icon.svg';
  import trashIconSVG from '../img/trash-icon.svg';
  import upIconSVG from '../img/up-icon.svg';
  import downIconSVG from '../img/down-icon.svg';
  import interpolateIconSVG from '../img/interpolate-icon.svg';

  // Component variables
  let component = null;
  let controlInfo = {
    moveMode: false,
    increment: 0
  };

  // Store binding
  multiSelectMenuStore.subscribe(value => {
    controlInfo = value;
  });

  const dispatch = createEventDispatcher();

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
      .select('.svg-icon#icon-merge')
      .html(preProcessSVG(mergeIconSVG));

    d3.select(component)
      .select('.svg-icon#icon-increasing')
      .html(increasingIconSVG.replaceAll('black', 'currentcolor'));

    d3.select(component)
      .select('.svg-icon#icon-decreasing')
      .html(decreasingIconSVG.replaceAll('black', 'currentcolor'));

    d3.select(component)
      .select('.svg-icon#icon-updown')
      .html(preProcessSVG(upDownIconSVG));

    d3.select(component)
      .select('.svg-icon#icon-input-up')
      .html(upIconSVG.replaceAll('black', 'currentcolor'));

    d3.select(component)
      .select('.svg-icon#icon-input-down')
      .html(downIconSVG.replaceAll('black', 'currentcolor'));

    d3.select(component)
      .select('.svg-icon#icon-delete')
      .html(trashIconSVG.replaceAll('black', 'currentcolor'));

    d3.select(component)
      .select('.svg-icon#icon-interpolate')
      .html(interpolateIconSVG.replaceAll('black', 'currentcolor'));

  };

  const inputChanged = (e) => {
    e.preventDefault();
    let value = parseInt(e.target.value);

    if (isNaN(value)) value = 0;
    controlInfo.increment = value;
    e.target.value = `${value >= 0 ? '+' : ''}${value}`;

    // Update the store
    multiSelectMenuStore.set(controlInfo);

    dispatch('inputChanged');
  };

  const inputAdd = () => {
    controlInfo.increment++;
    d3.select(component)
      .select('.item-input')
      .node()
      .value = `${controlInfo.increment >= 0 ? '+' : ''}${controlInfo.increment}`;

    // Update the store
    multiSelectMenuStore.set(controlInfo);

    dispatch('inputChanged');
  };

  const inputMinus = () => {
    controlInfo.increment--;
    d3.select(component)
      .select('.item-input')
      .node()
      .value = `${controlInfo.increment >= 0 ? '+' : ''}${controlInfo.increment}`;

    // Update the store
    multiSelectMenuStore.set(controlInfo);

    dispatch('inputChanged');
  };

  const moveButtonClicked = () => {
    controlInfo.moveMode = !controlInfo.moveMode;

    // Update the store
    multiSelectMenuStore.set(controlInfo);

    dispatch('moveButtonClicked');
  };

  onMount(() => {
    bindInlineSVG();
  });

</script>

<style type='text/scss'>
  @import '../define';

  $secondary-color: hsl(0, 0%, 40%);
  $border-radius: 13px;
  $dot-background: $blue-dark;
  $hover-color: $blue-dark;

  @mixin item-input-arrow {
    position: absolute;
    display: flex;
    align-content: center;
    justify-content: center;
    color: $indigo-dark;
    width: 12px;
    height: 25px;
    right: 0;

    &:hover {
      color: $hover-color;
    }
  }

  .menu-wrapper {
    height: 50px;
    border-radius: 4px;
    background: white;
    box-shadow: 0px 4px 16px hsla(245, 100%, 11%, 0.12)
  }

  .items {
    display: flex;
    padding: 0 5px;
    cursor: pointer;
  }

  .item {
    width: 40px;
    height: 50px;
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    pointer-events: fill;

    color: $indigo-dark;

    &.has-input {
      width: 70px;
      justify-content: flex-start;
    }

    &.selected {
      color: $blue-icon;

      &:hover {
        color: $blue-icon;
      }
    }

    &:hover {
      color: $hover-color;
    }
  }

  .item-input {
    text-align: center;
    font-size: 1em;
    line-height: 35px;
    height: 35px;
    max-width: 52px;
    color: $indigo-dark;
    opacity: 0.8;
    border-radius: 2px;
    border: 1px solid transparent;
    outline: none;

    &:focus {
      border-radius: 2px;
      border: 1px solid hsla(0, 0%, 0%, 0.2);
    }
  }

  .svg-icon.item-input-up {
    @include item-input-arrow;

    align-items: flex-end;
    padding-bottom: 5px;

    top: 0;
  }

  .svg-icon.item-input-down {
    @include item-input-arrow;

    align-items: flex-start;
    padding-top: 5px;

    bottom: 0;
  }

  .separator {
    margin: 0 5px;
    width: 1px;
    background-color: hsl(0, 0%, 90%);
    height: 50px;
  }

  :global(.menu-wrapper .svg-icon) {
    display: flex;
    justify-content: center;
    align-items: center;

    :global(svg) {
      width: 1.2em;
      height: 1.2em;
      fill: currentcolor;
      stroke: currentcolor;
    }
  }

  :global(.menu-wrapper .has-input .svg-icon svg) {
    width: 10px;
    height: 5px;
  }

</style>

<div class='menu-wrapper' bind:this={component}>

  <div class='items'>

    <!-- Move button -->
    <div class='item' on:click={moveButtonClicked}
      class:selected={controlInfo.moveMode}
    >
      <div class='svg-icon' id='icon-updown'></div>
    </div>

    <div class='separator'></div>

    <!-- Input field -->
    <div class='item has-input'>
      <input class='item-input'
        placeholder={`${controlInfo.increment >= 0 ? '+' : '-'}${controlInfo.increment}`}
        on:change={inputChanged}
      >

      <div class='svg-icon item-input-up' id='icon-input-up'
        on:click={inputAdd}
      ></div>

      <div class='svg-icon item-input-down' id='icon-input-down'
        on:click={inputMinus}
      ></div>
    </div>

    <div class='separator'></div>

    <!-- Increasing -->
    <div class='item'
      on:click={() => dispatch('increasingClicked')}
    >
      <div class='svg-icon' id='icon-increasing'></div>
    </div>

    <!-- Decreasing -->
    <div class='item'
      on:click={() => dispatch('decreasingClicked')}
    >
      <div class='svg-icon' id='icon-decreasing'></div>
    </div>

    <div class='separator'></div>

    <!-- Interpolation -->
    <div class='item'
      on:click={() => dispatch('interpolationClicked')}
    >
      <div class='svg-icon' id='icon-interpolate'></div>
    </div>

    <div class='separator'></div>

    <!-- Merge -->
    <div class='item'
      on:click={() => dispatch('mergeClicked')}
    >
      <div class='svg-icon' id='icon-merge'></div>
    </div>

    <div class='separator'></div>

    <!-- Deletion -->
    <div class='item'
      on:click={() => dispatch('deleteClicked')}
    >
      <div class='svg-icon' id='icon-delete'></div>
    </div>

  </div>

</div>
