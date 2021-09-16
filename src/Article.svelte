<svelte:head>
  <script id="MathJax-script" src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>
</svelte:head>

<script>
  import d3 from './utils/d3-import';
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';

  import GAM from './GAM.svelte';
  import Tooltip from './components/Tooltip.svelte';

  import githubIconSVG from './img/github-icon.svg';
  import youtubeIconSVG from './img/youtube-icon.svg';
  import pdfIconSVG from './img/pdf-icon.svg';

  import { tooltipConfigStore } from './store';

  // Define inline math
  const math1 = '\\(x \\in \\mathbb{R}^{N\\times D} \\)';
  const math2 = '\\(y \\in \\mathbb{R}^{N} \\)';
  const math3 = '$$g \\left(y \\right) = f_0 + \\sum_{j=1}^{D} f_j \\left(x_j \\right)$$';
  const math4 = '\\( \\sum f_{ij}\\left(x_i ,x_j\\right)\\)';

  let component = null;

  // Set up tooltip
  let tooltip = null;
  let tooltipConfig = null;
  tooltipConfigStore.subscribe(value => {tooltipConfig = value;});

  // Set up tab interactions
  let tab = 'iowa';
  let tabNames = {
    iowa: {
      modelName: 'iow-house-ebm-binary',
      sampleName: 'iow-house-train-sample'
      // modelName: 'iowa-house-regression-model',
      // sampleName: 'iowa-house-regression-sample'
    },
    adult: {
      modelName: 'adult-model',
      sampleName: 'adult-sample'
    },
    my: {
      modelName: null,
      sampleName: null
    }
  };

  // Bind the SVGs
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
      .selectAll('.svg-icon.icon-github')
      .html(preProcessSVG(githubIconSVG));

    d3.select(component)
      .selectAll('.svg-icon.icon-youtube')
      .html(preProcessSVG(youtubeIconSVG));

    d3.select(component)
      .selectAll('.svg-icon.icon-pdf')
      .html(preProcessSVG(pdfIconSVG));
  };

  const tabClicked = (newTab) => {
    tab = newTab;
  };

  onMount(() => {
    bindInlineSVG();
  });

</script>

<style type='text/scss'>

  @import 'define';
  @import 'article';
  
  .page {
    display: flex;
    flex-direction: column;
  }

  .top {
    position: relative;
    display: grid;
    height: min(800px, calc(100vh - 5px));
    grid-template-columns: [start] 1fr [mid-start] auto [mid-end] 1fr [end];
    grid-template-rows: [start] 3fr [content-start] auto [content-end] 2fr [end];
  }

  .top-fill {
    background: $blue-dark;
    grid-column: start / end;
    grid-row: start / end;
    height: 61.8%;
  }

  .top-empty {
    grid-column: end / start;
    grid-row: start / end;
    height: 30%;
  }

  .logo-container {
    grid-column: mid-start / mid-end;
    grid-row: start / content-start;
    display: flex;
    align-items: center;
    margin-left: 20px;
  }

  .logo-icon {
    height: auto;
    width: 100%;
    max-width: 400px;
  }

  .gam-changer {
    grid-column: mid-start / mid-end;
    grid-row: content-start / content-end;

    background: white;
    border-radius: 10px;
    box-shadow: 0px 10px 40px hsla(0, 0%, 0%, 0.2);
  }

  .icon-container {
    grid-column: mid-end / end;
    grid-row: content-start / content-end;
    width: 95px;

    display: flex;
    flex-direction: column;
    margin: 20px 0 0 25px;
    gap: 10px;

    a {
      display: flex;
      flex-direction: row;
      align-items: center;
      color: white;
      gap: 10px;

      span {
        font-size: 1.2em;
      }
    }
  }

  .svg-icon {
    height: 100%;
    color: white;
    display: inline-flex;
    align-items: center;

    :global(svg) {
      width: 2em;
      height: 2em;
    }
  }

  .gam-tab {
    grid-column: mid-start / mid-end;
    grid-row: content-end / end;

    display: flex;
    flex-direction: column;
    padding-top: 20px;
    width: 100%;

    .tab-title {
      text-align: center;
      font-size: 0.9em;
      font-variant: initial;
      color: gray;
      cursor: default;
    }

    .tab-options {
      display: flex;
      justify-content: center;
      align-items: flex-end;
      color: $blue-dark;
      gap: 15px;
      font-variant: small-caps;
      font-size: 1.1em;

      span.option {
        cursor: pointer;
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;

        &::after {
          content: attr(data-text);
          content: attr(data-text) / "";
          height: 0;
          visibility: hidden;
          overflow: hidden;
          user-select: none;
          pointer-events: none;
          font-weight: 600;
        }
      }

      span.selected {
        text-decoration: underline;
        font-weight: 600;
      }
    }
  }

</style>

<div class='page' bind:this={component}>
  <Tooltip bind:this={tooltip}/>

  <div class='top'>

    <div class='top-fill'>

    </div>

    <div class='top-empty'>

    </div>

    <div class='logo-container'>
      <div class='logo-icon'>
        <img src='/img/logo.svg' alt='logo img'>
      </div>
    </div>

    {#key tab}
      <div class='gam-changer' in:fly={{ x: 2000, duration: 800 }} out:fly={{ x : -2000, duration: 800 }}>
        <GAM modelName={tabNames[tab].modelName}
          sampleName={tabNames[tab].sampleName}
          svgWidth={null}
        />
      </div>
    {/key}

    <div class='icon-container'>
      <a target="_blank" href="https://interpret.ml">
        <div class="svg-icon icon-github" title="Open-source code">
        </div>
        <span>Code</span>
      </a>

      <a target="_blank" href="https://interpret.ml">
        <div class="svg-icon icon-youtube" title="Demo video">
        </div>
        <span>Video</span>
      </a>

      <a target="_blank" href="https://interpret.ml">
        <div class="svg-icon icon-pdf" title="Paper">
        </div>
        <span>Paper</span>
      </a>

    </div>

    <div class='gam-tab'>
      <!-- <span class='tab-title'>
        Choose a model
      </span> -->

      <div class='tab-options'>
        <span class='tab-title'>Choose a model:</span>
        <span class='option' class:selected={tab === 'iowa'}
          data-text='iowa house price'
          on:click={() => tabClicked('iowa')}>
          iowa house price
        </span>

        <span class='option' class:selected={tab === 'adult'}
          data-text='census income'
          on:click={() => tabClicked('adult')}>
          census income
        </span>

        <span class='option' class:selected={tab === 'my'}
          data-text='my model'
          on:click={() => tabClicked('my')}>
          my model
        </span>
      </div>
    </div>

  </div>



  <div class='article'>

    <h2 id="what-is-gam-changer">What is <span class='tool-text'>GAM Changer</span>?</h2>
    <p>Machine Learning (ML) researchers have developed many techniques to make ML models interpretable.
      However, it is unclear how we can use interpretability to improve ML models.
      GAM Changer is an interactive tool that turns interpretability into actions—it empowers domain experts and data scientists
      to easily and responsibly edit the weights of Generalized Additive Models (GAMs), the state-of-the-art interpretable ML model
      for tabular data. With GAM Changer, you can align model behaviors with your domain knowledge and values.</p>

    <p>Don’t worry if you are not familiar with GAMs.
      These models have emerged as one of the most popular model classes among today’s data science community.
      GAMs’ predictive performance is on par with more complex, state-of-the-art models, yet GAMs remain simple enough for humans to understand its decision process.
      Given an input {math1} and a target {math2}, a GAM with a link function \(g\) and shape function \(f_j\) for each feature \(j\) can be written as:
    </p>
    {math3}

    <p>
      The link function is determined by the task. For example, in binary classification, \(g\) is logit.
      In the equation above, \(f_0\) represents the intercept constant.
      There are many options for the shape functions \(f_j\), such as spline, gradient-boosted tree, and neural network.
      Some GAMs also support pair-wise interaction terms {math4}.
      Different GAM variants come with different training methods, but once trained, they all have the same form.
      The interpretability of GAMs stems from the fact that people can visualize and modify each individual feature \(j\)’s
      contribution to the model’s prediction by inspecting and adjusting the shape function \(f_j\).
      Since GAMs are additive, one can edit the functions expressing the impact of distinct features independently.
    </p>


    <h2 id="why-do-i-want-to-change-gams">Why do I Want to Change GAMs?</h2>

    <p>&quot;All models are wrong, and some are harmful&quot; is a modern realization of George Box’s <a href="https://en.wikipedia.org/wiki/All_models_are_wrong">famous quote</a>.
      This is particularly true for ML-powered systems in high-stake domains (e.g., healthcare, finance, and criminal justice),
      as a simple mistake can lead to catastrophic impacts on countless individuals.
      These model mistakes can be caused by human label error, questionable training data, or even the training stochasticity.
      With interpretable ML models, we see many models exploit problematic patterns in the training data to make predictions.
    </p>
    <p>
      Here is an example where domain experts want to fix their GAMs.
      Doctors have trained an EBM model to predict the risk of dying from pneumonia.
      The model uses continuous (e.g., <code>age</code>), categorical (e.g., <code>having asthma</code>) features, and their pair-wise interaction terms from a dataset collected in a US hospital.
      The model’s prediction pattern on the feature <code>age</code> is visualized in Figure 1.
    </p>

    <p>The shape function visualization shows that the model predicts younger patients to have lower risk, and the risk increases when patients grow older.
      However, the predicted risk suddenly plunges when the age passes 100—leading to a similar risk score as if the patient is 30 years younger!
      One hypothesis to explain this dangerous pattern is that it might be due to outliers in this age range, especially the range has a small sample size.
      To identify the true impact of age on pneumonia risk, additional causal experiments and analysis are needed.
      Without robust evidence that people over 100 are truly at lower risk, doctors might fear that they may be injuring patients by depriving needy older people of care,
      and violating their primary obligation to <strong>do no harm</strong>.
      Therefore, some doctors would like to manually set the risk of older patients to be equal to that of their slightly younger neighbors.
    </p>
    <p>Interpretability helps us discover model errors like the sudden drop of predicted risk of older patients, however,
      it is yet unclear how we can fix these dangerous patterns.
      GAM Changer aims to address this practical challenge.
      With this tool, you can easily <em>investigate</em>, <em>validate</em>, and <em>align</em> GAM behaviors with your domain knowledge
      and values through interactively editing model parameters.
    </p>

    <h2 id="how-to-use-gam-changer">How to Use GAM Changer?</h2>
    <h4 id="quick-start">Quick Start</h4>
    <p>There are two ways to use GAM Changer to edit a trained EBM model.
      The first option is to select &quot;My Model&quot; on the top of this page, and upload your model and sample data by dragging them to the interface.
      You can follow <a href="https://gist.github.com/xiaohk/875b5374840c66689eb42a4b8820c3b5">this instruction</a> to export EBM models.
      Alternatively, you can directly use GAM Changer in any computational notebooks (e.g., Jupyter Notebook/Lab, Google Colab).
      You can follow the steps in this <a href="https://colab.research.google.com/drive/1OgAVZKqs2VwmY13QuOjCxlOEyexsYjtm?usp=sharing">example notebook</a>.
    </p>

    <h4 id="gam-canvas">GAM Canvas</h4>
    <p>The GAM Canvas (Figure 2) is the primary view of GAM Changer.
      It is visualizes one input feature’s contribution to the model’s prediction by plotting its shape function.
      As a GAM’s inference varies by feature type, we apply different visualization designs for different feature types.
      You can use the feature selection drop-down to switch features. At start, GAM Changer chooses the feature with the highest importance score for you.
    </p>
    <p>In the <em>Move Mode</em>, you can pan and zoom to inspect the graphs. To edit the model, you can switch to <em>Selection Mode</em> and select bins you want to change by drawing a bounding box around them.
      Then, the <em>Context Toolbar</em> will appear, where you can apply different preset editing tools.
      For example, with the <em>Move</em> tool, you can drag the selected bins up and down to change their contribution scores.
      With the interpolation tool, you can (1) geometrically interpolate between two extreme points, (2) fit a mini-regression, or (3) use an arbitrary number of points to connect two extreme points (either geometric interpolation or regression).
    </p>

    <h4 id="metric-panel">Metric Panel</h4>
    <p>Model editing empowers domain experts and data scientists to exercise human agency, but <em>demands caution</em>.
      Changing an ML model can have serious consequences—you should only edit the model when you are confident that it would improve the model.
      Fortunately, GAMs are glass-box models, so we can figure out the effect of model changes. To help you keep track of the editing effect on the model performance over the sample dataset, we have developed the <em>Metric Panel</em> (figure).
      In real-time, it visualizes the model performance metrics of the original model, last version, and the current version. You can also choose different metric scopes to focus on the selected bins or a slice of dataset (e.g., houses in certain neighborhoods).
    </p>

    <h4 id="feature-panel">Feature Panel</h4>
    <p>Besides model performance, we also hope you to be mindful about fairness issues during model editing;
      some edits can disproportionally affect certain sub-groups in the dataset. For example, in a house price prediction model, editing model behaviors with high-quality houses is more likely to affect houses built in recent years.
      In healthcare, model edits made for older patients tend to affect women more than men. To help you be aware of the characteristics of samples that are affected by your edits, we have developed the <strong>Feature Panel</strong>.
      Every time you select an editing region on the <em>GAM Canvas</em>, the <strong>Feature Panel</strong> automatically identifies other correlated features (both continuous and categorical) and sort them based on correlations.
      It also visualizes the distribution of the affected samples vs. the all samples in the dataset.
    </p>

    <h4 id="history-panel">History Panel</h4>
    <p>We hope the <strong>Metric Panel</strong> and <strong>Feature Panel</strong> can help you identify and envision potential consequences of your edits, so that you can make responsible edits.
      But don’t worry if you have accidentally made a mistake! You can always click the <em>Undo</em> and <em>Redo</em> buttons to undo and redo any edits!
      You can also use keyboard shortcuts <kbd>command</kbd> (or <kbd>control</kbd> on Windows) + <kbd>z</kbd> and <kbd>command</kbd> + <kbd>shift</kbd> + <kbd>z</kbd>.
    </p>
    <p>GAM Changer keeps track of all the edits you have made, and it organizes them as a timeline in the <strong>History Panel</strong>.
      You can also see the timestamp, feature type, feature name, and an automatically generated description of every edit.
      By clicking the <em>Check out</em> button, you can preview the model from a previous version.
      We encourage you to document all edits by typing in the text box. You can write the motivations and contexts of your edits;
      they will become very helpful when you review edits in the future! Finally, before saving the model (by clicking the <em>Save</em> button on the bottom right), GAM Changer forces you to review and confirm all edits by clicking the <em>Thumb-up</em> buttons.
      GAM Changer also saves the entire editing history and descriptions so that you can review or continue editing in the future. Again, we hope it can help you make accountable and transparent edits!
    </p>

    <h2 id="video-tutorial">Video Tutorial</h2>

    <h2 id="how-is-gam-changer-developed">How is <span class='tool-text'>GAM Changer</span> Developed?</h2>
    <p>GAM Changer uses <a href="https://webassembly.org">WebAssembly</a>, a modern web technology to accelerate in-browser computation.
      It enables GAM Changer to run a <em>live EBM model</em> along with <em>isotonic regression</em> and <em>correlation computations</em> directly <strong>in your browser</strong>!
      In other words, the entire app runs locally and privately, and your model and data would not leave your machine.
      The interactive system is written in Javascript using <a href="https://svelte.dev">Svelte</a> as a framework and <a href="https://d3js.org">D3.js</a> for visualizations.
    </p>

  </div>

</div>