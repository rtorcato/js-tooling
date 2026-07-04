export interface TypedocPluginsOptions {
	/** Directory holding each module's `<id>/index.ts`, relative to the docs app. Default `../../src`. */
	srcDir?: string
	/** tsconfig passed to TypeDoc, relative to the docs app. Default `../../tsconfig.json`. */
	tsconfig?: string
	/** Extra `docusaurus-plugin-typedoc` options merged into every instance. */
	overrides?: Record<string, unknown>
}

/**
 * Build one `docusaurus-plugin-typedoc` instance per subpath module, each
 * generating `docs/api/<id>/index.md` from that module's source JSDoc.
 *
 * The consuming docs app must have `docusaurus-plugin-typedoc`, `typedoc` and
 * `typedoc-plugin-markdown` installed.
 */
export const getTypedocPlugins = (
	modules: string[],
	options: TypedocPluginsOptions = {}
): Array<[string, Record<string, unknown>]> => {
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
