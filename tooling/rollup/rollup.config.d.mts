import type { RollupOptions } from 'rollup'

export interface GetConfigOptions {
	/** Library entry point. Default: `src/index.ts`. */
	input?: string
	/** Output directory for JS + declarations. Default: `dist`. */
	outDir?: string
	/** Emit sourcemaps. Default: `true`. */
	sourcemap?: boolean
	/** Which ids to leave external. Default: every bare (non-relative) import. */
	external?: RollupOptions['external']
	/** Path to the tsconfig plugin-typescript should use. Default: `./tsconfig.json`. */
	tsconfig?: string
}

/** Build the ESM + CJS Rollup configs for a TypeScript library. */
export declare function getConfig(options?: GetConfigOptions): RollupOptions[]

declare const config: RollupOptions[]
export default config
