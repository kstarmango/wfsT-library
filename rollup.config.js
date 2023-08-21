import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';

const production = !process.env.ROLLUP_WATCH;

export default {
	input: 'src/main.js',
	output: {
		file: 'public/bundle.js',
		format: 'es', // immediately-invoked function expression — suitable for <script> tags
		sourcemap: true,
		external: [
			"ol"
		]
	},
	plugins: [
		resolve(), // tells Rollup how to find date-fns in node_modules
		commonjs({ // CommonJS 로 작성된 모듈들을 ES6 바꾸어서 rollup이 해석할 수 있게 도와줍니다.
			extensions: ['.js'],
		}), // converts date-fns to ES modules
		production && terser(), // minify, but only in production
		peerDepsExternal(),
	]
};

// `npm run build` -> `production` is true
// `npm run dev` -> `production` is false