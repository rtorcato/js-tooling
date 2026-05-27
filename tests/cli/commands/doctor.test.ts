import fs from 'fs-extra'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runDoctor, summarize } from '../../../src/cli/commands/doctor.js'
import { useTmpDir } from '../../helpers/tmp-dir.js'

const newTmpDir = useTmpDir()

async function seedPackageJson(dir: string, withDep = true) {
	await fs.writeJson(join(dir, 'package.json'), {
		name: 'demo',
		version: '0.0.0',
		devDependencies: withDep ? { '@rtorcato/js-tooling': '^2.0.0' } : {},
	})
}

describe('doctor', () => {
	it('reports drift when nothing is configured', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir, false)

		const results = await runDoctor(dir)
		const byCheck = new Map(results.map((r) => [r.check, r]))

		expect(byCheck.get('package.json')?.status).toBe('drift')
		expect(byCheck.get('TypeScript')?.status).toBe('missing')
		expect(byCheck.get('Biome')?.status).toBe('optional-missing')
	})

	it('reports ok when tsconfig extends our preset', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.writeJson(join(dir, 'tsconfig.json'), {
			extends: '@rtorcato/js-tooling/typescript/base',
		})

		const results = await runDoctor(dir)
		const ts = results.find((r) => r.check === 'TypeScript')
		expect(ts?.status).toBe('ok')
	})

	it('reports drift when tsconfig exists but does not extend our preset', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.writeJson(join(dir, 'tsconfig.json'), {
			compilerOptions: { strict: true },
		})

		const results = await runDoctor(dir)
		const ts = results.find((r) => r.check === 'TypeScript')
		expect(ts?.status).toBe('drift')
		expect(ts?.hint).toMatch(/tsconfig/)
	})

	it('detects biome.jsonc and eslint configs that import our presets', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.writeFile(
			join(dir, 'biome.jsonc'),
			'{ "extends": ["@rtorcato/js-tooling/biome"] }\n'
		)
		await fs.writeFile(
			join(dir, 'eslint.config.mjs'),
			"export { default } from '@rtorcato/js-tooling/eslint/base'\n"
		)

		const results = await runDoctor(dir)
		const biome = results.find((r) => r.check === 'Biome')
		const eslint = results.find((r) => r.check === 'ESLint')
		expect(biome?.status).toBe('ok')
		expect(eslint?.status).toBe('ok')
	})

	it('summarize tallies statuses correctly', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.writeJson(join(dir, 'tsconfig.json'), {
			extends: '@rtorcato/js-tooling/typescript/base',
		})

		const results = await runDoctor(dir)
		const summary = summarize(results)
		expect(summary.ok).toBeGreaterThanOrEqual(2) // package.json + tsconfig
		expect(summary.missing).toBe(0)
	})

	it('exits with non-zero when drift or missing present', async () => {
		const dir = newTmpDir()
		// no package.json at all
		const results = await runDoctor(dir)
		const summary = summarize(results)
		expect(summary.missing + summary.drift).toBeGreaterThan(0)
	})
})
