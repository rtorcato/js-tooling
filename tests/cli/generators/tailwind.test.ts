import { join } from 'node:path'
import fs from 'fs-extra'
import { describe, expect, it } from 'vitest'
import { runDoctor } from '../../../src/cli/commands/doctor.js'
import { generateTailwind } from '../../../src/cli/generators/tailwind.js'
import { useTmpDir } from '../../helpers/tmp-dir.js'

const newTmpDir = useTmpDir()

describe('generateTailwind', () => {
	it('writes a v4 PostCSS config and CSS entry', async () => {
		const dir = newTmpDir()
		const written = await generateTailwind(dir)
		expect(written).toEqual(['postcss.config.mjs', join('src', 'styles', 'globals.css')])

		const postcss = await fs.readFile(join(dir, 'postcss.config.mjs'), 'utf8')
		expect(postcss).toContain('@tailwindcss/postcss')
		const css = await fs.readFile(join(dir, 'src/styles/globals.css'), 'utf8')
		expect(css).toContain('@import "tailwindcss"')
	})

	it('is safe-add — never clobbers existing files', async () => {
		const dir = newTmpDir()
		await fs.writeFile(join(dir, 'postcss.config.mjs'), '// hand-tuned\n')
		const written = await generateTailwind(dir)
		expect(written).toEqual([join('src', 'styles', 'globals.css')])
		expect(await fs.readFile(join(dir, 'postcss.config.mjs'), 'utf8')).toBe('// hand-tuned\n')
	})
})

describe('doctor Tailwind check', () => {
	const findTailwind = (results: { check: string }[]) => results.find((r) => r.check === 'Tailwind')

	it('does not surface the check when tailwindcss is not a dependency', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), { name: 'demo' })
		expect(findTailwind(await runDoctor(dir))).toBeUndefined()
	})

	it('flags optional-missing when tailwindcss is installed without a plugin', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			devDependencies: { tailwindcss: '^4.0.0' },
		})
		expect(findTailwind(await runDoctor(dir))?.status).toBe('optional-missing')
	})

	it('reports ok once the PostCSS plugin is wired', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			devDependencies: { tailwindcss: '^4.0.0', '@tailwindcss/postcss': '^4.0.0' },
		})
		await generateTailwind(dir)
		expect(findTailwind(await runDoctor(dir))?.status).toBe('ok')
	})

	it('reports ok when the Vite plugin is used instead', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			devDependencies: { tailwindcss: '^4.0.0', '@tailwindcss/vite': '^4.0.0' },
		})
		expect(findTailwind(await runDoctor(dir))?.status).toBe('ok')
	})
})
