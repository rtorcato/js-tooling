import base from '@rtorcato/js-tooling/vitest/config'
import react from '@vitejs/plugin-react'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vitest/config'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default mergeConfig(
	base,
	defineConfig({
		plugins: [react()],
		test: {
			environment: 'jsdom',
			include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
			css: true, // ← Vitest will stub every *.css / *.module.css import
			exclude: ['OLD/**'],
			setupFiles: ['./vitest.setup.ts'],
		},
		resolve: {
			alias: [
				{ find: '@', replacement: resolve(__dirname, './src') },
				{ find: '~', replacement: resolve(__dirname, './src') },
			],
		},
	})
)
