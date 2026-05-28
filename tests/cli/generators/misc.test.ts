import { join } from 'node:path'
import fs from 'fs-extra'
import { describe, expect, it } from 'vitest'
import {
	ensureEnginesNode,
	generateEditorConfig,
	generateKnipConfig,
	generateMiscBaseline,
	generateNvmrc,
} from '../../../src/cli/generators/misc.js'
import { useTmpDir } from '../../helpers/tmp-dir.js'

const newTmpDir = useTmpDir()

describe('generateEditorConfig', () => {
	it('writes .editorconfig with utf-8 and lf', async () => {
		const dir = newTmpDir()
		await generateEditorConfig(dir)
		const content = await fs.readFile(join(dir, '.editorconfig'), 'utf-8')
		expect(content).toMatch(/charset = utf-8/)
		expect(content).toMatch(/end_of_line = lf/)
		expect(content).toMatch(/root = true/)
	})
})

describe('generateNvmrc', () => {
	it('writes .nvmrc pinned to 22', async () => {
		const dir = newTmpDir()
		await generateNvmrc(dir)
		const content = await fs.readFile(join(dir, '.nvmrc'), 'utf-8')
		expect(content.trim()).toBe('22')
	})
})

describe('ensureEnginesNode', () => {
	it('returns no-package-json when package.json is absent', async () => {
		const dir = newTmpDir()
		const result = await ensureEnginesNode(dir)
		expect(result).toBe('no-package-json')
	})

	it('adds engines.node when missing', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), { name: 'demo', version: '0.0.0' })
		const result = await ensureEnginesNode(dir)
		expect(result).toBe('added')
		const pkg = await fs.readJson(join(dir, 'package.json'))
		expect(pkg.engines).toEqual({ node: '>=22' })
	})

	it('does not overwrite an existing engines.node value', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			engines: { node: '>=24' },
		})
		const result = await ensureEnginesNode(dir)
		expect(result).toBe('already-set')
		const pkg = await fs.readJson(join(dir, 'package.json'))
		expect(pkg.engines.node).toBe('>=24')
	})

	it('preserves other engines fields when adding node', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			engines: { pnpm: '>=8' },
		})
		await ensureEnginesNode(dir)
		const pkg = await fs.readJson(join(dir, 'package.json'))
		expect(pkg.engines).toEqual({ pnpm: '>=8', node: '>=22' })
	})
})

describe('generateKnipConfig', () => {
	it('writes knip.json with default entry and project', async () => {
		const dir = newTmpDir()
		await generateKnipConfig(dir)
		const knip = await fs.readJson(join(dir, 'knip.json'))
		expect(knip.entry).toEqual(['src/index.ts'])
		expect(knip.project).toEqual(['src/**/*.ts'])
	})
})

describe('generateMiscBaseline', () => {
	it('writes all four baseline files', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), { name: 'demo', version: '0.0.0' })
		await generateMiscBaseline(dir)
		expect(await fs.pathExists(join(dir, '.editorconfig'))).toBe(true)
		expect(await fs.pathExists(join(dir, '.nvmrc'))).toBe(true)
		expect(await fs.pathExists(join(dir, 'knip.json'))).toBe(true)
		const pkg = await fs.readJson(join(dir, 'package.json'))
		expect(pkg.engines?.node).toBe('>=22')
	})
})
