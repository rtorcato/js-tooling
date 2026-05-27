import fs from 'fs-extra'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ProjectConfig } from '../../../src/cli/commands/setup.js'
import { generateGitConfigs } from '../../../src/cli/generators/git.js'
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
		gitHooks: true,
		commitLint: true,
		semanticRelease: false,
		bundler: 'none',
		...overrides,
	}
}

async function seedPackageJson(dir: string) {
	await fs.writeJson(join(dir, 'package.json'), { name: 'demo', version: '0.0.0' })
}

describe('generateGitConfigs', () => {
	it('writes husky pre-commit and commit-msg hooks plus lint-staged in package.json', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await generateGitConfigs(baseConfig(), dir)

		const preCommit = await fs.readFile(join(dir, '.husky', 'pre-commit'), 'utf-8')
		expect(preCommit).toContain('lint-staged')

		const commitMsg = await fs.readFile(join(dir, '.husky', 'commit-msg'), 'utf-8')
		expect(commitMsg).toContain('commitlint --edit')

		const pkg = await fs.readJson(join(dir, 'package.json'))
		expect(pkg['lint-staged']['*.{js,ts,jsx,tsx}']).toContain('biome check --fix')
	})

	it('skips commit-msg hook when commitLint is disabled', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await generateGitConfigs(baseConfig({ commitLint: false }), dir)

		expect(await fs.pathExists(join(dir, '.husky', 'pre-commit'))).toBe(true)
		expect(await fs.pathExists(join(dir, '.husky', 'commit-msg'))).toBe(false)
		expect(await fs.pathExists(join(dir, 'commitlint.config.mjs'))).toBe(false)
	})

	it('writes commitlint.config.mjs when commitLint is enabled', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await generateGitConfigs(baseConfig(), dir)

		const config = await fs.readFile(join(dir, 'commitlint.config.mjs'), 'utf-8')
		expect(config).toContain('@rtorcato/js-tooling/commitlint/config')
	})

	it('uses eslint + prettier in lint-staged when linting tool is eslint', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await generateGitConfigs(baseConfig({ linting: { tool: 'eslint' } }), dir)

		const pkg = await fs.readJson(join(dir, 'package.json'))
		expect(pkg['lint-staged']['*.{js,ts,jsx,tsx}']).toContain('eslint --fix')
		expect(pkg['lint-staged']['*.{json,md,yml,yaml}']).toContain('prettier --write')
	})

	it('appends framework-specific entries to .gitignore', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await generateGitConfigs(
			baseConfig({
				projectType: 'nextjs-app',
				bundler: 'vite',
				testing: { framework: 'playwright' },
			}),
			dir
		)

		const gitignore = await fs.readFile(join(dir, '.gitignore'), 'utf-8')
		expect(gitignore).toContain('node_modules/')
		expect(gitignore).toContain('.next/')
		expect(gitignore).toContain('.vite/')
		expect(gitignore).toContain('/playwright-report/')
	})
})
