import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { runExportsResolutionTest } from '../../../tooling/tests/exports-resolution.mjs'

describe('exports-resolution helper', () => {
	describe('passing scenario: exports map matches src/ folders exactly', () => {
		const root = mkdtempSync(join(tmpdir(), 'jt-exports-pass-'))
		writeFileSync(
			join(root, 'package.json'),
			JSON.stringify({
				name: 'fake-lib',
				exports: {
					'.': './dist/index.js',
					'./foo': './dist/foo/index.js',
					'./bar': './dist/bar/index.js',
				},
			})
		)
		mkdirSync(join(root, 'src/foo'), { recursive: true })
		mkdirSync(join(root, 'src/bar'), { recursive: true })
		afterAll(() => {
			rmSync(root, { recursive: true, force: true })
		})

		runExportsResolutionTest({
			packageJsonPath: join(root, 'package.json'),
			srcDir: join(root, 'src'),
		})
	})

	it('throws when package.json has no exports field', () => {
		const root = mkdtempSync(join(tmpdir(), 'jt-exports-noexports-'))
		writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'no-exports' }))
		mkdirSync(join(root, 'src/foo'), { recursive: true })

		expect(() =>
			runExportsResolutionTest({
				packageJsonPath: join(root, 'package.json'),
				srcDir: join(root, 'src'),
			})
		).toThrow(/no exports map/)

		rmSync(root, { recursive: true, force: true })
	})

	describe('respects excludeDirs', () => {
		const root = mkdtempSync(join(tmpdir(), 'jt-exports-exclude-'))
		writeFileSync(
			join(root, 'package.json'),
			JSON.stringify({
				name: 'fake-lib',
				exports: {
					'.': './dist/index.js',
					'./foo': './dist/foo/index.js',
				},
			})
		)
		mkdirSync(join(root, 'src/foo'), { recursive: true })
		mkdirSync(join(root, 'src/tests'), { recursive: true })
		mkdirSync(join(root, 'src/common'), { recursive: true })
		afterAll(() => {
			rmSync(root, { recursive: true, force: true })
		})

		runExportsResolutionTest({
			packageJsonPath: join(root, 'package.json'),
			srcDir: join(root, 'src'),
			excludeDirs: ['tests', 'common'],
		})
	})
})
