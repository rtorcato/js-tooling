import fs from 'fs-extra'
import path from 'node:path'
import type { ProjectConfig } from '../commands/setup.js'

export async function generateTSConfig(config: ProjectConfig, targetDir: string) {
	const tsconfigPath = path.join(targetDir, 'tsconfig.json')

	// Base configuration extends our tooling. The shared presets anchor `paths`
	// with ${configDir}, so no local baseUrl/paths is needed (baseUrl is
	// deprecated in TS 5.9, removed in TS 7.0). Refs: https://aka.ms/ts6
	// Targeting Bun (#225) means the Bun-typed preset (adds `types: ['bun']`),
	// regardless of the chosen project config — Bun is a runtime flag, not a type.
	const preset = config.bun ? 'bun' : config.typescript.config
	const tsconfig: any = {
		extends: `@rtorcato/js-tooling/typescript/${preset}`,
		compilerOptions: {},
		include: ['src/**/*', 'reset.d.ts'],
		exclude: ['node_modules', 'dist', 'build'],
	}

	// Adjust for project type
	if (config.projectType === 'library') {
		tsconfig.compilerOptions.outDir = './dist'
		tsconfig.compilerOptions.rootDir = './src'
	}

	if (config.projectType === 'nextjs-app') {
		tsconfig.include = ['next-env.d.ts', 'src', 'app', 'pages', 'components', 'reset.d.ts']
		tsconfig.exclude.push('.next')
	}

	await fs.writeJson(tsconfigPath, tsconfig, { spaces: 2 })
}
