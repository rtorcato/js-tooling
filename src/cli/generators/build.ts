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

	// Generate Changesets config (alternative to semantic-release)
	if (config.changesets) {
		await generateChangesetsConfig(targetDir)
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

// Plugins the github/gitlab preset activates that semantic-release core does
// NOT bundle (core bundles only commit-analyzer, release-notes-generator, npm,
// github). Without these in the consumer's deps, `semantic-release` crashes
// with "Cannot find module '@semantic-release/changelog'" on first run.
const RELEASE_PLUGIN_DEPS: Record<string, string> = {
	'@semantic-release/changelog': '^6.0.0',
	'@semantic-release/git': '^10.0.0',
}

export async function generateSemanticReleaseConfig(targetDir: string): Promise<string[]> {
	const releaseConfigPath = path.join(targetDir, 'release.config.mjs')

	const releaseConfig = `export { default } from '@rtorcato/js-tooling/semantic-release/github'
`

	await fs.writeFile(releaseConfigPath, releaseConfig)
	const written = ['release.config.mjs']

	// Ensure the preset's non-bundled plugins are installed; otherwise the
	// scaffolded release.config.mjs references modules the consumer lacks.
	const pkgPath = path.join(targetDir, 'package.json')
	if (await fs.pathExists(pkgPath)) {
		const pkg = (await fs.readJson(pkgPath)) as Record<string, any>
		const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>
		const deps = (pkg.dependencies ?? {}) as Record<string, string>
		let changed = false
		for (const [name, version] of Object.entries(RELEASE_PLUGIN_DEPS)) {
			if (!devDeps[name] && !deps[name]) {
				devDeps[name] = version
				changed = true
			}
		}
		if (changed) {
			pkg.devDependencies = devDeps
			await fs.writeJson(pkgPath, pkg, { spaces: 2 })
			written.push('package.json')
		}
	}

	return written
}

export async function generateChangesetsConfig(targetDir: string) {
	// Drop the canonical Changesets config into .changeset/config.json. The user
	// owns this file once it's in their repo; subsequent `pnpm changeset` runs
	// create per-change markdown files alongside it.
	const { copyPreset } = await import('../utils/copy-preset.js')
	await copyPreset('changesets', targetDir)
}
