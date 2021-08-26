import NotebookWidget from './NotebookWidget.svelte';

console.log(123);

const app = new NotebookWidget({
  target: document.body,
  props: {
  }
});

export default app;