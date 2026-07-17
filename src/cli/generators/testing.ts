import fs from 'fs-extra'
import path from 'node:path'
import type { ProjectConfig } from '../commands/setup.js'

export async function generateTestingConfigs(config: ProjectConfig, targetDir: string) {
	if (config.testing.framework === 'vitest') {
		await generateVitestConfig(config, targetDir)
	} else if (config.testing.framework === 'jest') {
		await generateJestConfig(config, targetDir)
	} else if (config.testing.framework === 'playwright') {
		await generatePlaywrightConfig(targetDir)
	} else if (config.testing.framework === 'cypress') {
		await generateCypressConfig(targetDir)
	}
}

export async function generateVitestConfig(config: ProjectConfig, targetDir: string) {
	const vitestConfigPath = path.join(targetDir, 'vitest.config.ts')

	const vitestConfig = `import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: '${config.testing.environment === 'browser' ? 'jsdom' : 'node'}',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      // lcov feeds Codecov; text is the local console summary.
      reporter: ['text', 'lcov']
    }
  }
})
`

	await fs.writeFile(vitestConfigPath, vitestConfig)

	// Create setup file
	const setupPath = path.join(targetDir, 'vitest.setup.ts')
	const setupContent = `// Vitest setup file
// Add global test setup here
`
	await fs.writeFile(setupPath, setupContent)
}

async function generateJestConfig(config: ProjectConfig, targetDir: string) {
	const jestConfigPath = path.join(targetDir, 'jest.config.mjs')

	const environment = config.testing.environment === 'browser' ? 'browser' : 'node'

	const jestConfig = `export { default } from '@rtorcato/js-tooling/jest-presets/${environment}/jest-preset'
`

	await fs.writeFile(jestConfigPath, jestConfig)
}

export async function generatePlaywrightConfig(targetDir: string) {
	const playwrightConfigPath = path.join(targetDir, 'playwright.config.ts')
	const playwrightConfig = `export { default } from '@rtorcato/js-tooling/playwright'
`
	await fs.writeFile(playwrightConfigPath, playwrightConfig)
}

const CYPRESS_EXAMPLE_SPEC = `describe('example', () => {
  it('loads the app', () => {
    cy.visit('/')
  })
})
`

/**
 * Scaffolds cypress.config.ts (a re-export of the shipped preset) plus the
 * tests/e2e + cypress/support boilerplate. The config re-export is regenerated
 * every run (idempotent); boilerplate/specs are only created when absent, so
 * real tests are never clobbered. Returns the relative paths written.
 */
export async function generateCypressConfig(targetDir: string): Promise<string[]> {
	const written: string[] = []
	await fs.writeFile(
		path.join(targetDir, 'cypress.config.ts'),
		`export { default } from '@rtorcato/js-tooling/cypress'\n`
	)
	written.push('cypress.config.ts')

	const boilerplate: Array<[string, string]> = [
		['cypress/support/e2e.ts', `import './commands'\n`],
		[
			'cypress/support/commands.ts',
			`// Add custom commands via Cypress.Commands.add(...).\nexport {}\n`,
		],
		['tests/e2e/example.cy.ts', CYPRESS_EXAMPLE_SPEC],
	]
	for (const [rel, content] of boilerplate) {
		const filePath = path.join(targetDir, rel)
		if (await fs.pathExists(filePath)) continue
		await fs.ensureDir(path.dirname(filePath))
		await fs.writeFile(filePath, content)
		written.push(rel)
	}
	return written
}
