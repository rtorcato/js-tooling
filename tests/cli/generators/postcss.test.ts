import { join } from 'node:path'
import fs from 'fs-extra'
import { describe, expect, it } from 'vitest'
import { generatePostcss } from '../../../src/cli/generators/postcss.js'
import { useTmpDir } from '../../helpers/tmp-dir.js'

const newTmpDir = useTmpDir()

describe('generatePostcss', () => {
	it('writes a postcss.config.mjs with autoprefixer', async () => {
		const dir = newTmpDir()
		const written = await generatePostcss(dir)
		expect(written).toEqual(['postcss.config.mjs'])

		const config = await fs.readFile(join(dir, 'postcss.config.mjs'), 'utf8')
		expect(config).toContain('autoprefixer')
		expect(config).toContain('export default')
	})

	it('is safe-add — never clobbers an existing config (e.g. from fix tailwind)', async () => {
		const dir = newTmpDir()
		await fs.writeFile(join(dir, 'postcss.config.mjs'), '// tailwind\n')
		const written = await generatePostcss(dir)
		expect(written).toEqual([])
		expect(await fs.readFile(join(dir, 'postcss.config.mjs'), 'utf8')).toBe('// tailwind\n')
	})
})
