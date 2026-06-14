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

	// Generate Oxlint config (additive — runs alongside Biome/ESLint)
	if (config.oxlint) {
		await generateOxlintConfig(targetDir)
	}
}

export async function generateOxlintConfig(targetDir: string) {
	// Oxlint's `extends` resolution from npm packages isn't reliably supported,
	// so we copy the full preset rather than write a thin pointer file (same
	// pattern as biome.jsonc — the user owns the file once it's in their repo).
	const { copyPreset } = await import('../utils/copy-preset.js')
	await copyPreset('oxlint', targetDir)
}

export async function generateBiomeConfig(targetDir: string) {
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

export async function generateESLintConfig(config: ProjectConfig, targetDir: string) {
	const eslintConfigPath = path.join(targetDir, 'eslint.config.mjs')

	const configType = config.linting.eslintConfig || 'base'

	const eslintConfig = `import { default as config } from '@rtorcato/js-tooling/eslint/${configType}'

export default config
`

	await fs.writeFile(eslintConfigPath, eslintConfig)
}

export async function generatePrettierConfig(targetDir: string) {
	const prettierConfigPath = path.join(targetDir, 'prettier.config.mjs')

	const prettierConfig = `export { default } from '@rtorcato/js-tooling/prettier'
`

	await fs.writeFile(prettierConfigPath, prettierConfig)
}
