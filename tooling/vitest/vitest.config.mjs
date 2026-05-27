import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			include: ['src/cli/generators/**/*.ts'],
			thresholds: {
				statements: 25,
				lines: 25,
				functions: 40,
				branches: 17,
			},
		},
	},
	resolve: {
		alias: [
			{ find: '@', replacement: resolve(__dirname, './src') },
			{ find: '~', replacement: resolve(__dirname, './src') },
		],
	},
})
