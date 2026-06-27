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

	// Biome 2.x schema + shape. The base preset (extends) already defines the
	// file globs via `files.includes`; emitting the old 1.x `include`/`ignore`
	// keys here forced consumers to run `biome migrate` before `biome check`
	// would run at all.
	const biomeConfig = {
		$schema: 'https://biomejs.dev/schemas/2.3.0/schema.json',
		extends: ['@rtorcato/js-tooling/biome'],
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
