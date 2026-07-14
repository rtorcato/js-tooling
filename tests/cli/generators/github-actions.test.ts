import fs from 'fs-extra'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ProjectConfig } from '../../../src/cli/commands/setup.js'
import { generateGitHubActions } from '../../../src/cli/generators/github-actions.js'
import { useTmpDir } from '../../helpers/tmp-dir.js'

const newTmpDir = useTmpDir()

function baseConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
	return {
		projectName: 'my-lib',
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

const WORKFLOW_PATH = join('.github', 'workflows', 'ci.yml')

describe('generateGitHubActions', () => {
	it('creates .github/workflows/ci.yml', async () => {
		const dir = newTmpDir()
		await generateGitHubActions(baseConfig(), dir)

		expect(await fs.pathExists(join(dir, WORKFLOW_PATH))).toBe(true)
		const content = await fs.readFile(join(dir, WORKFLOW_PATH), 'utf-8')
		expect(content).toContain('CI/CD Pipeline')
		// Read Node from .nvmrc rather than a hardcoded literal — a pinned '20'
		// drifts from engines (>=22) and crashes under pnpm 11 (node:sqlite).
		expect(content).toContain('node-version-file: .nvmrc')
		expect(content).not.toContain("node-version: '20'")
	})

	it('sets up pnpm without a version input (packageManager is the source of truth)', async () => {
		const dir = newTmpDir()
		await generateGitHubActions(baseConfig(), dir)

		const content = await fs.readFile(join(dir, WORKFLOW_PATH), 'utf-8')
		expect(content).toContain('uses: pnpm/action-setup@v6')
		expect(content).not.toContain('version: latest')
	})

	it('adds a publint step to the build job when publint is enabled', async () => {
		const dir = newTmpDir()
		await generateGitHubActions(baseConfig({ bundler: 'tsup', publint: true }), dir)

		const content = await fs.readFile(join(dir, WORKFLOW_PATH), 'utf-8')
		expect(content).toContain('Validate package with publint')
		expect(content).toContain('pnpm exec publint --strict')
	})

	it('omits the publint step when publint is disabled', async () => {
		const dir = newTmpDir()
		await generateGitHubActions(baseConfig({ bundler: 'tsup', publint: false }), dir)

		const content = await fs.readFile(join(dir, WORKFLOW_PATH), 'utf-8')
		expect(content).not.toContain('publint')
	})

	it('includes typecheck job when TypeScript is enabled', async () => {
		const dir = newTmpDir()
		await generateGitHubActions(baseConfig({ typescript: { enabled: true, config: 'base' } }), dir)

		const content = await fs.readFile(join(dir, WORKFLOW_PATH), 'utf-8')
		expect(content).toContain('typecheck:')
		expect(content).toContain('pnpm typecheck')
	})

	it('omits typecheck job when TypeScript is disabled', async () => {
		const dir = newTmpDir()
		await generateGitHubActions(
			baseConfig({ typescript: { enabled: false, config: 'base' } }),
			dir
		)

		const content = await fs.readFile(join(dir, WORKFLOW_PATH), 'utf-8')
		expect(content).not.toContain('typecheck:')
	})

	it('includes test job when a testing framework is configured', async () => {
		const dir = newTmpDir()
		await generateGitHubActions(baseConfig({ testing: { framework: 'vitest' } }), dir)

		const content = await fs.readFile(join(dir, WORKFLOW_PATH), 'utf-8')
		expect(content).toContain('test:')
		expect(content).toContain('pnpm test')
	})

	it('omits test job when testing framework is none', async () => {
		const dir = newTmpDir()
		await generateGitHubActions(baseConfig({ testing: { framework: 'none' } }), dir)

		const content = await fs.readFile(join(dir, WORKFLOW_PATH), 'utf-8')
		expect(content).not.toContain('Run tests')
	})

	it('includes build job when bundler is configured', async () => {
		const dir = newTmpDir()
		await generateGitHubActions(baseConfig({ bundler: 'tsup' }), dir)

		const content = await fs.readFile(join(dir, WORKFLOW_PATH), 'utf-8')
		expect(content).toContain('build:')
		expect(content).toContain('pnpm build')
		expect(content).toContain('upload-artifact')
	})

	it('adds an attw type-resolution step to the build job for libraries', async () => {
		const dir = newTmpDir()
		await generateGitHubActions(baseConfig({ projectType: 'library', bundler: 'tsup' }), dir)

		const content = await fs.readFile(join(dir, WORKFLOW_PATH), 'utf-8')
		expect(content).toContain('are-the-types-wrong')
		expect(content).toContain('pnpm attw')
	})

	it('omits the attw step for non-library projects', async () => {
		const dir = newTmpDir()
		await generateGitHubActions(baseConfig({ projectType: 'react-app', bundler: 'vite' }), dir)

		const content = await fs.readFile(join(dir, WORKFLOW_PATH), 'utf-8')
		expect(content).not.toContain('pnpm attw')
	})

	it('omits build job when bundler is none', async () => {
		const dir = newTmpDir()
		await generateGitHubActions(baseConfig({ bundler: 'none' }), dir)

		const content = await fs.readFile(join(dir, WORKFLOW_PATH), 'utf-8')
		expect(content).not.toContain('Build project')
	})

	it('includes release job for library + semanticRelease', async () => {
		const dir = newTmpDir()
		await generateGitHubActions(
			baseConfig({ projectType: 'library', semanticRelease: true, bundler: 'tsup' }),
			dir
		)

		const content = await fs.readFile(join(dir, WORKFLOW_PATH), 'utf-8')
		expect(content).toContain('release:')
		expect(content).toContain('semantic-release')
		expect(content).toContain('NPM_TOKEN')
	})

	it('omits release job when semanticRelease is false', async () => {
		const dir = newTmpDir()
		await generateGitHubActions(baseConfig({ semanticRelease: false }), dir)

		const content = await fs.readFile(join(dir, WORKFLOW_PATH), 'utf-8')
		expect(content).not.toContain('semantic-release')
	})

	it('uses pnpm check in lint job when linting tool is biome', async () => {
		const dir = newTmpDir()
		await generateGitHubActions(baseConfig({ linting: { tool: 'biome' } }), dir)

		const content = await fs.readFile(join(dir, WORKFLOW_PATH), 'utf-8')
		expect(content).toContain('pnpm check')
	})

	it('uses pnpm lint in lint job when linting tool is eslint', async () => {
		const dir = newTmpDir()
		await generateGitHubActions(
			baseConfig({ linting: { tool: 'eslint', eslintConfig: 'base' } }),
			dir
		)

		const content = await fs.readFile(join(dir, WORKFLOW_PATH), 'utf-8')
		expect(content).toContain('pnpm lint')
	})
})
