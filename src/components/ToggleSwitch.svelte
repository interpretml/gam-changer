<script>
  import * as d3 from 'd3';
  import { onMount } from 'svelte';
  import selectIconSVG from '../img/select-icon.svg';
  import dragIconSVG from '../img/drag-icon.svg';

  let selectMode = false;
  let component = null;

  /**
   * Event handler for the select button in the header
   */
  const selectModeSwitched = () => {
    selectMode = !selectMode;
  };

  /**
   * Dynamically bind SVG files as inline SVG strings in this component
   */
  const bindInlineSVG = () => {
    d3.select(component)
      .select('.toggle-button .dot .icon-left')
      .html(dragIconSVG.replaceAll('black', 'currentcolor'));

    d3.select(component)
      .select('.toggle-button .dot .icon-right')
      .html(selectIconSVG.replaceAll('black', 'currentcolor'));
  };

  onMount(() => {
    bindInlineSVG();
  });

</script>

<style type='text/scss'>

  .toggle-wrapper {
    display: flex;
  }

  .toggle {
    display: none;
    
    &:checked + .toggle-button .dot {
      left: 50%;
      color: hsl(213, 100%, 60%);
      content: '\f245';
      font-weight: 900;

      .icon-left {
        display: none;
      }

      .icon-right {
        display: flex;
        justify-content: center;
        align-items: center;
        color: hsl(213, 100%, 60%);

        :global(svg) {
          stroke: hsl(213, 100%, 60%);
          fill: hsl(213, 100%, 60%);
        }
      }
    }
    
    &:checked + .toggle-button {
      background: hsl(213, 100%, 70%);
    }
  }

  .toggle-button {
    outline: 0;
    display: block;
    width: 3em;
    height: 1.5em;
    position: relative;
    cursor: pointer;
    user-select: none;
    margin-left: 10px;

    background: hsl(0, 0%, 90%);
    border-radius: 2em;
    padding: 2px;
    transition: all .4s ease;

    .dot {
      position: relative;
      width: 50%;
      height: 100%;

      left: 0;
      border-radius: 50%;
      background: white;
      transition: all .2s ease;
      
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 0.8em;
      
      font-family: "Font Awesome 5 Free";
      content: "\f255";

      :global(svg) {
        width: 1.2em;
        height: 1.2em;
      }

      .icon-left {
        color: hsl(0, 0%, 40%);
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .icon-right {
        display: none;
      }
    }
  }

  .toggle-label {
    color: hsl(0, 0%, 40%);

    &.select-mode {
      color: hsl(213, 100%, 60%);
    }
  }

</style>

<div class='toggle-wrapper' bind:this={component}>
  <div class='toggle-label' class:select-mode = {selectMode}> {selectMode ? 'Select' : 'Move'} </div>
  <input class='toggle' id='my-toggle' type='checkbox' on:change={selectModeSwitched}/>
  <label for='my-toggle' class='toggle-button'>
    <div class='dot'>
      <div class='icon-left'></div>
      <div class='icon-right'></div>
    </div>
  </label>
</div>
