<script>

  export let sidebarStore;

  let sidebarInfo = {};

  sidebarStore.subscribe(value => {
    sidebarInfo = value;
  });

</script>

<style type='text/scss'>

  @import '../define';

  .metrics-tab {
    height: 100%;
  }

  .metrics {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

</style>

<div class='metrics-tab'>

  <div class='metrics'>
    <div>
      {sidebarInfo.accuracy}
    </div>
  </div>

</div>