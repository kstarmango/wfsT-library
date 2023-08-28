import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
// import nodePolyfills from 'rollup-plugin-polyfill-node';

const production = !process.env.ROLLUP_WATCH;

export default {
	input: 'src/main.js',
	output: {
		file: 'public/bundle.js',
		format: 'es', // immediately-invoked function expression — suitable for <script> tags
		sourcemap: true,
		external: [
			'ol',
			'jsts',
			'ol-rotate-feature',
			'@turf/turf',
			// 외부 라이브러리 처리는 여기에 절대 dev dependency에 처리하지 말자 제발!!!!!
		]
	},
	plugins: [
		resolve(), // tells Rollup how to find date-fns in node_modules
		commonjs({ // CommonJS 로 작성된 모듈들을 ES6 바꾸어서 rollup이 해석할 수 있게 도와줍니다.
			extensions: ['.js'],
		}), // converts date-fns to ES modules
		production && terser(), // minify, but only in production
		peerDepsExternal(),
		// nodePolyfills({
		// 	include : ['ol/util'],
		// }), 
		// events, util 과 같은 파일, dependency troubleshooting
		// 소용 없어서 주석처리 함
	]
};

// `npm run build` -> `production` is true
// `npm run dev` -> `production` is false