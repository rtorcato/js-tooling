import fs from 'fs-extra'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ProjectConfig } from '../../../src/cli/commands/setup.js'
import {
	composeVerifyScript,
	generatePackageJson,
} from '../../../src/cli/generators/package-json.js'
import { useTmpDir } from '../../helpers/tmp-dir.js'

const newTmpDir = useTmpDir()

function baseConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
	return {
		projectName: 'my-app',
		projectType: 'library',
		typescript: { enabled: true, config: 'base' },
		linting: { tool: 'biome' },
		formatting: { tool: 'biome' },
		testing: { framework: 'none' },
		gitHooks: false,
		commitLint: false,
		semanticRelease: false,
		bundler: 'none',
		...overrides,
	}
}

describe('generatePackageJson', () => {
	it('creates a new package.json with the project name', async () => {
		const dir = newTmpDir()
		await generatePackageJson(baseConfig({ projectName: 'cool-lib' }), dir)

		const pkg = await fs.readJson(join(dir, 'package.json'))
		expect(pkg.name).toBe('cool-lib')
		expect(pkg.version).toBe('0.1.0')
		expect(pkg.type).toBe('module')
		expect(pkg.devDependencies['@rtorcato/js-tooling']).toBe('latest')
		// packageManager is the single source of truth for pnpm/action-setup
		expect(pkg.packageManager).toMatch(/^pnpm@\d+\.\d+\.\d+$/)
	})

	it('merges into an existing package.json, preserving existing name and version', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'existing-pkg',
			version: '1.2.3',
			description: 'keep me',
			packageManager: 'pnpm@10.0.0',
		})

		await generatePackageJson(baseConfig(), dir)

		const pkg = await fs.readJson(join(dir, 'package.json'))
		// existing fields win over config defaults via spread
		expect(pkg.name).toBe('existing-pkg')
		expect(pkg.version).toBe('1.2.3')
		expect(pkg.description).toBe('keep me')
		expect(pkg.packageManager).toBe('pnpm@10.0.0')
		// new devDependencies are still injected
		expect(pkg.devDependencies['@rtorcato/js-tooling']).toBe('latest')
	})

	it('adds library fields for library project type', async () => {
		const dir = newTmpDir()
		await generatePackageJson(baseConfig({ projectType: 'library' }), dir)

		const pkg = await fs.readJson(join(dir, 'package.json'))
		// Mapping must match tsup output (type:module, format cjs+esm):
		// ESM → index.js, CJS → index.cjs, types → index.d.ts / index.d.cts.
		expect(pkg.main).toBe('./dist/index.cjs')
		expect(pkg.module).toBe('./dist/index.js')
		expect(pkg.types).toBe('./dist/index.d.ts')
		expect(pkg.exports['.'].import).toBe('./dist/index.js')
		expect(pkg.exports['.'].require).toBe('./dist/index.cjs')
		expect(pkg.files).toContain('dist')
		expect(pkg.publishConfig.access).toBe('public')
	})

	it('approves esbuild build and installs release plugins for a library', async () => {
		const dir = newTmpDir()
		await generatePackageJson(
			baseConfig({ projectType: 'library', bundler: 'tsup', semanticRelease: true }),
			dir
		)

		const pkg = await fs.readJson(join(dir, 'package.json'))
		// pnpm 11 blocks esbuild's build script (pulled via tsup) unless approved.
		expect(pkg.pnpm.onlyBuiltDependencies).toContain('esbuild')
		// The github release preset activates the changelog + git plugins.
		expect(pkg.devDependencies['@semantic-release/changelog']).toBeDefined()
		expect(pkg.devDependencies['@semantic-release/git']).toBeDefined()
	})

	it('omits library fields for web-app project type', async () => {
		const dir = newTmpDir()
		await generatePackageJson(baseConfig({ projectType: 'web-app' }), dir)

		const pkg = await fs.readJson(join(dir, 'package.json'))
		expect(pkg.main).toBeUndefined()
		expect(pkg.exports).toBeUndefined()
	})

	it('adds biome scripts when linting tool is biome', async () => {
		const dir = newTmpDir()
		await generatePackageJson(baseConfig({ linting: { tool: 'biome' } }), dir)

		const pkg = await fs.readJson(join(dir, 'package.json'))
		expect(pkg.scripts.lint).toBe('biome lint .')
		expect(pkg.scripts.format).toBe('biome format .')
		expect(pkg.scripts.check).toBe('biome check .')
		expect(pkg.scripts['check:fix']).toBe('biome check --fix .')
		expect(pkg.scripts['lint:fix']).toBeUndefined()
	})

	it('adds eslint + prettier scripts when linting tool is eslint', async () => {
		const dir = newTmpDir()
		await generatePackageJson(baseConfig({ linting: { tool: 'eslint' } }), dir)

		const pkg = await fs.readJson(join(dir, 'package.json'))
		expect(pkg.scripts.lint).toBe('eslint .')
		expect(pkg.scripts['lint:fix']).toBe('eslint . --fix')
		expect(pkg.scripts.format).toBe('prettier --write .')
	})

	it('adds vitest scripts and devDependencies when testing is vitest', async () => {
		const dir = newTmpDir()
		await generatePackageJson(baseConfig({ testing: { framework: 'vitest' } }), dir)

		const pkg = await fs.readJson(join(dir, 'package.json'))
		expect(pkg.scripts.test).toBe('vitest')
		expect(pkg.scripts['test:watch']).toBe('vitest --watch')
		expect(pkg.scripts.coverage).toBe('vitest run --coverage')
		expect(pkg.devDependencies.vitest).toBeDefined()
	})

	it('adds tsup scripts and devDependencies when bundler is tsup', async () => {
		const dir = newTmpDir()
		await generatePackageJson(baseConfig({ bundler: 'tsup' }), dir)

		const pkg = await fs.readJson(join(dir, 'package.json'))
		expect(pkg.scripts.build).toBe('tsup')
		expect(pkg.scripts['build:watch']).toBe('tsup --watch')
		expect(pkg.devDependencies.tsup).toBeDefined()
	})

	it('adds husky prepare script and devDependency when gitHooks is true', async () => {
		const dir = newTmpDir()
		await generatePackageJson(baseConfig({ gitHooks: true }), dir)

		const pkg = await fs.readJson(join(dir, 'package.json'))
		expect(pkg.scripts.prepare).toBe('husky')
		expect(pkg.devDependencies.husky).toBeDefined()
		expect(pkg.devDependencies['lint-staged']).toBeDefined()
	})

	it('adds semantic-release script and devDependencies when semanticRelease is true', async () => {
		const dir = newTmpDir()
		await generatePackageJson(baseConfig({ semanticRelease: true }), dir)

		const pkg = await fs.readJson(join(dir, 'package.json'))
		expect(pkg.scripts.release).toBe('semantic-release')
		expect(pkg.devDependencies['semantic-release']).toBeDefined()
	})

	it('adds typecheck script when TypeScript is enabled', async () => {
		const dir = newTmpDir()
		await generatePackageJson(baseConfig({ typescript: { enabled: true, config: 'base' } }), dir)

		const pkg = await fs.readJson(join(dir, 'package.json'))
		expect(pkg.scripts.typecheck).toBe('tsc --noEmit')
		expect(pkg.devDependencies.typescript).toBeDefined()
	})

	it('adds a verify script chaining typecheck + check + vitest for a TS/biome/vitest library', async () => {
		const dir = newTmpDir()
		await generatePackageJson(
			baseConfig({
				typescript: { enabled: true, config: 'base' },
				linting: { tool: 'biome' },
				testing: { framework: 'vitest' },
			}),
			dir
		)

		const pkg = await fs.readJson(join(dir, 'package.json'))
		expect(pkg.scripts.verify).toBe('pnpm typecheck && pnpm check && pnpm exec vitest run')
	})

	it('omits the verify script when only one tool is enabled', async () => {
		const dir = newTmpDir()
		await generatePackageJson(
			baseConfig({
				typescript: { enabled: true, config: 'base' },
				linting: { tool: 'none' },
				testing: { framework: 'none' },
			}),
			dir
		)

		const pkg = await fs.readJson(join(dir, 'package.json'))
		expect(pkg.scripts.verify).toBeUndefined()
	})

	it('adds publint dep, script, and verify step when publint is enabled', async () => {
		const dir = newTmpDir()
		await generatePackageJson(
			baseConfig({
				typescript: { enabled: true, config: 'base' },
				linting: { tool: 'biome' },
				publint: true,
			}),
			dir
		)

		const pkg = await fs.readJson(join(dir, 'package.json'))
		expect(pkg.devDependencies.publint).toBe('^0.3.0')
		expect(pkg.scripts.publint).toBe('publint --strict')
		expect(pkg.scripts.verify).toBe('pnpm typecheck && pnpm check && pnpm publint')
	})

	it('omits publint when not enabled', async () => {
		const dir = newTmpDir()
		await generatePackageJson(baseConfig({ publint: false }), dir)

		const pkg = await fs.readJson(join(dir, 'package.json'))
		expect(pkg.scripts.publint).toBeUndefined()
		expect(pkg.devDependencies.publint).toBeUndefined()
	})
})

describe('composeVerifyScript', () => {
	it('uses pnpm lint for eslint projects', () => {
		const result = composeVerifyScript(
			baseConfig({
				linting: { tool: 'eslint' },
				testing: { framework: 'vitest' },
			})
		)
		expect(result).toBe('pnpm typecheck && pnpm lint && pnpm exec vitest run')
	})

	it('uses pnpm test --ci for jest projects', () => {
		const result = composeVerifyScript(
			baseConfig({
				linting: { tool: 'biome' },
				testing: { framework: 'jest' },
			})
		)
		expect(result).toBe('pnpm typecheck && pnpm check && pnpm test --ci')
	})

	it('returns null when fewer than two tools are enabled', () => {
		const result = composeVerifyScript(
			baseConfig({
				typescript: { enabled: false, config: 'base' },
				linting: { tool: 'none' },
				testing: { framework: 'vitest' },
			})
		)
		expect(result).toBeNull()
	})
})
