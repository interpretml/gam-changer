<script>

  import { chiCdf } from './chi2';

  console.log(chiCdf(5, 10));

</script>

<style type='text/scss'>

  @import '../define';

  .feature-tab {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .feature {
    height: 100%;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .scope-selection {
    margin-top: 15px;
    margin-bottom: 5px;
  }

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
  }

</style>

<div class='feature-tab'>

  <div class='scope-selection field has-addons'>

    <div class='control'>
      <button class='button' title='show continuous variables'>
        <span class='is-small'>
          Continuous
        </span>
      </button>
    </div>

    <div class='control'>
      <button class='button' title='show categorical variables'>
        <span class='is-small'>
          Categorical
        </span>
      </button>
    </div>

  </div>

  <div class='feature'>
    <div>
      Coming soon!
    </div>
  </div>

</div>