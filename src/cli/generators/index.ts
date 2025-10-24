import fs from 'fs-extra'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ProjectConfig } from '../commands/setup.js'
import { generateBuildConfigs } from './build.js'
import { generateGitConfigs } from './git.js'
import { generateGitHubActions } from './github-actions.js'
import { generateLintingConfigs } from './linting.js'
import { generatePackageJson } from './package-json.js'
import { generateReadme } from './readme.js'
import { generateTestingConfigs } from './testing.js'
import { generateTSConfig } from './tsconfig.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export async function generateConfigs(config: ProjectConfig, targetDir: string) {
	// Generate package.json
	await generatePackageJson(config, targetDir)

	// Generate TypeScript configuration
	if (config.typescript.enabled) {
		await generateTSConfig(config, targetDir)
	}

	// Generate linting configurations
	if (config.linting.tool !== 'none') {
		await generateLintingConfigs(config, targetDir)
	}

	// Generate testing configurations
	if (config.testing.framework !== 'none') {
		await generateTestingConfigs(config, targetDir)
	}

	// Generate git configurations
	if (config.gitHooks || config.commitLint) {
		await generateGitConfigs(config, targetDir)
	}

	// Generate GitHub Actions workflow
	await generateGitHubActions(config, targetDir)

	// Generate build configurations
	if (config.bundler !== 'none') {
		await generateBuildConfigs(config, targetDir)
	}

	// Generate README
	await generateReadme(config, targetDir)

	// Copy ts-reset if TypeScript is enabled
	if (config.typescript.enabled) {
		await copyTSReset(targetDir)
	}
}

async function copyTSReset(targetDir: string) {
	const toolingRoot = path.resolve(__dirname, '../../../tooling')
	const resetPath = path.join(toolingRoot, 'typescript', 'reset.d.ts')
	const targetPath = path.join(targetDir, 'reset.d.ts')

	if (await fs.pathExists(resetPath)) {
		await fs.copy(resetPath, targetPath)
	}
}
