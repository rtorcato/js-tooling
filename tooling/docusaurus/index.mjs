/**
 * Build one `docusaurus-plugin-typedoc` instance per subpath module, each
 * generating `docs/api/<id>/index.md` from that module's source JSDoc.
 *
 * Centralises the TypeDoc wiring the @rtorcato/* docs sites share. The
 * consuming docs app must have `docusaurus-plugin-typedoc`, `typedoc` and
 * `typedoc-plugin-markdown` installed.
 *
 * @param {string[]} modules - module ids, e.g. ['errors', 'env', 'kv']
 * @param {object} [options]
 * @param {string} [options.srcDir] - dir holding `<id>/index.ts`, relative to the docs app. Default '../../src'.
 * @param {string} [options.tsconfig] - tsconfig for TypeDoc, relative to the docs app. Default '../../tsconfig.json'.
 * @param {object} [options.overrides] - extra plugin options merged into every instance.
 * @returns {Array<[string, object]>} docusaurus plugin tuples to spread into `plugins`.
 */
export const getTypedocPlugins = (modules, options = {}) => {
	const { srcDir = '../../src', tsconfig = '../../tsconfig.json', overrides = {} } = options
	return modules.map((id) => [
		'docusaurus-plugin-typedoc',
		{
			id,
			entryPoints: [`${srcDir}/${id}/index.ts`],
			tsconfig,
			// The library typechecks on its own toolchain; the docs workspace may
			// pin a different TS. Skip TypeDoc's redundant semantic check.
			skipErrorChecking: true,
			out: `docs/api/${id}`,
			readme: 'none',
			includeVersion: false,
			excludePrivate: true,
			excludeInternal: true,
			excludeExternals: true,
			sort: ['source-order'],
			outputFileStrategy: 'modules',
			...overrides,
		},
	])
}
