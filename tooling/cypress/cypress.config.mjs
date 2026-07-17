import { defineConfig } from 'cypress'

export default defineConfig({
	e2e: {
		baseUrl: process.env.CYPRESS_BASE_URL ?? 'http://localhost:3000',
		specPattern: 'tests/e2e/**/*.cy.{js,jsx,ts,tsx}',
		supportFile: 'cypress/support/e2e.ts',
		video: false,
		retries: { runMode: process.env.CI ? 2 : 0, openMode: 0 },
	},
})
