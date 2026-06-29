export interface TypedocPluginsOptions {
	/** Directory holding each module's `<id>/index.ts`, relative to the docs app. Default `../../src`. */
	srcDir?: string
	/** tsconfig passed to TypeDoc, relative to the docs app. Default `../../tsconfig.json`. */
	tsconfig?: string
	/** Extra `docusaurus-plugin-typedoc` options merged into every instance. */
	overrides?: Record<string, unknown>
}

/**
 * Build one `docusaurus-plugin-typedoc` instance per subpath module. Returns
 * docusaurus plugin tuples to spread into `plugins`.
 */
export declare const getTypedocPlugins: (
	modules: string[],
	options?: TypedocPluginsOptions
) => Array<[string, Record<string, unknown>]>
