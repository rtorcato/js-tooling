export interface SsrSafetyTestOptions {
	/** Absolute path to the source directory. */
	srcDir: string
	/** Folder names under `srcDir` to skip (e.g., `'tests'`, `'common'`). */
	excludeDirs?: string[]
	/** Entry filename inside each folder. Default: `'index.ts'`. */
	moduleEntry?: string
}

/**
 * Asserts that every module folder under `srcDir` can be imported in a Node
 * environment without throwing. Call from a Vitest test file.
 */
export function runSsrSafetyTest(options: SsrSafetyTestOptions): void
