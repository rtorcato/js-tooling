import config from './tooling/vitest/vitest.config.mjs'

export default config

// import path from 'node:path'
// import { defineConfig } from 'vitest/config'

// export default defineConfig({
// 	test: {
// 		globals: true,
// 		environment: 'node',
// 		coverage: {
// 			provider: 'istanbul', // or 'v8'
// 			reporter: ['text', 'json', 'html'],
// 		},
// 	},
// 	resolve: {
// 		alias: {
// 			'@': path.resolve(__dirname, './src'),
// 		},
// 	},
// })
