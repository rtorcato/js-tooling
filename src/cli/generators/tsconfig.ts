import fs from 'fs-extra'
import path from 'path'
import type { ProjectConfig } from '../commands/setup.js'

export async function generateTSConfig(config: ProjectConfig, targetDir: string) {
	const tsconfigPath = path.join(targetDir, 'tsconfig.json')

	// Base configuration extends our tooling
	const tsconfig: any = {
		extends: `@rtorcato/js-tooling/typescript/${config.typescript.config}`,
		compilerOptions: {
			baseUrl: '.',
			paths: {
				'@/*': ['./src/*'],
				'~/*': ['./src/*'],
			},
		},
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
