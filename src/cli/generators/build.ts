import fs from 'fs-extra'
import path from 'node:path'
import type { ProjectConfig } from '../commands/setup.js'

// tsup, esbuild, and vite all pull in esbuild, whose install-time build script
// pnpm 11 refuses to run until it's approved — otherwise `pnpm install` fails
// with ERR_PNPM_IGNORED_BUILDS.
export function bundlerNeedsEsbuild(config: ProjectConfig): boolean {
	return config.bundler === 'tsup' || config.bundler === 'esbuild' || config.bundler === 'vite'
}

// pnpm 11 reads build-script approvals from the `allowBuilds` map (package →
// boolean), NOT the older `onlyBuiltDependencies` list — verified against the
// pinned pnpm@11.1.3, which ignores the list form and errors with
// ERR_PNPM_IGNORED_BUILDS.
const SINGLE_PACKAGE_BUILD_APPROVALS = `allowBuilds:
  esbuild: true
`

/**
 * pnpm 11 no longer reads build-script approvals from package.json's `pnpm`
 * field — they live in pnpm-workspace.yaml. For a single-package esbuild-backed
 * build, write a minimal pnpm-workspace.yaml approving esbuild. Never clobbers
 * an existing file (the treeshake-check path writes a richer one that already
 * lists esbuild). Must run after that path so its file wins. Returns the
 * relative path if written, else null.
 */
export async function ensureBuildApprovals(
	config: ProjectConfig,
	targetDir: string
): Promise<string | null> {
	if (!bundlerNeedsEsbuild(config)) return null
	const wsPath = path.join(targetDir, 'pnpm-workspace.yaml')
	if (await fs.pathExists(wsPath)) return null
	await fs.writeFile(wsPath, SINGLE_PACKAGE_BUILD_APPROVALS)
	return 'pnpm-workspace.yaml'
}

export async function generateBuildConfigs(config: ProjectConfig, targetDir: string) {
	if (config.bundler === 'tsup') {
		await generateTsupConfig(targetDir)
	} else if (config.bundler === 'esbuild') {
		await generateEsbuildConfig(targetDir)
	} else if (config.bundler === 'rollup') {
		await generateRollupConfig(targetDir)
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

export async function generateRollupConfig(targetDir: string) {
	const rollupConfigPath = path.join(targetDir, 'rollup.config.mjs')

	const rollupConfig = `export { default } from '@rtorcato/js-tooling/rollup'
`

	await fs.writeFile(rollupConfigPath, rollupConfig)
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
