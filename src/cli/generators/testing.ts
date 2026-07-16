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

// The re-export config is deterministic and always (re)written; the support
// boilerplate and starter spec are safe-add so re-running never clobbers a
// user's custom commands or tests. Returns the files that were written.
export async function generateCypressConfig(targetDir: string): Promise<string[]> {
	const written = ['cypress.config.ts']
	await fs.writeFile(
		path.join(targetDir, 'cypress.config.ts'),
		`export { default } from '@rtorcato/js-tooling/cypress'
`
	)

	// Support boilerplate: e2e.ts is loaded before every spec and pulls in custom
	// commands (Cypress convention).
	await fs.ensureDir(path.join(targetDir, 'cypress', 'support'))
	const boilerplate: Array<[string, string]> = [
		[
			'cypress/support/e2e.ts',
			`// Loaded automatically before each E2E spec. Add global hooks here.
import './commands'
`,
		],
		[
			'cypress/support/commands.ts',
			`// Register custom Cypress commands here, e.g.:
// Cypress.Commands.add('login', (email, password) => { /* ... */ })
export {}
`,
		],
		[
			// Starter spec under the shared tests/e2e folder.
			'tests/e2e/example.cy.ts',
			`describe('example', () => {
	it('loads the home page', () => {
		cy.visit('/')
	})
})
`,
		],
	]
	for (const [rel, content] of boilerplate) {
		const dest = path.join(targetDir, rel)
		if (await fs.pathExists(dest)) continue
		await fs.ensureDir(path.dirname(dest))
		await fs.writeFile(dest, content)
		written.push(rel)
	}
	return written
}
