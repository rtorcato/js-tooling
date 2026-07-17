import type { RolldownOptions } from 'rolldown'

export interface GetConfigOptions {
	/** Library entry point. Default: `src/index.ts`. */
	input?: string
	/** Output directory for the bundle. Default: `dist`. */
	outDir?: string
	/** Emit sourcemaps. Default: `true`. */
	sourcemap?: boolean
	/** Which ids to leave external. Default: every bare (non-relative) import. */
	external?: RolldownOptions['external']
}

/** Build the ESM + CJS Rolldown config for a TypeScript library. */
export declare function getConfig(options?: GetConfigOptions): RolldownOptions

declare const config: RolldownOptions
export default config
