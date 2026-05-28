import fs from 'fs-extra'
import path from 'node:path'
import type { ProjectConfig } from '../commands/setup.js'

export async function generateBuildConfigs(config: ProjectConfig, targetDir: string) {
	if (config.bundler === 'tsup') {
		await generateTsupConfig(targetDir)
	} else if (config.bundler === 'esbuild') {
		await generateEsbuildConfig(targetDir)
	} else if (config.bundler === 'vite') {
		await generateViteConfig(config, targetDir)
	}

	// Generate semantic-release config for GitHub
	if (config.semanticRelease) {
		await generateSemanticReleaseConfig(targetDir)
	}
}

async function generateTsupConfig(targetDir: string) {
	const tsupConfigPath = path.join(targetDir, 'tsup.config.ts')

	const tsupConfig = `import { getConfig } from '@rtorcato/js-tooling/tsup'

export default getConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
}, process.env.NODE_ENV || 'development')
`

	await fs.writeFile(tsupConfigPath, tsupConfig)
}

async function generateEsbuildConfig(targetDir: string) {
	const esbuildConfigPath = path.join(targetDir, 'build.mjs')

	const esbuildConfig = `import { build } from 'esbuild'
import { nodeExternalsPlugin } from 'esbuild-node-externals'

const isProduction = process.env.NODE_ENV === 'production'

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outdir: 'dist',
  format: 'esm',
  target: 'node18',
  platform: 'node',
  minify: isProduction,
  sourcemap: !isProduction,
  plugins: [nodeExternalsPlugin()],
})

console.log('Build completed!')
`

	await fs.writeFile(esbuildConfigPath, esbuildConfig)
}

export async function generateViteConfig(config: ProjectConfig, targetDir: string) {
	const viteConfigPath = path.join(targetDir, 'vite.config.ts')

	// React apps need the plugin; we layer it on top of the shipped preset.
	const viteConfig =
		config.projectType === 'react-app'
			? `import preset from '@rtorcato/js-tooling/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, mergeConfig } from 'vite'

export default mergeConfig(preset, defineConfig({ plugins: [react()] }))
`
			: `export { default } from '@rtorcato/js-tooling/vite'
`

	await fs.writeFile(viteConfigPath, viteConfig)
}

export async function generateSemanticReleaseConfig(targetDir: string) {
	const releaseConfigPath = path.join(targetDir, 'release.config.mjs')

	const releaseConfig = `export { default } from '@rtorcato/js-tooling/semantic-release/github'
`

	await fs.writeFile(releaseConfigPath, releaseConfig)
}
