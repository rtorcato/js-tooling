import { join } from 'node:path'
import fs from 'fs-extra'
import { describe, expect, it } from 'vitest'
import type { ProjectConfig } from '../../../src/cli/commands/setup.js'
import { generateGitLabCI } from '../../../src/cli/generators/gitlab-ci.js'
import { useTmpDir } from '../../helpers/tmp-dir.js'

const newTmpDir = useTmpDir()

function baseConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
	return {
		projectName: 'demo',
		projectType: 'library',
		typescript: { enabled: true, config: 'base' },
		linting: { tool: 'biome' },
		formatting: { tool: 'biome' },
		testing: { framework: 'vitest', environment: 'node' },
		gitHooks: true,
		commitLint: true,
		semanticRelease: false,
		securityAutomation: false,
		bundler: 'tsup',
		...overrides,
	}
}

describe('generateGitLabCI', () => {
	it('writes .gitlab-ci.yml with lint/typecheck/test/build for a full library config', async () => {
		const dir = newTmpDir()
		await generateGitLabCI(baseConfig(), dir)
		const yaml = await fs.readFile(join(dir, '.gitlab-ci.yml'), 'utf-8')
		expect(yaml).toMatch(/^lint:$/m)
		expect(yaml).toMatch(/^typecheck:$/m)
		expect(yaml).toMatch(/^test:$/m)
		expect(yaml).toMatch(/^build:$/m)
		expect(yaml).toContain('pnpm check')
		expect(yaml).toContain('pnpm exec vitest run')
		expect(yaml).toContain('pnpm install --frozen-lockfile')
	})

	it('emits pnpm lint when linting tool is eslint', async () => {
		const dir = newTmpDir()
		await generateGitLabCI(baseConfig({ linting: { tool: 'eslint' } }), dir)
		const yaml = await fs.readFile(join(dir, '.gitlab-ci.yml'), 'utf-8')
		expect(yaml).toContain('pnpm lint')
		expect(yaml).not.toContain('pnpm check')
	})

	it('omits typecheck stage when TypeScript is disabled', async () => {
		const dir = newTmpDir()
		await generateGitLabCI(
			baseConfig({ typescript: { enabled: false, config: 'base' } }),
			dir
		)
		const yaml = await fs.readFile(join(dir, '.gitlab-ci.yml'), 'utf-8')
		expect(yaml).not.toMatch(/^typecheck:/m)
	})

	it('omits build stage when bundler is none', async () => {
		const dir = newTmpDir()
		await generateGitLabCI(baseConfig({ bundler: 'none' }), dir)
		const yaml = await fs.readFile(join(dir, '.gitlab-ci.yml'), 'utf-8')
		expect(yaml).not.toMatch(/^build:/m)
		expect(yaml).not.toContain('pnpm build')
	})

	it('uses pnpm test:e2e for playwright projects', async () => {
		const dir = newTmpDir()
		await generateGitLabCI(baseConfig({ testing: { framework: 'playwright' } }), dir)
		const yaml = await fs.readFile(join(dir, '.gitlab-ci.yml'), 'utf-8')
		expect(yaml).toContain('pnpm test:e2e')
	})

	it('uses pnpm test:e2e for cypress projects', async () => {
		const dir = newTmpDir()
		await generateGitLabCI(baseConfig({ testing: { framework: 'cypress' } }), dir)
		const yaml = await fs.readFile(join(dir, '.gitlab-ci.yml'), 'utf-8')
		expect(yaml).toContain('pnpm test:e2e')
	})
})
