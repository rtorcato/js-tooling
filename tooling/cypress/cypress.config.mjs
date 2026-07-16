import { defineConfig } from 'cypress'

export default defineConfig({
	e2e: {
		baseUrl: process.env.CYPRESS_BASE_URL ?? 'http://localhost:3000',
		// Specs live alongside Playwright's `tests/e2e` convention so switching
		// E2E runners doesn't move the test folder.
		specPattern: 'tests/e2e/**/*.cy.{js,jsx,ts,tsx}',
		supportFile: 'cypress/support/e2e.ts',
		video: false,
	},
})
