import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Asserts that a package.json `exports` map stays in sync with its source folders.
 *
 * For every folder under `srcDir` (excluding `excludeDirs`), the package.json must
 * expose a matching `./<name>` subpath export. Conversely, every subpath in the
 * `exports` map (other than `.`) must point at a folder that exists in `srcDir`.
 *
 * Call this from a Vitest test file; it generates one `describe` block plus one
 * `it` per folder, so failures pinpoint the drift.
 *
 * @example
 * ```ts
 * // src/tests/exports-resolution.test.ts
 * import { fileURLToPath } from 'node:url'
 * import { runExportsResolutionTest } from '@rtorcato/js-tooling/tests/exports-resolution'
 *
 * runExportsResolutionTest({
 * 	packageJsonPath: fileURLToPath(new URL('../../package.json', import.meta.url)),
 * 	srcDir: fileURLToPath(new URL('../', import.meta.url)),
 * 	excludeDirs: ['tests'],
 * })
 * ```
 *
 * @param {object} options
 * @param {string} options.packageJsonPath Absolute path to the package.json under test.
 * @param {string} options.srcDir Absolute path to the source folder whose subdirectories should be cross-checked.
 * @param {string[]} [options.excludeDirs] Folder names under `srcDir` to skip (e.g., `tests`, `common`).
 */
export function runExportsResolutionTest({ packageJsonPath, srcDir, excludeDirs = [] }) {
	const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

	if (!pkg.exports || typeof pkg.exports !== 'object') {
		throw new Error(`exports-resolution: package.json at ${packageJsonPath} has no exports map`)
	}

	const exportSubpaths = new Set(
		Object.keys(pkg.exports)
			.filter((k) => k !== '.')
			.map((k) => k.replace(/^\.\//, ''))
	)

	const excluded = new Set(excludeDirs)
	const moduleDirs = readdirSync(srcDir, { withFileTypes: true })
		.filter((d) => d.isDirectory() && !excluded.has(d.name))
		.map((d) => d.name)
		.sort()

	describe('package.json exports map', () => {
		it('has at least one module', () => {
			expect(moduleDirs.length).toBeGreaterThan(0)
		})

		for (const dir of moduleDirs) {
			it(`exposes ./${dir}`, () => {
				expect(exportSubpaths.has(dir)).toBe(true)
			})
		}

		it('has no exports entries pointing at missing src/ folders', () => {
			const moduleDirSet = new Set(moduleDirs)
			const orphans = [...exportSubpaths].filter((k) => !moduleDirSet.has(k))
			expect(orphans).toEqual([])
		})
	})
}
