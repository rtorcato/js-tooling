import fs from 'fs-extra'
import path from 'path'
import type { ProjectConfig } from '../commands/setup.js'

export async function generateTestingConfigs(config: ProjectConfig, targetDir: string) {
	if (config.testing.framework === 'vitest') {
		await generateVitestConfig(config, targetDir)
	} else if (config.testing.framework === 'jest') {
		await generateJestConfig(config, targetDir)
	} else if (config.testing.framework === 'playwright') {
		await generatePlaywrightConfig(targetDir)
	}
}

async function generateVitestConfig(config: ProjectConfig, targetDir: string) {
	const vitestConfigPath = path.join(targetDir, 'vitest.config.ts')

	const vitestConfig = `import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: '${config.testing.environment === 'browser' ? 'jsdom' : 'node'}',
    setupFiles: ['./vitest.setup.ts']
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

async function generatePlaywrightConfig(targetDir: string) {
	const playwrightConfigPath = path.join(targetDir, 'playwright.config.ts')

	const playwrightConfig = `import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
`

	await fs.writeFile(playwrightConfigPath, playwrightConfig)
}
