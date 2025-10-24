import fs from 'fs-extra'
import path from 'path'
import type { ProjectConfig } from '../commands/setup.js'

export async function generatePackageJson(config: ProjectConfig, targetDir: string) {
	const packageJsonPath = path.join(targetDir, 'package.json')

	let existingPackageJson = {}
	if (await fs.pathExists(packageJsonPath)) {
		existingPackageJson = await fs.readJson(packageJsonPath)
	}

	const packageJson: any = {
		name: config.projectName,
		version: '0.1.0',
		description: '',
		type: 'module',
		...existingPackageJson,
		scripts: {
			...getScripts(config),
			...(existingPackageJson as any)?.scripts,
		},
		dependencies: {
			...(existingPackageJson as any)?.dependencies,
		},
		devDependencies: {
			'@rtorcato/js-tooling': 'latest',
			...getDependencies(config),
			...(existingPackageJson as any)?.devDependencies,
		},
	}

	// Add additional package.json fields based on project type
	if (config.projectType === 'library') {
		packageJson.main = './dist/index.js'
		packageJson.module = './dist/index.mjs'
		packageJson.types = './dist/index.d.ts'
		packageJson.exports = {
			'.': {
				import: './dist/index.mjs',
				require: './dist/index.js',
				types: './dist/index.d.ts',
			},
		}
		packageJson.files = ['dist']
		packageJson.publishConfig = {
			access: 'public',
		}
	}

	await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 })
}

function getScripts(config: ProjectConfig): Record<string, string> {
	const scripts: Record<string, string> = {}

	// TypeScript scripts
	if (config.typescript.enabled) {
		scripts['typecheck'] = 'tsc --noEmit'
	}

	// Linting scripts
	if (config.linting.tool === 'biome' || config.linting.tool === 'both') {
		scripts['lint'] = 'biome lint .'
		scripts['format'] = 'biome format .'
		scripts['check'] = 'biome check .'
		scripts['check:fix'] = 'biome check --fix .'
	} else if (config.linting.tool === 'eslint') {
		scripts['lint'] = 'eslint .'
		scripts['lint:fix'] = 'eslint . --fix'
		scripts['format'] = 'prettier --write .'
	}

	// Testing scripts
	if (config.testing.framework === 'vitest') {
		scripts['test'] = 'vitest'
		scripts['test:watch'] = 'vitest --watch'
		scripts['test:ui'] = 'vitest --ui'
		scripts['coverage'] = 'vitest run --coverage'
	} else if (config.testing.framework === 'jest') {
		scripts['test'] = 'jest'
		scripts['test:watch'] = 'jest --watch'
		scripts['coverage'] = 'jest --coverage'
	} else if (config.testing.framework === 'playwright') {
		scripts['test:e2e'] = 'playwright test'
		scripts['test:e2e:ui'] = 'playwright test --ui'
	}

	// Build scripts
	if (config.bundler === 'tsup') {
		scripts['build'] = 'tsup'
		scripts['build:watch'] = 'tsup --watch'
	} else if (config.bundler === 'esbuild') {
		scripts['build'] = 'node build.mjs'
	} else if (config.bundler === 'vite') {
		scripts['build'] = 'vite build'
		scripts['dev'] = 'vite'
		scripts['preview'] = 'vite preview'
	}

	// Git hooks
	if (config.gitHooks) {
		scripts['prepare'] = 'husky'
	}

	// Semantic release
	if (config.semanticRelease) {
		scripts['release'] = 'semantic-release'
	}

	return scripts
}

function getDependencies(config: ProjectConfig): Record<string, string> {
	const deps: Record<string, string> = {}

	// TypeScript
	if (config.typescript.enabled) {
		deps['typescript'] = '^5.9.3'
		deps['@types/node'] = '^24.0.0'
	}

	// Linting tools
	if (config.linting.tool === 'biome' || config.linting.tool === 'both') {
		deps['@biomejs/biome'] = '^2.3.0'
	}
	if (config.linting.tool === 'eslint' || config.linting.tool === 'both') {
		deps['eslint'] = '^9.0.0'
		deps['prettier'] = '^3.0.0'
	}

	// Testing frameworks
	if (config.testing.framework === 'vitest') {
		deps['vitest'] = '^4.0.0'
		if (config.testing.environment === 'browser' || config.testing.environment === 'both') {
			deps['@vitest/ui'] = '^4.0.0'
			deps['jsdom'] = '^25.0.0'
		}
	} else if (config.testing.framework === 'jest') {
		deps['jest'] = '^29.0.0'
		if (config.typescript.enabled) {
			deps['ts-jest'] = '^29.0.0'
		}
	} else if (config.testing.framework === 'playwright') {
		deps['@playwright/test'] = '^1.56.0'
	}

	// Build tools
	if (config.bundler === 'tsup') {
		deps['tsup'] = '^8.0.0'
	} else if (config.bundler === 'esbuild') {
		deps['esbuild'] = '^0.25.0'
	} else if (config.bundler === 'vite') {
		deps['vite'] = '^6.0.0'
	}

	// Git hooks
	if (config.gitHooks) {
		deps['husky'] = '^9.0.0'
		deps['lint-staged'] = '^16.0.0'
	}

	// Commit linting
	if (config.commitLint) {
		deps['@commitlint/cli'] = '^20.0.0'
		deps['@commitlint/config-conventional'] = '^20.0.0'
	}

	// Semantic release
	if (config.semanticRelease) {
		deps['semantic-release'] = '^25.0.0'
		deps['@semantic-release/github'] = '^12.0.0'
	}

	return deps
}
