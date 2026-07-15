import { join } from 'node:path'
import fs from 'fs-extra'
import { describe, expect, it } from 'vitest'
import { detectLanguage } from '../../../src/cli/utils/detect-language.js'
import { useTmpDir } from '../../helpers/tmp-dir.js'

const newTmpDir = useTmpDir()

describe('detectLanguage', () => {
	it('returns unknown for a bare dir with no marker files', async () => {
		expect(await detectLanguage(newTmpDir())).toBe('unknown')
	})

	it.each([
		['package.json', 'js'],
		['Package.swift', 'swift'],
		['cpanfile', 'perl'],
		['Makefile.PL', 'perl'],
		['dist.ini', 'perl'],
		['pyproject.toml', 'python'],
		['setup.py', 'python'],
	])('resolves %s to %s', async (marker, expected) => {
		const dir = newTmpDir()
		await fs.writeFile(join(dir, marker), '')
		expect(await detectLanguage(dir)).toBe(expected)
	})

	it('prefers js when package.json coexists with another marker (first match wins)', async () => {
		const dir = newTmpDir()
		await fs.writeFile(join(dir, 'package.json'), '{}')
		await fs.writeFile(join(dir, 'pyproject.toml'), '')
		expect(await detectLanguage(dir)).toBe('js')
	})
})
