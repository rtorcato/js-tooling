import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		// Keep vitest's defaults, plus ignore Claude Code worktrees so mirrored
		// test files under .claude/worktrees/ aren't collected twice.
		exclude: [...configDefaults.exclude, '.claude/**'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html', 'json-summary'],
		},
	},
	resolve: {
		alias: [
			{ find: '@', replacement: resolve(__dirname, './src') },
			{ find: '~', replacement: resolve(__dirname, './src') },
		],
	},
})
