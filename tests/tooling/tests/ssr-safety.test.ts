import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { runSsrSafetyTest } from '../../../tooling/tests/ssr-safety.mjs'

describe('ssr-safety helper', () => {
	describe('passing scenario: every module imports cleanly under node', () => {
		let root: string

		beforeAll(() => {
			root = mkdtempSync(join(tmpdir(), 'jt-ssr-pass-'))
			mkdirSync(join(root, 'foo'), { recursive: true })
			mkdirSync(join(root, 'bar'), { recursive: true })
			// Plain .mjs files; ssr-safety helper accepts moduleEntry override.
			writeFileSync(join(root, 'foo/index.mjs'), 'export const x = 1\n')
			writeFileSync(
				join(root, 'bar/index.mjs'),
				`if (typeof window !== 'undefined') throw new Error('not safe')
export const y = 2
`
			)
		})

		afterAll(() => {
			rmSync(root, { recursive: true, force: true })
		})

		it('imports both modules without throwing', () => {
			runSsrSafetyTest({
				srcDir: root,
				moduleEntry: 'index.mjs',
			})
		})
	})

	it('respects excludeDirs', () => {
		const root = mkdtempSync(join(tmpdir(), 'jt-ssr-exclude-'))
		mkdirSync(join(root, 'real'), { recursive: true })
		mkdirSync(join(root, 'tests'), { recursive: true })
		writeFileSync(join(root, 'real/index.mjs'), 'export const x = 1\n')
		// tests/ has no entry file — would explode if visited.

		runSsrSafetyTest({
			srcDir: root,
			excludeDirs: ['tests'],
			moduleEntry: 'index.mjs',
		})

		rmSync(root, { recursive: true, force: true })
	})
})
