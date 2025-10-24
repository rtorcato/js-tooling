import fs from 'fs-extra'
import path from 'node:path'
import type { ProjectConfig } from '../commands/setup.js'

export async function generateLintingConfigs(config: ProjectConfig, targetDir: string) {
	// Generate Biome config
	if (config.linting.tool === 'biome' || config.linting.tool === 'both') {
		await generateBiomeConfig(targetDir)
	}

	// Generate ESLint config
	if (config.linting.tool === 'eslint' || config.linting.tool === 'both') {
		await generateESLintConfig(config, targetDir)
	}

	// Generate Prettier config if using ESLint
	if (config.linting.tool === 'eslint') {
		await generatePrettierConfig(targetDir)
	}
}

async function generateBiomeConfig(targetDir: string) {
	const biomeConfigPath = path.join(targetDir, 'biome.jsonc')

	const biomeConfig = {
		$schema: 'https://biomejs.dev/schemas/1.9.4/schema.json',
		extends: ['@rtorcato/js-tooling/biome'],
		files: {
			include: ['src/**/*', '*.ts', '*.js', '*.tsx', '*.jsx'],
			ignore: ['node_modules', 'dist', 'build', '.next'],
		},
	}

	await fs.writeJson(biomeConfigPath, biomeConfig, { spaces: 2 })
}

async function generateESLintConfig(config: ProjectConfig, targetDir: string) {
	const eslintConfigPath = path.join(targetDir, 'eslint.config.mjs')

	const configType = config.linting.eslintConfig || 'base'

	const eslintConfig = `import { default as config } from '@rtorcato/js-tooling/eslint/${configType}'

export default config
`

	await fs.writeFile(eslintConfigPath, eslintConfig)
}

async function generatePrettierConfig(targetDir: string) {
	const prettierConfigPath = path.join(targetDir, 'prettier.config.mjs')

	const prettierConfig = `export { default } from '@rtorcato/js-tooling/prettier'
`

	await fs.writeFile(prettierConfigPath, prettierConfig)
}
