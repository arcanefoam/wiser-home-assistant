import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';
import json from '@rollup/plugin-json';
import copy from 'rollup-plugin-copy';

const dev = process.env.ROLLUP_WATCH || process.env.ROLLUP_DEV;

const serveopts = {
  contentBase: ['./dist'],
  host: '0.0.0.0',
  port: 5000,
  allowCrossOrigin: true,
  headers: {
    'Access-Control-Allow-Origin': '*',
  },
};

const plugins = [
  nodeResolve({}),
  commonjs(),
  typescript(),
  json(),
  babel({
    babelHelpers: 'bundled',
    exclude: 'node_modules/**',
  }),
  copy({
    targets: [{ src: 'img', dest: '../dist/www' }],
    verbose: true,
  }),
  !dev && terser(),
];

export default [
  {
    input: 'src/wiser-home-card.ts',
    output: {
      dir: '../dist/www',
      format: 'es',
    },
    plugins: [...plugins],
  },
];
