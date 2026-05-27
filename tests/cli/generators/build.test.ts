import fs from 'fs-extra'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ProjectConfig } from '../../../src/cli/commands/setup.js'
import { generateBuildConfigs } from '../../../src/cli/generators/build.js'
import { useTmpDir } from '../../helpers/tmp-dir.js'

const newTmpDir = useTmpDir()

function baseConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
	return {
		projectName: 'my-lib',
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

describe('generateBuildConfigs', () => {
	it('writes tsup.config.ts when bundler is tsup', async () => {
		const dir = newTmpDir()
		await generateBuildConfigs(baseConfig({ bundler: 'tsup' }), dir)

		const content = await fs.readFile(join(dir, 'tsup.config.ts'), 'utf-8')
		expect(content).toContain("from '@rtorcato/js-tooling/tsup'")
		expect(content).toContain("entry: ['src/index.ts']")
		expect(await fs.pathExists(join(dir, 'build.mjs'))).toBe(false)
		expect(await fs.pathExists(join(dir, 'vite.config.ts'))).toBe(false)
	})

	it('writes build.mjs when bundler is esbuild', async () => {
		const dir = newTmpDir()
		await generateBuildConfigs(baseConfig({ bundler: 'esbuild' }), dir)

		const content = await fs.readFile(join(dir, 'build.mjs'), 'utf-8')
		expect(content).toContain("from 'esbuild'")
		expect(content).toContain('nodeExternalsPlugin')
		expect(await fs.pathExists(join(dir, 'tsup.config.ts'))).toBe(false)
	})

	it('writes vite.config.ts when bundler is vite', async () => {
		const dir = newTmpDir()
		await generateBuildConfigs(baseConfig({ bundler: 'vite' }), dir)

		const content = await fs.readFile(join(dir, 'vite.config.ts'), 'utf-8')
		expect(content).toContain("from 'vite'")
		expect(content).toContain('defineConfig')
		expect(await fs.pathExists(join(dir, 'tsup.config.ts'))).toBe(false)
	})

	it('includes react plugin in vite config for react-app project type', async () => {
		const dir = newTmpDir()
		await generateBuildConfigs(baseConfig({ bundler: 'vite', projectType: 'react-app' }), dir)

		const content = await fs.readFile(join(dir, 'vite.config.ts'), 'utf-8')
		expect(content).toContain("from '@vitejs/plugin-react'")
		expect(content).toContain('react()')
	})

	it('omits react plugin in vite config for non-react project types', async () => {
		const dir = newTmpDir()
		await generateBuildConfigs(baseConfig({ bundler: 'vite', projectType: 'node-api' }), dir)

		const content = await fs.readFile(join(dir, 'vite.config.ts'), 'utf-8')
		expect(content).not.toContain('@vitejs/plugin-react')
	})

	it('writes release.config.mjs when semanticRelease is true', async () => {
		const dir = newTmpDir()
		await generateBuildConfigs(baseConfig({ semanticRelease: true }), dir)

		const content = await fs.readFile(join(dir, 'release.config.mjs'), 'utf-8')
		expect(content).toContain('@rtorcato/js-tooling/semantic-release/github')
	})

	it('writes no files when bundler is none and semanticRelease is false', async () => {
		const dir = newTmpDir()
		await generateBuildConfigs(baseConfig(), dir)

		expect(await fs.pathExists(join(dir, 'tsup.config.ts'))).toBe(false)
		expect(await fs.pathExists(join(dir, 'build.mjs'))).toBe(false)
		expect(await fs.pathExists(join(dir, 'vite.config.ts'))).toBe(false)
		expect(await fs.pathExists(join(dir, 'release.config.mjs'))).toBe(false)
	})
})
