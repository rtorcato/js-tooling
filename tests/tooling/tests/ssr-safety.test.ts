import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe } from 'vitest'
import { runSsrSafetyTest } from '../../../tooling/tests/ssr-safety.mjs'

describe('ssr-safety helper', () => {
	describe('passing scenario: every module imports cleanly under node', () => {
		const root = mkdtempSync(join(tmpdir(), 'jt-ssr-pass-'))
		mkdirSync(join(root, 'foo'), { recursive: true })
		mkdirSync(join(root, 'bar'), { recursive: true })
		writeFileSync(join(root, 'foo/index.mjs'), 'export const x = 1\n')
		writeFileSync(
			join(root, 'bar/index.mjs'),
			`if (typeof window !== 'undefined') throw new Error('not safe')
export const y = 2
`
		)
		afterAll(() => {
			rmSync(root, { recursive: true, force: true })
		})

		runSsrSafetyTest({ srcDir: root, moduleEntry: 'index.mjs' })
	})

	describe('respects excludeDirs', () => {
		const root = mkdtempSync(join(tmpdir(), 'jt-ssr-exclude-'))
		mkdirSync(join(root, 'real'), { recursive: true })
		mkdirSync(join(root, 'tests'), { recursive: true })
		writeFileSync(join(root, 'real/index.mjs'), 'export const x = 1\n')
		afterAll(() => {
			rmSync(root, { recursive: true, force: true })
		})

		runSsrSafetyTest({ srcDir: root, excludeDirs: ['tests'], moduleEntry: 'index.mjs' })
	})
})
