export interface ExportsResolutionTestOptions {
	/** Absolute path to the package.json whose `exports` map will be validated. */
	packageJsonPath: string
	/** Absolute path to the source directory whose subfolders are cross-checked. */
	srcDir: string
	/** Folder names under `srcDir` to skip (e.g., `'tests'`, `'common'`). */
	excludeDirs?: string[]
}

/**
 * Asserts that a package.json `exports` map stays in sync with its source folders.
 * Call from a Vitest test file; generates one describe block plus one it per folder.
 */
export function runExportsResolutionTest(options: ExportsResolutionTestOptions): void
