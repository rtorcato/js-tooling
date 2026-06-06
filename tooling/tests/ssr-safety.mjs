import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Asserts that every module folder under `srcDir` can be imported in a Node
 * environment without throwing (no DOM, no `window`, no `document`).
 *
 * For each folder under `srcDir` (excluding `excludeDirs`), the helper resolves
 * `<srcDir>/<name>/<moduleEntry>` and `await import(...)` it. If the import
 * throws or the module accesses a missing global at top level, the test fails.
 *
 * Use this as a contract test for libraries that promise SSR safety — i.e., that
 * importing a module is always safe even when its underlying API isn't available.
 *
 * @example
 * ```ts
 * // src/tests/ssr-safety.test.ts (run with vitest --environment node)
 * import { fileURLToPath } from 'node:url'
 * import { runSsrSafetyTest } from '@rtorcato/js-tooling/tests/ssr-safety'
 *
 * runSsrSafetyTest({
 * 	srcDir: fileURLToPath(new URL('../', import.meta.url)),
 * 	excludeDirs: ['tests'],
 * })
 * ```
 *
 * @param {object} options
 * @param {string} options.srcDir Absolute path to the source folder.
 * @param {string[]} [options.excludeDirs] Folder names under `srcDir` to skip.
 * @param {string} [options.moduleEntry] Entry filename inside each folder. Default: `'index.ts'`.
 */
export function runSsrSafetyTest({ srcDir, excludeDirs = [], moduleEntry = 'index.ts' }) {
	const excluded = new Set(excludeDirs)
	const moduleDirs = readdirSync(srcDir, { withFileTypes: true })
		.filter((d) => d.isDirectory() && !excluded.has(d.name))
		.map((d) => d.name)
		.sort()

	describe('SSR safety', () => {
		it('has at least one module', () => {
			expect(moduleDirs.length).toBeGreaterThan(0)
		})

		for (const dir of moduleDirs) {
			it(`imports ./${dir}/${moduleEntry} without throwing`, async () => {
				const moduleUrl = pathToFileURL(join(srcDir, dir, moduleEntry)).href
				await expect(import(moduleUrl)).resolves.toBeDefined()
			})
		}
	})
}
