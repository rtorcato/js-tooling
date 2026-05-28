import fs from 'fs-extra'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { evaluateNodeVersion, runDoctor, summarize } from '../../../src/cli/commands/doctor.js'
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

describe('evaluateNodeVersion', () => {
	it('reports missing when Node major is below the minimum', () => {
		const result = evaluateNodeVersion('v20.10.0')
		expect(result.status).toBe('missing')
		expect(result.hint).toMatch(/nodejs\.org/)
	})

	it('reports drift on Node 22 below the LTS patch', () => {
		const result = evaluateNodeVersion('v22.10.0')
		expect(result.status).toBe('drift')
		expect(result.hint).toMatch(/22\.22\.2/)
	})

	it('reports drift on Node 24 below the LTS patch', () => {
		const result = evaluateNodeVersion('v24.14.1')
		expect(result.status).toBe('drift')
		expect(result.hint).toMatch(/24\.15\.0/)
	})

	it('reports ok on Node 22.22.2 and 24.15.0+', () => {
		expect(evaluateNodeVersion('v22.22.2').status).toBe('ok')
		expect(evaluateNodeVersion('v24.15.0').status).toBe('ok')
		expect(evaluateNodeVersion('v24.20.0').status).toBe('ok')
	})

	it('reports ok on Node 26+ without LTS patch requirements', () => {
		expect(evaluateNodeVersion('v26.0.0').status).toBe('ok')
		expect(evaluateNodeVersion('v28.5.1').status).toBe('ok')
	})

	it('tolerates pre-release suffixes', () => {
		const result = evaluateNodeVersion('v22.22.2-rc.1')
		expect(result.status).toBe('ok')
	})
})

describe('doctor extended checks', () => {
	it('reports drift when engines.node is missing', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		const results = await runDoctor(dir)
		const engines = results.find((r) => r.check === 'engines.node')
		expect(engines?.status).toBe('drift')
		expect(engines?.hint).toMatch(/engines/)
	})

	it('reports ok when engines.node is set', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			engines: { node: '>=22' },
		})
		const results = await runDoctor(dir)
		const engines = results.find((r) => r.check === 'engines.node')
		expect(engines?.status).toBe('ok')
	})

	it('detects .editorconfig and .nvmrc presence', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.writeFile(join(dir, '.editorconfig'), 'root = true\n')
		await fs.writeFile(join(dir, '.nvmrc'), '22\n')
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'EditorConfig')?.status).toBe('ok')
		expect(results.find((r) => r.check === 'Node version pin')?.status).toBe('ok')
	})

	it('reports husky drift when .husky/ exists without prepare script', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.ensureDir(join(dir, '.husky'))
		const results = await runDoctor(dir)
		const husky = results.find((r) => r.check === 'Husky')
		expect(husky?.status).toBe('drift')
	})

	it('reports husky ok when both .husky/ and prepare script exist', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			scripts: { prepare: 'husky' },
		})
		await fs.ensureDir(join(dir, '.husky'))
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'Husky')?.status).toBe('ok')
	})

	it('detects lint-staged in package.json', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			'lint-staged': { '*.ts': 'biome check' },
		})
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'lint-staged')?.status).toBe('ok')
	})

	it('detects knip config field', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			knip: { entry: ['src/index.ts'] },
		})
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'knip')?.status).toBe('ok')
	})

	it('skips semantic-release on private packages', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			private: true,
		})
		const results = await runDoctor(dir)
		const sr = results.find((r) => r.check === 'semantic-release')
		expect(sr?.status).toBe('optional-missing')
	})

	it('flags semantic-release drift on publishable packages without config', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		const results = await runDoctor(dir)
		const sr = results.find((r) => r.check === 'semantic-release')
		expect(sr?.status).toBe('drift')
		expect(sr?.hint).toMatch(/semantic-release/)
	})

	it('reports semantic-release ok when release config extends our preset', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.writeFile(
			join(dir, 'release.config.mjs'),
			"export { default } from '@rtorcato/js-tooling/semantic-release/github'\n"
		)
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'semantic-release')?.status).toBe('ok')
	})

	it('detects GitHub Actions workflows', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.ensureDir(join(dir, '.github', 'workflows'))
		await fs.writeFile(join(dir, '.github', 'workflows', 'ci.yml'), 'name: ci\n')
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'GitHub Actions')?.status).toBe('ok')
	})

	it('detects GitLab CI configuration', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.writeFile(join(dir, '.gitlab-ci.yml'), 'stages: []\n')
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'GitLab CI')?.status).toBe('ok')
	})
})
