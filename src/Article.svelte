<svelte:head>
  <script id="MathJax-script" src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>
</svelte:head>

<script>
  import Youtube from './Youtube.svelte';

  import d3 from './utils/d3-import';
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';

  import GAM from './GAM.svelte';
  import Tooltip from './components/Tooltip.svelte';

  import githubIconSVG from './img/github-icon.svg';
  import youtubeIconSVG from './img/youtube-icon.svg';
  import pdfIconSVG from './img/pdf-icon.svg';
  import msSVG from './img/ms-icon.svg';
  import gtSVG from './img/gt-icon.svg';
  import uwSVG from './img/uw-icon.svg';
  import nyuSVG from './img/nyu-icon.svg';

  import { tooltipConfigStore } from './store';

  // Define inline math
  const math1 = '\\( \\textcolor{hsl(24, 95%, 59%)}{x \\in \\mathbb{R}^{M}} \\)';
  const math2 = '\\( \\textcolor{hsl(148, 71%, 44%)}{y \\in \\mathbb{R}} \\)';
  const math3 = '$$ \\textcolor{hsl(265, 57%, 57%)}{g \\left( \\textcolor{hsl(148, 71%, 44%)}{y} \\right)} = \\textcolor{hsl(213, 28%, 41%)}{\\beta_0} + \\textcolor{hsl(206, 100%, 45%)}{f_1 \\left( \\textcolor{hsl(24, 95%, 59%)}{x_1} \\right)} + \\textcolor{hsl(206, 100%, 45%)}{f_2 \\left( \\textcolor{hsl(24, 95%, 59%)}{x_2} \\right)} + \\cdots + \\textcolor{hsl(206, 100%, 45%)}{f_M \\left( \\textcolor{hsl(24, 95%, 59%)}{x_M} \\right)} $$';
  const math4 = '\\( \\textcolor{hsl(206, 100%, 45%)}{f_{ij}\\left( \\textcolor{hsl(24, 95%, 59%)}{x_i ,x_j} \\right) }\\)';
  const math5 = '\\( \\textcolor{hsl(265, 57%, 57%)}{g} \\)';
  const math6 = '\\( \\textcolor{hsl(206, 100%, 45%)}{f_j} \\)';
  const math7 = '\\( \\textcolor{hsl(213, 28%, 41%)}{\\beta_0} \\)';
  const math8 = '\\( \\textcolor{hsl(24, 95%, 59%)}{x_j} \\)';
  const math9 = '\\( \\textcolor{hsl(206, 100%, 45%)}{f_{ij}\\left( \\textcolor{hsl(24, 95%, 59%)}{x_i} \\right) }\\)';

  let component = null;
  let currentPlayer = null;

  // Set up tooltip
  let tooltip = null;
  let tooltipConfig = null;
  tooltipConfigStore.subscribe(value => {tooltipConfig = value;});

  // Set up tab interactions
  let tab = 'iowa';
  let tabNames = {
    // pneumonia: {
    //   modelName: 'pneumonia-model',
    //   sampleName: 'pneumonia-sample-toy'
    // },
    iowa: {
      modelName: 'iow-house-ebm-binary',
      sampleName: 'iow-house-train-sample'
      // modelName: 'iowa-house-regression-model',
      // sampleName: 'iowa-house-regression-sample'
    },
    lc: {
      modelName: 'lc-model',
      sampleName: 'lc-data'
    },
    // mimic: {
    //   modelName: 'toy-mimic2-model',
    //   sampleName: 'toy-mimic2-sample-2000'
    // },
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

    d3.select(component)
      .selectAll('.svg-logo.icon-ms')
      .html(preProcessSVG(msSVG));

    d3.select(component)
      .selectAll('.svg-logo.icon-gt')
      .html(preProcessSVG(gtSVG));

    d3.select(component)
      .selectAll('.svg-logo.icon-uw')
      .html(preProcessSVG(uwSVG));

    d3.select(component)
      .selectAll('.svg-logo.icon-nyu')
      .html(preProcessSVG(nyuSVG));
  };

  const tabClicked = (newTab) => {
    tab = newTab;
  };

  onMount(() => {
    bindInlineSVG();
    d3.select('html')
      .style('scroll-behavior', 'smooth');
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

  .svg-logo {
    height: 100%;
    color: white;
    display: inline-flex;
    align-items: center;

    :global(svg) {
      height: 40px;
      // height: 2em;
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

  .article-footer {
    background: $blue-dark;
    color: white;
    padding: 2rem 0 2em 0;
    margin-top: 1rem;
    display: flex;
    width: 100%;
    justify-content: center;
  }

  .footer-main {
    display: flex;
    max-width: 100ch;
    flex-direction: row;
  }

  .footer-cp {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .footer-logo {
    display: flex;
    margin-right: 30px;
    gap: 30px;
  }

</style>

<div class='page' bind:this={component}>
  <Tooltip bind:this={tooltip}/>

  <div class='top' id='top'>

    <div class='top-fill'>

    </div>

    <div class='top-empty'>

    </div>

    <div class='logo-container'>
      <div class='logo-icon'>
        <img src='PUBLIC_URL/img/logo.svg' alt='logo img'>
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
      <a target="_blank" href="https://github.com/interpretml/gam-changer">
        <div class="svg-icon icon-github" title="Open-source code">
        </div>
        <span>Code</span>
      </a>

      <a target="_blank" href="https://youtu.be/2gVSoPoSeJ8">
        <div class="svg-icon icon-youtube" title="Demo video">
        </div>
        <span>Video</span>
      </a>

      <a target="_blank" href="https://arxiv.org/abs/2112.03245">
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

        <!-- <span class='option' class:selected={tab === 'pneumonia'}
          data-text='pneumonia risk'
          on:click={() => tabClicked('pneumonia')}>
          pneumonia risk
        </span> -->

        <!-- <span class='option' class:selected={tab === 'mimic'}
          data-text='mimic2'
          on:click={() => tabClicked('mimic')}>
          mimic2
        </span> -->

        <span class='option' class:selected={tab === 'iowa'}
          data-text='iowa house price'
          on:click={() => tabClicked('iowa')}>
          iowa house price
        </span>

        <span class='option' class:selected={tab === 'lc'}
          data-text='lending club'
          on:click={() => tabClicked('lc')}>
          lending club
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
      Given an <span style='color: hsl(24, 95%, 59%)'>input</span> {math1} and a <span style='color: hsl(148, 71%, 44%)'>target</span> {math2},
      a GAM with a <span style='color: hsl(265, 57%, 57%)'>link function</span> {math5} and <span style='color: hsl(206, 100%, 45%)'>shape function</span> {math6} for each feature \(j\) can be written as:
    </p>
    {math3}

    <p>
      The <span style='color: hsl(265, 57%, 57%)'>link function</span> {math5} is determined by the task. For example, in binary classification, {math5} is <span style='color: hsl(265, 57%, 57%)'>logit</span>.
      In the equation above, {math7} represents the <span style='color: hsl(213, 28%, 41%)'>intercept constant</span>.
      There are many options for the <span style='color: hsl(206, 100%, 45%)'>shape functions</span> {math6},
      such as <a href='https://www.routledge.com/Generalized-Additive-Models/Hastie-Tibshirani/p/book/9780412343902'><span style=''>splines</span></a>,
      <a href='https://dl.acm.org/doi/10.1145/2783258.2788613'><span style=''>gradient-boosted trees</span></a>,
      and <a href='https://arxiv.org/abs/2004.13912'><span style=''>neural networks</span></a>.
      Some GAMs also support pair-wise interaction terms {math4}.
      Different GAM variants come with different training methods, but once trained, they all have the same form.
      The interpretability and editability of GAMs stems from the fact that people can visualize and modify each individual feature {math8}'s
      contribution score to the model’s prediction by inspecting and adjusting the <span style='color: hsl(206, 100%, 45%)'>shape functions</span> {math6}.
      The contribution score is measured by the output of {math9}.
      Since GAMs are additive, we can edit different <span style='color: hsl(206, 100%, 45%)'>shape functions</span> independently.
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
      Doctors have trained an <a href="https://github.com/interpretml/interpret">Explainable Boosting Machine (EBM)</a> model, a tree-based GAM, to predict the risk of dying from pneumonia.
      The model uses continuous (e.g., <code>age</code>), categorical (e.g., <code>having asthma</code>) features, and their pair-wise interaction terms from a dataset collected in a US hospital.
      The model’s prediction pattern on the feature <code>age</code> is visualized in Figure 1.
    </p>

    <div class="figure">
      <img src="https://i.imgur.com/1jtTWUj.png" alt="Shape function of age on pneumonia risk prediction EBM" width=90% align="middle"/>
      <div class="figure-caption">
        Figure 1.  The shape function of age in an EBM model trained to predict the risk of dying from pneumonia.
        The curve shows that the model overall predicts older patients to have higher risk, but the predicted risk mysteriously drops when the patients are older than 100 years old.
        This prediction pattern can deprive needy patients of care and cause harm in deployment.
      </div>
    </div>

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

    <div class='video'>
      <video autoplay loop muted playsinline class='loop-video'>
        <source src="PUBLIC_URL/video/drag.mp4" type="video/mp4">
      </video>
      <div class="figure-caption">
        Figure 2.  In the <a href='#top' style='font-variant: small-caps;'>my model</a> tab, users can use simple drag-and-drop to start editing their GAM models.
      </div>
    </div>

    <p>We provide two options to use GAM Changer to edit your GAM models.
      The first option is to select <a href='#top' style='font-variant: small-caps;'>my model</a> on the top of this page, and then upload your model and sample data by dragging them to the interface (Figure 2).
      You can follow <a href="https://gist.github.com/xiaohk/875b5374840c66689eb42a4b8820c3b5">this instruction</a> to export GAM model and sample data.
      Alternatively, you can directly use GAM Changer in any computational notebooks (e.g., <a href='https://jupyter.org/'>Jupyter Notebook/Lab</a>, <a href='https://colab.research.google.com'>Google Colab</a>).
      You can follow the steps in this <a href="https://colab.research.google.com/drive/1OgAVZKqs2VwmY13QuOjCxlOEyexsYjtm?usp=sharing">example notebook</a>.
    </p>

    <h4 id="gam-canvas">GAM Canvas</h4>
    <p>The GAM Canvas (Figure 3) is the primary view of GAM Changer.
      It is visualizes one input feature’s contribution to the model’s prediction by plotting its shape function.
      As a GAM’s inference varies by feature type, we apply different visualization designs for different feature types.
      You can use the feature selection drop-down to switch features. At start, GAM Changer chooses the feature with the highest importance score for you.
    </p>

    <div class='video'>
      <video autoplay loop muted playsinline class='loop-video'>
        <source src="PUBLIC_URL/video/editing.mp4" type="video/mp4">
      </video>
      <div class="figure-caption">
        Figure 3.  In the <em>GAM Canvas</em>, you can inspect the shape function with zooming and panning.
        In the Selection Mode, you apply various editing tools to modify the shape function and therefore change the model prediction behaviors.
      </div>
    </div>

    <p>In the <em>Move Mode</em>, you can pan and zoom to inspect the graphs. To edit the model, you can switch to <em>Selection Mode</em> and select bins you want to change by drawing a bounding box around them.
      Then, the <em>Context Toolbar</em> will appear, where you can apply different preset editing tools.
      For example, with the <em>Move</em> tool, you can drag the selected bins up and down to change their contribution scores.
      With the interpolation tool, you can (1) geometrically interpolate between two extreme points, (2) fit a mini-regression, or (3) use an arbitrary number of points to connect two extreme points (either geometric interpolation or regression).
    </p>

    <h4 id="metric-panel">Metric Panel</h4>

    <div class='video'>
      <video autoplay loop muted playsinline class='loop-video'>
        <source src="PUBLIC_URL/video/performance.mp4" type="video/mp4">
      </video>
      <div class="figure-caption">
        Figure 4. There is a "live" GAM model running in your browser.
        GAM Changer modifies this model as you change the shape function, and tests the new model the sample data.
        The model performance is visualized in real-time in the <em>Metric Panel</em>.
      </div>
    </div>

    <p>Model editing empowers domain experts and data scientists to exercise human agency, but <strong>demands caution</strong>.
      Changing an ML model can have serious consequences—you should only edit the model when you are confident that it would improve the model.
      Fortunately, GAMs are glass-box models, so you can identify the effects of model changes.
      To help you keep track of the editing effects on the model performance over the sample dataset, we have developed the <em>Metric Panel</em> (Figure 4).
      In real-time, it visualizes the model performance metrics of the original model, last version, and the current version.
      You can also choose different metric scopes to focus on the selected bins or a slice of dataset (e.g., houses with paved alley).
    </p>

    <h4 id="feature-panel">Feature Panel</h4>

    <div class='video'>
      <video autoplay loop muted playsinline class='loop-video'>
        <source src="PUBLIC_URL/video/feature.mp4" type="video/mp4">
      </video>
      <div class="figure-caption">
        Figure 5. By identifying correlated features, GAM Changer helps you get an overview of the samples that are affected by your edits.
        With the <em>Feature Panel</em>, we hope you are aware that the affected samples might share some other important attributes,
        and model edits might have disproportional impact on some particular sub-populations.
      </div>
    </div>

    <p>Besides model performance, we also hope you to <strong>be mindful about fairness issues</strong> during model editing;
      some edits can disproportionally affect certain sub-groups in the dataset.
      For example, in a house price prediction model (Figure 5), editing model's prediction on high-quality houses is implicitly affecting houses built in recent years.
      This is because the house quality is correlated with when the house was built.
      In healthcare, model edits created for older patients tend to affect women more than men, because in average women live longer than men.
      To help you be aware of the characteristics of samples that are affected by your edits, we have designed the <em>Feature Panel</em> (Figure 5).
      Every time you select an editing region on the <em>GAM Canvas</em>, the <em>Feature Panel</em> automatically identifies other correlated features (both continuous and categorical) and sort them based on the correlation.
      It also visualizes the distribution of the affected samples vs. the all samples in the dataset.
      You can also hover over the histogram bins in the Categorical tab to view their labels.
    </p>

    <h4 id="history-panel">History Panel</h4>

    <p>With the <em>Metric Panel</em> and <em>Feature Panel</em>, GAM Changer helps you identify and envision potential consequences of model edits and make good edits.
      But don’t worry if you have accidentally made a mistake! You can always click the <em>Undo</em> and <em>Redo</em> buttons to revert or re-apply any edits!
      You can also use keyboard shortcuts <kbd>cmd</kbd> + <kbd>z</kbd> (<kbd>ctrl</kbd> on Windows) and <kbd>cmd</kbd> + <kbd>shift</kbd> + <kbd>z</kbd>.
    </p>

    <div class='video'>
      <video autoplay loop muted playsinline class='loop-video'>
        <source src="PUBLIC_URL/video/history.mp4" type="video/mp4">
      </video>
      <div class="figure-caption">
        Figure 6. With GAM Changer, you are safe to explore different editing options, as all edits are reversible.
        GAM Changer keeps track of all your edits in the <em>History Panel</em>, and it automatically generates a short description to help you review edits in the future.
        We strongly recommend you document your edits by typing in the text box; it will help other stakeholders (e.g., colleagues, auditors, users) make sense of your changes.
      </div>
    </div>

    <p>GAM Changer keeps track of all the edits you have made, and it organizes them as a timeline in the <em>History Panel</em> (Figure 6).
      You can also see the <em>timestamp</em>, <em>feature type</em>, <em>feature name</em>, and an automatically generated <em>description</em> of each edit.
      By clicking the <em>Check out</em> button, you can preview the model from a previous version.
      We encourage you to document all edits by typing in the text box.
      You can write the motivations and contexts of your edits; they will become very helpful when you review edits in the future, or share the history with your colleagues.
      Finally, before saving the model (by clicking the <em>Save</em> button on the bottom right), GAM Changer forces you to review and confirm all edits by clicking the <em>Thumbs-up</em> buttons.
      GAM Changer also saves the entire editing history and descriptions so that you can review or continue editing in the future. Again, we hope this design can help you make responsible edits!
    </p>

    <h2 id="video-tutorial">Video Tutorial</h2>

    <ul>
      <li class="video-link" on:click={currentPlayer.play(0)}>
        Introduction
        <small>(0:00-0:16)</small>
      </li>
      <li class="video-link" on:click={currentPlayer.play(16)}>
        <em>Problems revealed by interpretability</em>
        <small>(0:16-0:50)</small>
      </li>
      <li class="video-link" on:click={currentPlayer.play(50)}>
        Introducing <em>GAM Changer</em>
        <small>(0:50-1:07)</small>
      </li>
      <li class="video-link" on:click={currentPlayer.play(67)}>
        Democratizing model editing
        <small>(1:07-1:16)</small>
      </li>
      <li class="video-link" on:click={currentPlayer.play(76)}>
        Navigation
        <small>(1:16-1:31)</small>
      </li>
      <li class="video-link" on:click={currentPlayer.play(91)}>
        Editing categorical variables
        <small>(1:31-1:56)</small>
      </li>
      <li class="video-link" on:click={currentPlayer.play(116)}>
        Editing continuous variables
        <small>(1:56-2:45)</small>
      </li>
      <li class="video-link" on:click={currentPlayer.play(165)}>
        Responsible editing
        <small>(2:45-3:00)</small>
      </li>
      <li class="video-link" on:click={currentPlayer.play(180)}>
        <em>Metric Panel</em>
        <small>(3:00-3:09)</small>
      </li>
      <li class="video-link" on:click={currentPlayer.play(189)}>
        <em>Feature Panel</em>
        <small>(3:09-3:18)</small>
      </li>
      <li class="video-link" on:click={currentPlayer.play(198)}>
        <em>History Panel</em>
        <small>(3:18-3:41)</small>
      </li>
      <li class="video-link" on:click={currentPlayer.play(221)}>
        Contributions
        <small>(3:41-3:55)</small>
      </li>
    </ul>

    <div class="video" style='margin-bottom: 2em;'>
      <Youtube videoId="2gVSoPoSeJ8" playerId="demo_video" bind:this={currentPlayer}/>
    </div>

    <h2 id="how-is-gam-changer-developed">How is <span class='tool-text'>GAM Changer</span> Developed?</h2>
    <p>GAM Changer uses <a href="https://webassembly.org">WebAssembly</a>, a modern web technology to accelerate in-browser computation.
      It enables GAM Changer to run a live EBM model along with isotonic regression and correlation computations directly <strong>in your browser</strong>!
      In other words, the entire app runs locally and privately, and your model and data would not leave your machine.
      The interactive system is written in Javascript using <a href="https://svelte.dev">Svelte</a> as a framework and <a href="https://d3js.org">D3.js</a> for visualizations.
    </p>

    <h2 id="who-developed-gam-changer">Who Developed <span class='tool-text'>GAM Changer</span>?</h2>
    <p>Led by <a href="https://zijie.wang">Jay Wang</a>, GAM Changer started as a research intern project at <a href="https://www.microsoft.com/en-us/research/">Microsoft Research</a>.
      The design is a result of a collaboration between Human-computer Interaction, Visualization, and Machine Learning researchers, data scientists, and doctors.
      GAM Changer is created by <a href="https://zijie.wang">Jay Wang</a>,
      <a href="http://students.washington.edu/kalea/">Alex Kale</a>,
      <a href="https://www.linkedin.com/in/harshanori/">Harsha Nori</a>,
      <a href="https://nyulangone.org/doctors/1548522964/peter-a-stella">Peter Stella</a>,
      <a href="https://nyulangone.org/doctors/1144385360/mark-e-nunnally">Mark Nunnally</a>,
      <a href="https://www.cc.gatech.edu/~dchau/">Polo Chau</a>,
      <a href="https://www.microsoft.com/en-us/research/people/mivorvor/">Mickey Vorvoreanu</a>,
      <a href="http://www.jennwv.com">Jenn Wortman Vaughan</a>,
      and <a href="https://www.microsoft.com/en-us/research/people/rcaruana/">Rich Caruana</a>.
    </p>

    <p>
      We thank <a href="https://scottlundberg.com">Scott Lundberg</a> for insightful conversations.
      We are also grateful to <a href="https://www.microsoft.com/en-us/research/people/sdrucker/">Steven Drucker</a>,
      <a href="https://www.adamfourney.com">Adam Fourney</a>,
      <a href="https://www.microsoft.com/en-us/research/people/samershi/">Saleema Amershi</a>,
      <a href="https://www.linkedin.com/in/deancarignan/">Dean Carignan</a>,
      <a href="https://www.microsoft.com/en-us/research/people/rdeline/">Rob DeLine</a>,
      and the <a href="https://github.com/interpretml/interpret/">InterpretML team</a> for their helpful feedback.
      We appreciate anonymous user study participants for their valuable feedback.
    </p>

    <h2 id="how-can-i-contribute">How Can I Contribute?</h2>
    <p>
      If you have any questions or feedback, feel free to <a href='https://github.com/interpretml/interpret/issues'>open an issue</a> or contact <a href="https://zijie.wang">Jay Wang</a>.
    </p>

    <p>
      We’d love to learn more about your experience with GAM Changer!
      If you’d like to share (e.g., why you use GAM Changer, what functions you find most helpful),
      please reach out to <a href="https://zijie.wang">Jay Wang</a>.
    </p>

  </div>

  <div class='article-footer'>
    <div class='footer-main'>

      <div class='footer-logo'>
        <a target="_blank" href="https://www.microsoft.com/en-us/research/">
          <div class="svg-logo icon-ms" title="Microsoft Research">
          </div>
        </a>

        <a target="_blank" href="https://www.gatech.edu/">
          <div class="svg-logo icon-gt" title="Georgia Tech">
          </div>
        </a>

        <a target="_blank" href="https://www.washington.edu/">
          <div class="svg-logo icon-uw" title="University of Washington">
          </div>
        </a>

        <a target="_blank" href="https://nyulangone.org/">
          <div class="svg-logo icon-nyu" title="NYU Langone Health">
          </div>
        </a>
      </div>

      <div class='footer-cp'>
        <div>Copyright © {new Date().getFullYear()} Microsoft</div>
        <div>All rights reserved</div>
      </div>

    </div>

  </div>

</div>