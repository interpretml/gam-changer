<script>
  import * as d3 from 'd3';
  import { onMount, createEventDispatcher } from 'svelte';
  import selectIconSVG from '../img/select-icon.svg';
  import dragIconSVG from '../img/drag-icon.svg';

  let selectMode = false;
  let component = null;

  const dispatch = createEventDispatcher();

  /**
   * Event handler for the select button in the header
   */
  const selectModeSwitched = () => {
    selectMode = !selectMode;
    dispatch('selectModeSwitched', {
      selectMode: selectMode
    });
  };

  /**
   * Dynamically bind SVG files as inline SVG strings in this component
   */
  const bindInlineSVG = () => {
    d3.select(component)
      .select('.svg-icon#toggle-button-move')
      .html(dragIconSVG.replaceAll('black', 'currentcolor'));

    d3.select(component)
      .select('.svg-icon#toggle-button-select')
      .html(selectIconSVG.replaceAll('black', 'currentcolor'));
  };

  onMount(() => {
    bindInlineSVG();
  });

</script>

<style type='text/scss'>

  $width: 100%;
  $secondary-color: hsl(0, 0%, 40%);
  $border-radius: 13px;

  @mixin toggle-button-label {
    padding: 5px 0;
    width: calc(#{$width} / 2);
    display: flex;
    justify-content: center;
    position: absolute;
    z-index: 2;
    color: white;
    transition: all .2s ease;
  }

  .toggle-wrapper {
    display: flex;
    // Expect the parent to have a width defined
    width: 200px;
  }

  .toggle {
    display: none;
    
    &:checked + .toggle-button .dot {
      left: 50%;
    }
  }

  .toggle-button {
    outline: 0;
    display: flex;
    align-items: center;
    justify-content: space-around;
    width: $width;
    position: relative;
    height: 2em;
    cursor: pointer;
    user-select: none;

    border: 1px solid hsl(0, 0%, 86%);
    border-radius: $border-radius;
    transition: all .4s ease;

    .left-label {
      @include toggle-button-label;
      left: 0;

      &.select-mode {
        color: $secondary-color;
      }
    }

    .right-label {
      @include toggle-button-label;
      right: 0px;
      color: $secondary-color;

      &.select-mode {
        color: white;
      }
    }

    .dot {
      position: absolute;
      width: 50%;
      height: 100%;
      left: 0;
      border-radius: $border-radius;

      background: hsl(213, 100%, 60%);
      transition: all .2s ease;
    }

    .icon-label {
      margin-left: 5px;
    }
  }

  :global(.toggle-wrapper .svg-icon) {
    display: flex;
    justify-content: center;
    align-items: center;

    :global(svg) {
      width: 1.2em;
      height: 1.2em;
    }
  }

</style>

<div class='toggle-wrapper' bind:this={component}>

  <input class='toggle' id='my-toggle' type='checkbox' on:change={selectModeSwitched}/>

  <label for='my-toggle' class='toggle-button'>

    <div class='left-label' class:select-mode = {selectMode}>
      <div class='svg-icon' id='toggle-button-move'></div>
      <div class='icon-label'>Move</div>
    </div>

    <div class='right-label' class:select-mode = {selectMode}>
      <div class='svg-icon' id='toggle-button-select'></div>
      <div class='icon-label'>Select</div>
    </div>

    <div class='dot'></div>

  </label>
</div>
