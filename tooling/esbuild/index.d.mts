import type { BuildOptions, BuildResult } from 'esbuild'

export declare function buildCode(
	entryPoints?: string[],
	options?: Partial<BuildOptions>
): Promise<BuildResult | undefined>
