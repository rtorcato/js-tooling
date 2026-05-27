import fs from 'fs-extra'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ProjectConfig } from '../../../src/cli/commands/setup.js'
import { generateTSConfig } from '../../../src/cli/generators/tsconfig.js'
import { useTmpDir } from '../../helpers/tmp-dir.js'

const newTmpDir = useTmpDir()

function baseConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
	return {
		projectName: 'demo',
		projectType: 'library',
		typescript: { enabled: true, config: 'base' },
		linting: { tool: 'none' },
		formatting: { tool: 'none' },
		testing: { framework: 'none' },
		gitHooks: false,
		commitLint: false,
		semanticRelease: false,
		bundler: 'none',
		...overrides,
	}
}

describe('generateTSConfig', () => {
	it('writes a tsconfig.json that extends the requested preset', async () => {
		const dir = newTmpDir()
		await generateTSConfig(baseConfig({ typescript: { enabled: true, config: 'react' } }), dir)

		const tsconfig = await fs.readJson(join(dir, 'tsconfig.json'))
		expect(tsconfig.extends).toBe('@rtorcato/js-tooling/typescript/react')
		expect(tsconfig.compilerOptions.paths['@/*']).toEqual(['./src/*'])
		expect(tsconfig.include).toContain('reset.d.ts')
	})

	it('sets outDir/rootDir for library projects', async () => {
		const dir = newTmpDir()
		await generateTSConfig(baseConfig({ projectType: 'library' }), dir)

		const tsconfig = await fs.readJson(join(dir, 'tsconfig.json'))
		expect(tsconfig.compilerOptions.outDir).toBe('./dist')
		expect(tsconfig.compilerOptions.rootDir).toBe('./src')
	})

	it('switches include/exclude for Next.js projects', async () => {
		const dir = newTmpDir()
		await generateTSConfig(
			baseConfig({ projectType: 'nextjs-app', typescript: { enabled: true, config: 'next' } }),
			dir
		)

		const tsconfig = await fs.readJson(join(dir, 'tsconfig.json'))
		expect(tsconfig.include).toEqual([
			'next-env.d.ts',
			'src',
			'app',
			'pages',
			'components',
			'reset.d.ts',
		])
		expect(tsconfig.exclude).toContain('.next')
		expect(tsconfig.compilerOptions.outDir).toBeUndefined()
	})
})
