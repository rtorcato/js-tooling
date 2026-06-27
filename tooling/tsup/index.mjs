import { defineConfig } from 'tsup'

export const getConfig = (customOptions, env) => {
	return defineConfig((options = customOptions) => {
		return baseOptions(options, env)
	})
}

export const baseOptions = (options, env) => {
	const opts = {
		treeshake: true,
		splitting: true,
		format: ['cjs', 'esm'], // generate cjs and esm files
		entry: ['src/**/*.ts'],
		skipNodeModulesBundle: true, // Skips building dependencies for node modules
		minify: !options.watch && env === 'production',
		bundle: false,
		clean: true, // clean up the dist folder
		dts: true, // generate dts file for main module
		...options,
	}
	return opts
}
