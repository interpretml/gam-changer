import svelte from 'rollup-plugin-svelte';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';
import preprocess from 'svelte-preprocess';
import inlineSvg from 'rollup-plugin-inline-svg';

export default {
  input: 'src/main-widget.js',
  output: {
    sourcemap: false,
    format: 'umd',
    name: 'app',
    file: 'notebook-widget/gamchanger/gamchanger.js'
  },
  plugins: [
    inlineSvg({
      removeTags: false,
      removingTags: ['title', 'desc', 'defs', 'style']
    }),
    svelte({
      compilerOptions: {
        // enable run-time checks when not in production
        dev: false,
      },
      preprocess: preprocess(),
      // Bundle CSS into JS for notebook target
      emitCss: false
    }),

    // If you have external dependencies installed from
    // npm, you'll most likely need these plugins. In
    // some cases you'll need additional configuration -
    // consult the documentation for details:
    // https://github.com/rollup/plugins/tree/master/packages/commonjs
    resolve({
      browser: true,
      dedupe: ['svelte']
    }),
    commonjs(),

    // If we're building for production (npm run build
    // instead of npm run dev), minify
    terser()
  ],
};
