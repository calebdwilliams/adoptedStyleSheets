const babel = require('rollup-plugin-babel');
const cleanup = require('rollup-plugin-cleanup');
const copy = require('rollup-plugin-copy');
const nodeResolve = require('rollup-plugin-node-resolve');
const injectCode = require('./plugins/rollup-plugin-inject-code');

module.exports = {
  input: 'src/index.js',
  output: {
    file: 'dist/adoptedStyleSheets.js',
    format: 'iife',
    name: 'adoptedStyleSheets',
  },
  plugins: [
    nodeResolve(),
    babel(),
    cleanup({
      comments: 'none',
    }),
    copy({
      targets: [{src: 'src/index.d.ts', dest: 'dist', rename: 'adoptedStyleSheets.d.ts'}]
    }),
    injectCode({
      'adoptedStyleSheets.js': {
        line: 3,
        code: "  if (typeof document === 'undefined' || 'adoptedStyleSheets' in document) { return; }\n",
      }
    }),
  ],
};
