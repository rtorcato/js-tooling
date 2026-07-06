import typescript from '@rollup/plugin-typescript'

/**
 * Rollup config factory for TypeScript libraries.
 *
 * Mirrors the tsup preset: unbundled per-file output (`preserveModules`),
 * dual ESM + CJS, `.d.ts` declarations emitted once from the ESM pass, and
 * every bare import left external so dependencies aren't inlined.
 *
 * Consumers scaffold a `rollup.config.mjs` that re-exports the default:
 *
 *   export { default } from '@rtorcato/js-tooling/rollup'
 *
 * …or customize the entry / output:
 *
 *   import { getConfig } from '@rtorcato/js-tooling/rollup'
 *   export default getConfig({ input: 'src/main.ts' })
 *
 * @param {import('./rollup.config.d.mts').GetConfigOptions} [options]
 */
export function getConfig(options = {}) {
	const {
		input = 'src/index.ts',
		outDir = 'dist',
		sourcemap = true,
		external = isBareImport,
		tsconfig = './tsconfig.json',
	} = options

	// Declarations are emitted once, from the ESM pass — plugin-typescript
	// requires declarationDir to sit inside the output dir, and running it in
	// both passes would double-write the same .d.ts files.
	const esm = {
		input,
		external,
		output: {
			dir: outDir,
			format: 'es',
			entryFileNames: '[name].mjs',
			preserveModules: true,
			sourcemap,
		},
		plugins: [typescript({ tsconfig, declaration: true, declarationDir: outDir, rootDir: 'src' })],
	}

	const cjs = {
		input,
		external,
		output: {
			dir: outDir,
			format: 'cjs',
			entryFileNames: '[name].cjs',
			preserveModules: true,
			exports: 'named',
			sourcemap,
		},
		plugins: [typescript({ tsconfig, declaration: false })],
	}

	return [esm, cjs]
}

// Treat every non-relative, non-absolute id as an external dependency so the
// library ships thin and deps resolve from the consumer's node_modules.
// (`\0`-prefixed ids are Rollup's virtual modules — never externalize those.)
function isBareImport(id) {
	return !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0')
}

export default getConfig()
