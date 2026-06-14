import { defineConfig, mergeConfig } from 'vitest/config'
import base from './tooling/vitest/vitest.config.mjs'

// js-tooling-specific coverage scope and thresholds. The shared preset only
// provides generic v8 defaults so consumers don't inherit our paths.
export default mergeConfig(
	base,
	defineConfig({
		test: {
			exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**'],
			coverage: {
				include: ['src/cli/generators/**/*.ts'],
				thresholds: {
					statements: 25,
					lines: 25,
					functions: 40,
					branches: 17,
				},
			},
		},
	})
)
