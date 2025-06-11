import { dirname } from 'node:path'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		coverage: {
			provider: 'istanbul', // or 'v8'
			reporter: ['text', 'json', 'html'],
		},
	},
	resolve: {
		alias: [
			{ find: '@', replacement: resolve(__dirname, './src') },
			{ find: '~', replacement: resolve(__dirname, './src') },
		],
	},
})
