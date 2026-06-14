import fs from 'fs-extra'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ProjectConfig } from '../../../src/cli/commands/setup.js'
import { generateLintingConfigs } from '../../../src/cli/generators/linting.js'
import { useTmpDir } from '../../helpers/tmp-dir.js'

const newTmpDir = useTmpDir()

function baseConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
	return {
		projectName: 'demo',
		projectType: 'library',
		typescript: { enabled: true, config: 'base' },
		linting: { tool: 'biome' },
		formatting: { tool: 'biome' },
		testing: { framework: 'none' },
		gitHooks: false,
		commitLint: false,
		semanticRelease: false,
		bundler: 'none',
		...overrides,
	}
}

describe('generateLintingConfigs', () => {
	it('writes biome.jsonc when tool is biome', async () => {
		const dir = newTmpDir()
		await generateLintingConfigs(baseConfig({ linting: { tool: 'biome' } }), dir)

		const biome = await fs.readJson(join(dir, 'biome.jsonc'))
		expect(biome.extends).toEqual(['@rtorcato/js-tooling/biome'])
		expect(await fs.pathExists(join(dir, 'eslint.config.mjs'))).toBe(false)
		expect(await fs.pathExists(join(dir, 'prettier.config.mjs'))).toBe(false)
	})

	it('writes eslint + prettier configs when tool is eslint', async () => {
		const dir = newTmpDir()
		await generateLintingConfigs(
			baseConfig({ linting: { tool: 'eslint', eslintConfig: 'base' } }),
			dir
		)

		const eslint = await fs.readFile(join(dir, 'eslint.config.mjs'), 'utf-8')
		expect(eslint).toContain("from '@rtorcato/js-tooling/eslint/base'")

		expect(await fs.pathExists(join(dir, 'prettier.config.mjs'))).toBe(true)
		expect(await fs.pathExists(join(dir, 'biome.jsonc'))).toBe(false)
	})

	it("writes both configs when tool is 'both' and skips prettier", async () => {
		const dir = newTmpDir()
		await generateLintingConfigs(
			baseConfig({ linting: { tool: 'both', eslintConfig: 'nextjs' } }),
			dir
		)

		const eslint = await fs.readFile(join(dir, 'eslint.config.mjs'), 'utf-8')
		expect(eslint).toContain("from '@rtorcato/js-tooling/eslint/nextjs'")

		expect(await fs.pathExists(join(dir, 'biome.jsonc'))).toBe(true)
		// prettier is only emitted when eslint is the sole linter
		expect(await fs.pathExists(join(dir, 'prettier.config.mjs'))).toBe(false)
	})

	it('defaults eslint config to base when not specified', async () => {
		const dir = newTmpDir()
		await generateLintingConfigs(baseConfig({ linting: { tool: 'eslint' } }), dir)

		const eslint = await fs.readFile(join(dir, 'eslint.config.mjs'), 'utf-8')
		expect(eslint).toContain("from '@rtorcato/js-tooling/eslint/base'")
	})

	it('drops .oxlintrc.json when oxlint is enabled (additive to Biome)', async () => {
		const dir = newTmpDir()
		await generateLintingConfigs(
			baseConfig({ linting: { tool: 'biome' }, oxlint: true }),
			dir
		)

		expect(await fs.pathExists(join(dir, 'biome.jsonc'))).toBe(true)
		const oxlint = await fs.readJson(join(dir, '.oxlintrc.json'))
		expect(oxlint.categories?.correctness).toBe('error')
	})

	it('skips .oxlintrc.json when oxlint flag is unset', async () => {
		const dir = newTmpDir()
		await generateLintingConfigs(baseConfig({ linting: { tool: 'biome' } }), dir)

		expect(await fs.pathExists(join(dir, '.oxlintrc.json'))).toBe(false)
	})
})
