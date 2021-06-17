<script>
  import * as d3 from 'd3';
  import { onMount, createEventDispatcher } from 'svelte';

  // Stores
  import { multiSelectMenuStore, tooltipConfigStore } from '../store';

  // SVGs
  import mergeIconSVG from '../img/merge-icon.svg';
  import increasingIconSVG from '../img/increasing-icon.svg';
  import decreasingIconSVG from '../img/decreasing-icon.svg';
  import upDownIconSVG from '../img/updown-icon.svg';
  import trashIconSVG from '../img/trash-icon.svg';
  import upIconSVG from '../img/up-icon.svg';
  import downIconSVG from '../img/down-icon.svg';
  import interpolateIconSVG from '../img/interpolate-icon.svg';
  import checkIconSVG from '../img/check-icon.svg';
  import refreshIconSVG from '../img/refresh-icon.svg';
  import minusIconSVG from '../img/minus-icon.svg';
  import plusIconSVG from '../img/plus-icon.svg';
  import inplaceIconSVG from '../img/inplace-icon.svg';

  // Component variables
  let component = null;
  let controlInfo = {
    moveMode: false,
    toSwitchMoveMode: false,
    subItemMode: null,
    increment: 0,
    step: 3
  };
  let tooltipConfig = {};
  let mouseoverTimeout = null;

  // Store binding
  multiSelectMenuStore.subscribe(value => {
    controlInfo = value;

    if (controlInfo.toSwitchMoveMode) {
      switchMoveMode();
      controlInfo.toSwitchMoveMode = false;
      multiSelectMenuStore.set(controlInfo);
    }
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
      .selectAll('.svg-icon.icon-input-up')
      .html(upIconSVG.replaceAll('black', 'currentcolor'));

    d3.select(component)
      .selectAll('.svg-icon.icon-input-down')
      .html(downIconSVG.replaceAll('black', 'currentcolor'));

    d3.select(component)
      .select('.svg-icon#icon-delete')
      .html(trashIconSVG.replaceAll('black', 'currentcolor'));

    d3.select(component)
      .select('.svg-icon#icon-interpolate')
      .html(interpolateIconSVG.replaceAll('black', 'currentcolor'));

    d3.select(component)
      .selectAll('.svg-icon.icon-check')
      .html(checkIconSVG.replaceAll('black', 'currentcolor'));

    d3.select(component)
      .selectAll('.svg-icon.icon-refresh')
      .html(refreshIconSVG.replaceAll('black', 'currentcolor'));

    d3.select(component)
      .selectAll('.svg-icon.icon-minus')
      .html(minusIconSVG.replaceAll('black', 'currentcolor'));

    d3.select(component)
      .selectAll('.svg-icon.icon-plus')
      .html(plusIconSVG.replaceAll('black', 'currentcolor'));

    d3.select(component)
      .selectAll('.svg-icon.icon-inplace')
      .html(inplaceIconSVG.replaceAll('black', 'currentcolor'));

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

  const switchMoveMode = () => {
    if (controlInfo.moveMode) {
      // Shrink the menu bar to make space for action
      d3.select(component)
        .transition()
        .duration(300)
        .ease(d3.easeCubicInOut)
        .style('width', '120px')
        .on('end', () => {
          d3.select(component)
            .selectAll('div.collapse-item')
            .style('display', 'flex');
        });

    } else {
      // restore the menu bar width
      d3.select(component)
        .selectAll('div.collapse-item')
        .style('display', 'none');

      d3.select(component)
        .transition()
        .duration(300)
        .ease(d3.easeCubicInOut)
        .style('width', '375px');
    }
  };

  const moveButtonClicked = () => {
    controlInfo.moveMode = !controlInfo.moveMode;

    switchMoveMode();

    // Update the store
    multiSelectMenuStore.set(controlInfo);

    dispatch('moveButtonClicked');
  };

  const moveCheckClicked = () => {

    controlInfo.moveMode = !controlInfo.moveMode;
    switchMoveMode();

    // Update the store
    multiSelectMenuStore.set(controlInfo);

    dispatch('moveCheckClicked');
  };

  const moveCancelClicked = () => {
    controlInfo.moveMode = !controlInfo.moveMode;
    switchMoveMode();

    // Update the store
    multiSelectMenuStore.set(controlInfo);

    dispatch('moveCancelClicked');
  };

  const increasingClicked = () => {
    // Need to handle the case where people change mode without checking/crossing
    if (controlInfo.subItemMode !== null) {
    // Hide the confirmation panel
      hideConfirmation(controlInfo.subItemMode);

      // Exit the sub-item mode
      controlInfo.subItemMode = null;
      multiSelectMenuStore.set(controlInfo);
    }

    controlInfo.subItemMode = 'increasing';
    multiSelectMenuStore.set(controlInfo);

    hideToolTipDuringSubMenu();

    dispatch('increasingClicked');
  };

  const decreasingClicked = () => {
    // Need to handle the case where people change mode without checking/crossing
    // We don't need to recover the original graph then enter new mode preview
    // We can directly enter the new mode with animation
    if (controlInfo.subItemMode !== null) {
    // Hide the confirmation panel
      hideConfirmation(controlInfo.subItemMode);

      // Exit the sub-item mode
      controlInfo.subItemMode = null;
      multiSelectMenuStore.set(controlInfo);
    }

    controlInfo.subItemMode = 'decreasing';
    multiSelectMenuStore.set(controlInfo);

    hideToolTipDuringSubMenu();

    dispatch('decreasingClicked');
  };

  const interpolationClicked = () => {
    if (controlInfo.subItemMode !== null) {
    // Hide the confirmation panel
      hideConfirmation(controlInfo.subItemMode);

      // Exit the sub-item mode
      controlInfo.subItemMode = null;
      multiSelectMenuStore.set(controlInfo);
    }

    controlInfo.subItemMode = 'interpolation';
    multiSelectMenuStore.set(controlInfo);

    hideToolTipDuringSubMenu();

    dispatch('interpolationClicked');
  };

  const hideToolTipDuringSubMenu = () => {
    // hide the tooltip
    clearTimeout(mouseoverTimeout);
    mouseoverTimeout = null;
    tooltipConfig.show = false;
    tooltipConfig.hideAnimated = false;
    tooltipConfigStore.set(tooltipConfig);
  };

  const subItemCheckClicked = (e) => {
    e.stopPropagation();
    dispatch('subItemCheckClicked');
  };

  const subItemCancelClicked = (e) => {
    e.stopPropagation();
    dispatch('subItemCancelClicked');
  };

  export const showConfirmation = (option, delay=500) => {
    d3.timeout(() => {
      let componentSelect = d3.select(component);

      componentSelect.select('.items')
        .style('overflow', 'visible');
      
      componentSelect.select(`.sub-item-${option}`)
        .classed('hidden', false);
    }, delay);
  };

  export const hideConfirmation = (option, delay=0) => {
    const _hideConfirmation = (option) => {
      let componentSelect = d3.select(component);

      componentSelect.select('.items')
        .style('overflow', 'hidden');
      
      componentSelect.select(`.sub-item-${option}`)
        .classed('hidden', true);
    };

    if (delay > 0) {
      d3.timeout(() => _hideConfirmation(option), delay);
    } else {
      _hideConfirmation(option);
    }
  };

  const mouseoverHandler = (e, message, width, yOffset) => {
    let node = e.currentTarget;

    // Do not show tooltip in sub-menu mode if hovering over the sub-menu items
    if (controlInfo.subItemMode !== null) {
      const target = d3.select(e.explicitOriginalTarget);
      if (!target.classed('show-tooltip')) {
        if (target.classed('sub-item-child') || target.classed('sub-item')) {
          return;
        }
      }
    }

    mouseoverTimeout = setTimeout(() => {
      let position = node.getBoundingClientRect();
      let curWidth = position.width;

      let tooltipCenterX = position.x + curWidth / 2;
      let tooltipCenterY = position.y - yOffset;
      tooltipConfig.html = `
        <div class='tooltip-content' style='display: flex; flex-direction: column;
          justify-content: center;'>
          ${message}
        </div>
      `;
      tooltipConfig.width = width;
      tooltipConfig.maxWidth = width;
      tooltipConfig.left = tooltipCenterX - tooltipConfig.width / 2;
      tooltipConfig.top = tooltipCenterY;
      tooltipConfig.fontSize = '14px';
      tooltipConfig.show = true;
      tooltipConfig.orientation = 's';
      tooltipConfigStore.set(tooltipConfig);
    }, 400);
  };

  const mouseleaveHandler = () => {
    clearTimeout(mouseoverTimeout);
    mouseoverTimeout = null;
    tooltipConfig.show = false;
    tooltipConfigStore.set(tooltipConfig);
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
    width: 100%;
    background: white;
    box-shadow: 0px 4px 16px hsla(245, 100%, 11%, 0.12);
  }

  .items {
    display: flex;
    align-items: center;
    padding: 0 5px;
    overflow: hidden;
    width: 100%;
    height: 100%;
  }

  .item {
    width: 40px;
    height: 50px;
    display: flex;
    cursor: pointer;
    justify-content: center;
    align-items: center;
    position: relative;
    pointer-events: fill;
    flex-shrink: 0;

    color: $indigo-dark;

    &.has-input {
      width: 70px;
      justify-content: flex-start;
    }

    &.selected {
      color: $blue-600;

      &:hover {
        color: $blue-600;
      }
    }

    &.disabled {
      cursor: no-drop;
      pointer-events: none;
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

  .collapse-item {
    display: none;
    flex-shrink: 0;

    .item {
      width: 30px;

      .svg-icon {
        color: hsl(0, 0%, 85%);

        :global(svg) {
          width: 1em;
          height: 1em;
        }
      }

      &:hover {
        color: $blue-600;

        .svg-icon {
          color: currentcolor;
        }
      }
    }
  }

  .sub-item {
    position: absolute;
    left: 50%;
    top: 50px;
    width: 70px;
    height: 30px;
    z-index: 1;
    transform: translate(-50%);
    background: white;

    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 0 2px 6px 2px hsla(205, 5%, 25%, 0.15);
    border-radius: 4px;

    &.sub-item-interpolation {
      width: 220px;
    }

    .item {
      width: 30px;
      height: 30px;

      .svg-icon {
        color: hsl(0, 0%, 85%);

        :global(svg) {
          width: 1em;
          height: 1em;
        }
      }

      &:hover {
        color: $blue-600;

        .svg-icon {
          color: currentcolor;
        }
      }
    }

    &.hidden {
      visibility: hidden;
      pointer-events: none;

      .item {
        visibility: hidden;
        pointer-events: none;
      }
    }
  }

  .svg-icon.item-input-up {
    @include item-input-arrow;

    align-items: flex-end;
    padding-bottom: 5px;

    top: 0;
  }

  .interpolate-step {
    display: flex;
    align-items: center;
    border: 2px solid $gray-200;
    border-radius: 4px;
    height: 24px;
  }

  .item-step-text {
    border-right: 2px solid $gray-200;
    border-left: 2px solid $gray-200;
    height: 24px;
    width: 30px;
    text-align: center;
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
    height: 100%;
    flex-shrink: 0;
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

  .hidden {
    visibility: hidden;
    pointer-events: none;
  }

</style>

<div class='menu-wrapper' bind:this={component}>

  <div class='items'>

    <!-- Move button -->
    <div class='item' on:click={moveButtonClicked}
      class:selected={controlInfo.moveMode}
      class:disabled={controlInfo.moveMode}
      on:mouseenter={(e) => mouseoverHandler(e, 'move', 55, 30)}
      on:mouseleave={mouseleaveHandler}
    >
      <div class='svg-icon' id='icon-updown'></div>
    </div>

    <div class='separator'></div>

    <div class='collapse-item'>
      <!-- Check button -->
      <div class='item' on:click={moveCheckClicked}>
        <div class='svg-icon icon-check'></div>
      </div>

      <!-- Cancel button -->
      <div class='item' on:click={moveCancelClicked}>
        <div class='svg-icon icon-refresh'></div>
      </div>

    </div>

    <!-- Input field -->
    <div class='item has-input'
      on:mouseenter={(e) => mouseoverHandler(e, 'change scores', 120, 30)}
      on:mouseleave={mouseleaveHandler}
    >
      <input class='item-input'
        placeholder={`${controlInfo.increment >= 0 ? '+' : '-'}${controlInfo.increment}`}
        on:change={inputChanged}
      >

      <div class='svg-icon item-input-up icon-input-up'
        on:click={inputAdd}
      ></div>

      <div class='svg-icon item-input-down icon-input-down'
        on:click={inputMinus}
      ></div>
    </div>

    <div class='separator'></div>

    <!-- Increasing -->
    <div class='item'
      on:click={increasingClicked}
      on:mouseenter={(e) => mouseoverHandler(e, 'monotonically increasing', 120, 52)}
      on:mouseleave={mouseleaveHandler}
    >
      <div class='svg-icon' id='icon-increasing'></div>
      
      <div class='sub-item sub-item-increasing hidden'>
        <!-- Check button -->
        <div class='item sub-item-child' on:click={subItemCheckClicked}>
          <div class='svg-icon icon-check'></div>
        </div>

        <!-- Cancel button -->
        <div class='item sub-item-child' on:click={subItemCancelClicked}>
          <div class='svg-icon icon-refresh'></div>
        </div>

      </div>
    </div>

    <!-- Decreasing -->
    <div class='item'
      on:click={decreasingClicked}
      on:mouseenter={(e) => mouseoverHandler(e, 'monotonically decreasing', 120, 52)}
      on:mouseleave={mouseleaveHandler}
    >
      <div class='svg-icon' id='icon-decreasing'></div>

      <div class='sub-item sub-item-decreasing hidden'>
        <!-- Check button -->
        <div class='item sub-item-child' on:click={subItemCheckClicked}>
          <div class='svg-icon icon-check'></div>
        </div>

        <!-- Cancel button -->
        <div class='item sub-item-child' on:click={subItemCancelClicked}>
          <div class='svg-icon icon-refresh'></div>
        </div>

      </div>
    </div>

    <div class='separator'></div>

    <!-- Interpolation -->
    <div class='item'
      on:click={interpolationClicked}
      on:mouseenter={(e) => mouseoverHandler(e, 'interpolate', 85, 30)}
      on:mouseleave={mouseleaveHandler}
    >
      <div class='svg-icon' id='icon-interpolate'></div>

      <div class='sub-item sub-item-interpolation hidden'>

        <!-- Inplace interpolation button -->
        <div class='item sub-item-child show-tooltip'
          on:mouseenter={(e) => mouseoverHandler(e, 'inplace', 70, 30)}
          on:mouseleave={mouseleaveHandler}
          on:click={subItemCheckClicked}
        >
          <div class='svg-icon icon-inplace'></div>
        </div>

        <div class='separator'></div>

        <div class='interpolate-step'>
          <!-- Minus button -->
          <div class='item sub-item-child' on:click={subItemCheckClicked}>
            <div class='svg-icon icon-minus'></div>
          </div>

          <!-- Interpolation step input -->
          <div class='item-step-text'>{controlInfo.step}</div>

          <!-- Plus button -->
          <div class='item sub-item-child' on:click={subItemCheckClicked}>
            <div class='svg-icon icon-plus'></div>
          </div>
        </div>

        <div class='separator'></div>

        <!-- Check button -->
        <div class='item sub-item-child' on:click={subItemCheckClicked}>
          <div class='svg-icon icon-check'></div>
        </div>

        <!-- Cancel button -->
        <div class='item sub-item-child' on:click={subItemCancelClicked}>
          <div class='svg-icon icon-refresh'></div>
        </div>
      </div>

    </div>

    <div class='separator'></div>

    <!-- Merge -->
    <div class='item'
      on:click={() => dispatch('mergeClicked')}
      on:mouseenter={(e) => mouseoverHandler(e, 'merge', 60, 30)}
      on:mouseleave={mouseleaveHandler}
    >
      <div class='svg-icon' id='icon-merge'></div>
    </div>

    <div class='separator'></div>

    <!-- Deletion -->
    <div class='item'
      on:click={() => dispatch('deleteClicked')}
      on:mouseenter={(e) => mouseoverHandler(e, 'delete', 60, 30)}
      on:mouseleave={mouseleaveHandler}
    >
      <div class='svg-icon' id='icon-delete'></div>
    </div>

  </div>

</div>
