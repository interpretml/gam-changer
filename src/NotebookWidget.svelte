<svelte:head>
	<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/bulma/0.9.1/css/bulma.min.css"
		integrity="sha512-ZRv40llEogRmoWgZwnsqke3HNzJ0kiI0+pcMgiz2bxO6Ew1DVBtWjVn0qjrXdT3+u+pSN36gLgmJiiQ3cQtyzA=="
		crossorigin="anonymous" />
</svelte:head>

<script>
import Main from './Main.svelte';
import Article from './Article.svelte';

import GAM from './GAM.svelte';
import Tooltip from './components/Tooltip.svelte';

import d3 from './utils/d3-import';
import { onMount } from 'svelte';

import githubIconSVG from './img/github-icon.svg';
import youtubeIconSVG from './img/youtube-icon.svg';
import pdfIconSVG from './img/pdf-icon.svg';
import logoSVG from './img/logo.svg';

import { tooltipConfigStore } from './store';

let component = null;

// Set up tooltip
let tooltip = null;
let tooltipConfig = null;
tooltipConfigStore.subscribe(value => {tooltipConfig = value;});

// Need to resize the svg to fit into the computational notebook
let svgWidth = null;
let iframeWidth = window.innerWidth;

svgWidth = Math.min(900, iframeWidth - 250 - 2);

// Bind the SVGs
const preProcessSVG = (svgString) => {
  return svgString.replaceAll('black', 'currentcolor')
    .replaceAll('stroke:none', 'fill:currentcolor');
};

/**
 * Dynamically bind SVG files as inline SVG strings in this component
 */
const bindInlineSVG = () => {
  d3.select(component)
    .selectAll('.svg-icon.icon-github')
    .html(preProcessSVG(githubIconSVG));

  d3.select(component)
    .selectAll('.svg-icon.icon-youtube')
    .html(preProcessSVG(youtubeIconSVG));

  d3.select(component)
    .selectAll('.svg-icon.icon-pdf')
    .html(preProcessSVG(pdfIconSVG));

  d3.select(component)
    .selectAll('.svg-logo')
    .html(preProcessSVG(logoSVG));
};

onMount(() => {
  bindInlineSVG();
});


</script>

<style lang='scss'>
  @import 'define';

	.stand-alone-page {
		color: #333;
		box-sizing: border-box;
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
		font-size: 16px;
		font-weight: 400;
		line-height: 1.5;
	}

  .gam-changer {
    background: white;
    border-radius: 10px;
  }

  .page {
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    padding-top: 10px;
  }

  .widget-wrapper {
    display: flex;
    flex-direction: column;
  }

  .notebook-header {
    background: $blue-dark;
    color: white;
    font-size: 1.3em;
    font-weight: 300;
    padding: 4px 10px;
    border-top-left-radius: 5px;
    border-top-right-radius: 5px;

    display: flex;
    justify-content: space-between;
  }

  .icon-container {
    display: flex;
    flex-direction: row;
    gap: 10px;

    a {
      display: flex;
      flex-direction: row;
      align-items: center;
      color: white;
      gap: 10px;

      span {
        font-size: 1em;
      }
    }
  }

  .svg-icon {
    height: 100%;
    color: white;
    display: inline-flex;
    align-items: center;

    :global(svg) {
      width: 1em;
      height: 1em;
    }
  }

  .svg-logo {
    height: 100%;
    color: white;
    display: inline-flex;
    align-items: center;

    :global(svg) {
      height: 1.1em;
    }
  }

  .header-logo {
    display: flex;
    gap: 8px;
  }

  .header-tagline {
    font-weight: 200;
    font-size: 0.9em;
    margin-top: 3px;
  }
</style>

<!-- Import Google font and font awesome -->
<link rel="preconnect" href="https://fonts.gstatic.com">
<link
		href="https://fonts.googleapis.com/css2?family=Source+Sans+Pro:ital,wght@0,200;0,300;0,400;0,600;0,700;0,900;1,200;1,300;1,400;1,600;1,700;1,900&display=swap"
		rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.13.1/css/all.min.css">

<div class='stand-alone-page' bind:this={component}>
  <div class='page'>
    <Tooltip bind:this={tooltip}/>

    <div class='gam-changer'>
      <div class='widget-wrapper'>
        <div class='notebook-header'>
          <div class='header-logo'>
            <a target='_blank' href='https://interpret.ml'>
              <div class='svg-logo'></div>
            </a>

            <div class='header-tagline'>
              Align ML Model Behaviors with Human Knowledge
            </div>
          </div>

          <div class='icon-container'>
            <a target="_blank" href="https://interpret.ml">
              <div class="svg-icon icon-github" title="Open-source code">
              </div>
            </a>

            <a target="_blank" href="https://interpret.ml">
              <div class="svg-icon icon-youtube" title="Demo video">
              </div>
            </a>

            <a target="_blank" href="https://interpret.ml">
              <div class="svg-icon icon-pdf" title="Paper">
              </div>
            </a>

          </div>
        </div>

        <GAM svgWidth={svgWidth}
          inNotebook={true}
        />
      </div>
    </div>

  </div>
</div>