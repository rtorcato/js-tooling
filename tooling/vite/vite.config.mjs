import { defineConfig } from 'vite'

export default defineConfig({
	resolve: {
		alias: {
			'@': '/src',
			'~': '/src',
		},
	},
	build: {
		outDir: 'dist',
		sourcemap: true,
	},
	server: {
		port: 3000,
		open: true,
	},
})
