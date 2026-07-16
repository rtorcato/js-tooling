import fs from 'fs-extra'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ProjectConfig } from '../../../src/cli/commands/setup.js'
import { generateTestingConfigs } from '../../../src/cli/generators/testing.js'
import { useTmpDir } from '../../helpers/tmp-dir.js'

const newTmpDir = useTmpDir()

function baseConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
	return {
		projectName: 'demo',
		projectType: 'library',
		typescript: { enabled: true, config: 'base' },
		linting: { tool: 'none' },
		formatting: { tool: 'none' },
		testing: { framework: 'none' },
		gitHooks: false,
		commitLint: false,
		semanticRelease: false,
		bundler: 'none',
		...overrides,
	}
}

describe('generateTestingConfigs', () => {
	it('writes vitest config + setup file with node environment by default', async () => {
		const dir = newTmpDir()
		await generateTestingConfigs(baseConfig({ testing: { framework: 'vitest' } }), dir)

		const vitestConfig = await fs.readFile(join(dir, 'vitest.config.ts'), 'utf-8')
		expect(vitestConfig).toContain("environment: 'node'")
		expect(await fs.pathExists(join(dir, 'vitest.setup.ts'))).toBe(true)
	})

	it('uses jsdom environment when browser is requested', async () => {
		const dir = newTmpDir()
		await generateTestingConfigs(
			baseConfig({ testing: { framework: 'vitest', environment: 'browser' } }),
			dir
		)

		const vitestConfig = await fs.readFile(join(dir, 'vitest.config.ts'), 'utf-8')
		expect(vitestConfig).toContain("environment: 'jsdom'")
	})

	it('writes a jest config that re-exports the matching preset', async () => {
		const dir = newTmpDir()
		await generateTestingConfigs(
			baseConfig({ testing: { framework: 'jest', environment: 'browser' } }),
			dir
		)

		const jestConfig = await fs.readFile(join(dir, 'jest.config.mjs'), 'utf-8')
		expect(jestConfig).toContain('@rtorcato/js-tooling/jest-presets/browser/jest-preset')
	})

	it('writes a playwright config that re-exports our preset', async () => {
		const dir = newTmpDir()
		await generateTestingConfigs(baseConfig({ testing: { framework: 'playwright' } }), dir)

		const playwrightConfig = await fs.readFile(join(dir, 'playwright.config.ts'), 'utf-8')
		expect(playwrightConfig).toContain("from '@rtorcato/js-tooling/playwright'")
	})

	it('the shipped playwright preset references defineConfig and devices', async () => {
		const presetPath = join(process.cwd(), 'tooling/playwright/playwright.config.mjs')
		const preset = await fs.readFile(presetPath, 'utf-8')
		expect(preset).toMatch(/from '@playwright\/test'/)
		expect(preset).toMatch(/\bdefineConfig\b/)
		expect(preset).toMatch(/\bdevices\b/)
	})

	it('writes a cypress config + support/spec boilerplate', async () => {
		const dir = newTmpDir()
		await generateTestingConfigs(baseConfig({ testing: { framework: 'cypress' } }), dir)

		const cypressConfig = await fs.readFile(join(dir, 'cypress.config.ts'), 'utf-8')
		expect(cypressConfig).toContain("from '@rtorcato/js-tooling/cypress'")
		expect(await fs.pathExists(join(dir, 'cypress/support/e2e.ts'))).toBe(true)
		expect(await fs.pathExists(join(dir, 'cypress/support/commands.ts'))).toBe(true)
		expect(await fs.pathExists(join(dir, 'tests/e2e/example.cy.ts'))).toBe(true)
	})

	it('cypress fixer is safe-add — never clobbers an existing spec', async () => {
		const dir = newTmpDir()
		await fs.ensureDir(join(dir, 'tests/e2e'))
		await fs.writeFile(join(dir, 'tests/e2e/example.cy.ts'), '// mine\n')
		await generateTestingConfigs(baseConfig({ testing: { framework: 'cypress' } }), dir)
		expect(await fs.readFile(join(dir, 'tests/e2e/example.cy.ts'), 'utf-8')).toBe('// mine\n')
	})

	it('the shipped cypress preset references defineConfig and the e2e block', async () => {
		const preset = await fs.readFile(
			join(process.cwd(), 'tooling/cypress/cypress.config.mjs'),
			'utf-8'
		)
		expect(preset).toMatch(/from 'cypress'/)
		expect(preset).toMatch(/\bdefineConfig\b/)
		expect(preset).toMatch(/tests\/e2e/)
	})

	it('writes nothing when framework is none', async () => {
		const dir = newTmpDir()
		await generateTestingConfigs(baseConfig({ testing: { framework: 'none' } }), dir)

		const entries = await fs.readdir(dir)
		expect(entries).toEqual([])
	})
})
