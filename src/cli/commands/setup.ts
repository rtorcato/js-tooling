import path from 'node:path'
import chalk from 'chalk'
import fs from 'fs-extra'
import inquirer from 'inquirer'
import { generateConfigs } from '../generators/index.js'
import { formatGeneratedFiles } from '../utils/format.js'
import { installDependencies } from '../utils/install.js'
import { LOCKFILE_NAME, writeLockfile } from '../utils/lockfile.js'
import {
	buildPresetConfig,
	computeFileList,
	CONFIG_SCHEMA,
	PRESET_NAMES,
	type PresetName,
	validateProjectConfig,
} from './setup-presets.js'

export interface ProjectConfig {
	projectName: string
	/**
	 * Primary language of the repo. Optional for backward compat — lockfiles
	 * written before v2 lack it and are migrated to 'js' on read. New setups
	 * always record it. Part of the multi-language seam (#139/#140).
	 */
	language?: 'js' | 'swift' | 'perl' | 'python'
	projectType: 'library' | 'web-app' | 'node-api' | 'nextjs-app' | 'react-app'
	typescript: {
		enabled: boolean
		config: 'base' | 'react' | 'next' | 'node' | 'express'
	}
	linting: {
		tool: 'biome' | 'eslint' | 'both' | 'none'
		eslintConfig?: 'base' | 'nextjs'
	}
	formatting: {
		tool: 'biome' | 'prettier' | 'none'
	}
	testing: {
		framework: 'vitest' | 'jest' | 'playwright' | 'none'
		environment?: 'node' | 'browser' | 'both'
	}
	gitHooks: boolean
	commitLint: boolean
	semanticRelease: boolean
	changesets?: boolean
	oxlint?: boolean
	securityAutomation: boolean
	bundler: 'tsup' | 'esbuild' | 'rollup' | 'vite' | 'none'
	treeshakeCheck?: boolean
	/** Add publint (validates package.json + dist for publishing mistakes). */
	publint?: boolean
	/** Add a status-badge block to the generated README. */
	badges?: boolean
	/** Scaffold AI agent files (AGENTS.md, CLAUDE.md, Cursor/Copilot, Claude skill, MCP example). */
	aiSetup?: boolean
	/** Scaffold a turbo.json task pipeline (pnpm-workspace monorepos). */
	turborepo?: boolean
}

export interface SetupOptions {
	directory: string
	skipInstall?: boolean
	config?: string
	preset?: string
	dryRun?: boolean
	configSchema?: boolean
}

async function resolveConfig(options: SetupOptions): Promise<ProjectConfig> {
	if (options.config && options.preset) {
		console.warn(chalk.yellow('⚠️  Both --config and --preset given; --config wins.\n'))
	}
	if (options.config) {
		const configPath = path.resolve(options.config)
		if (!(await fs.pathExists(configPath))) {
			throw new Error(`Config file not found: ${configPath}`)
		}
		const raw = await fs.readJson(configPath)
		const { valid, errors } = validateProjectConfig(raw)
		if (!valid) {
			throw new Error(`Invalid config:\n  - ${errors.join('\n  - ')}`)
		}
		return raw as ProjectConfig
	}
	if (options.preset) {
		if (!(PRESET_NAMES as readonly string[]).includes(options.preset)) {
			throw new Error(`Unknown preset: ${options.preset}. Available: ${PRESET_NAMES.join(', ')}`)
		}
		const projectName = path.basename(path.resolve(options.directory))
		return buildPresetConfig(options.preset as PresetName, projectName)
	}
	return promptForConfig(path.resolve(options.directory))
}

export async function setupProject(options: SetupOptions) {
	if (options.configSchema) {
		console.log(JSON.stringify(CONFIG_SCHEMA, null, 2))
		return
	}

	const targetDir = path.resolve(options.directory)
	const interactive = !options.config && !options.preset
	const dryRun = options.dryRun === true

	if (interactive && !dryRun) {
		console.log(chalk.cyan('\n🛠️  Welcome to JS Tooling Setup!\n'))
		console.log(chalk.gray(`Setting up tooling in: ${targetDir}\n`))
	}

	try {
		await fs.ensureDir(targetDir)
		const config = await resolveConfig(options)

		if (dryRun) {
			const files = computeFileList(config)
			console.log(JSON.stringify({ directory: targetDir, config, files }, null, 2))
			return
		}

		if (!interactive) {
			console.log(chalk.cyan(`\n🛠️  Scaffolding ${config.projectType} in ${targetDir}\n`))
		}
		console.log(chalk.cyan('\n📝 Generating configuration files...\n'))

		await generateConfigs(config, targetDir)
		await writeLockfile(targetDir, config)

		if (!options.skipInstall) {
			console.log(chalk.cyan('\n📦 Installing dependencies...\n'))
			await installDependencies(config, targetDir)
			// Format now that the linter/formatter is installed, so the scaffold
			// passes its own `pnpm check` out of the box (templates are written by
			// hand and don't match biome/prettier whitespace).
			await formatGeneratedFiles(config, targetDir)
		}

		console.log(chalk.green('\n✅ Setup completed successfully!\n'))
		showNextSteps(config, targetDir)
	} catch (error) {
		console.error(chalk.red('\n❌ Setup failed:'), error)
		process.exit(1)
	}
}

async function promptForConfig(targetDir: string): Promise<ProjectConfig> {
	// Turborepo only makes sense in a pnpm-workspace monorepo, so the prompt is
	// only offered when one is already present in the target dir.
	const hasWorkspace = await fs.pathExists(path.join(targetDir, 'pnpm-workspace.yaml'))
	const answers = await inquirer.prompt([
		{
			type: 'input',
			name: 'projectName',
			message: '📦 What is your project name?',
			default: path.basename(process.cwd()),
			validate: (input: string) => input.trim().length > 0 || 'Project name is required',
		},
		{
			type: 'list',
			name: 'projectType',
			message: '🏗️  What type of project are you building?',
			choices: [
				{ name: '📚 Library/Package', value: 'library' },
				{ name: '🌐 Web Application', value: 'web-app' },
				{ name: '🚀 Node.js API', value: 'node-api' },
				{ name: '⚡ Next.js App', value: 'nextjs-app' },
				{ name: '⚛️  React App', value: 'react-app' },
			],
		},
		{
			type: 'confirm',
			name: 'useTypeScript',
			message: '📘 Do you want to use TypeScript?',
			default: true,
		},
		{
			type: 'list',
			name: 'tsConfig',
			message: '⚙️  Which TypeScript configuration?',
			choices: (answers: any) => {
				const baseChoices = [
					{ name: '🔧 Base (General purpose)', value: 'base' },
					{ name: '🖥️  Node.js', value: 'node' },
				]

				if (answers.projectType === 'nextjs-app') {
					return [{ name: '⚡ Next.js', value: 'next' }, ...baseChoices]
				}
				if (answers.projectType === 'react-app' || answers.projectType === 'web-app') {
					return [{ name: '⚛️  React', value: 'react' }, ...baseChoices]
				}
				if (answers.projectType === 'node-api') {
					return [
						{ name: '🚀 Express/API', value: 'express' },
						{ name: '🖥️  Node.js', value: 'node' },
					]
				}

				return baseChoices
			},
			when: (answers: any) => answers.useTypeScript,
		},
		{
			type: 'list',
			name: 'lintingTool',
			message: '🔍 Which linting/formatting tool?',
			choices: [
				{ name: '⚡ Biome (Fast, all-in-one)', value: 'biome' },
				{ name: '🔧 ESLint (Configurable)', value: 'eslint' },
				{ name: '🔥 Both Biome + ESLint', value: 'both' },
				{ name: '❌ None', value: 'none' },
			],
			default: 'biome',
		},
		{
			type: 'list',
			name: 'eslintConfig',
			message: '🔧 Which ESLint configuration?',
			choices: (answers: any) => {
				const choices = [{ name: '🔧 Base configuration', value: 'base' }]
				if (answers.projectType === 'nextjs-app') {
					choices.unshift({ name: '⚡ Next.js configuration', value: 'nextjs' })
				}
				return choices
			},
			when: (answers: any) => answers.lintingTool === 'eslint' || answers.lintingTool === 'both',
		},
		{
			type: 'confirm',
			name: 'oxlint',
			message: '🦀 Also run Oxlint alongside (50–100× faster than ESLint)?',
			default: false,
			when: (answers: any) => answers.lintingTool !== 'none',
		},
		{
			type: 'list',
			name: 'testingFramework',
			message: '🧪 Which testing framework?',
			choices: [
				{ name: '⚡ Vitest (Fast, Vite-powered)', value: 'vitest' },
				{ name: '🃏 Jest (Traditional)', value: 'jest' },
				{ name: '🎭 Playwright (E2E)', value: 'playwright' },
				{ name: '❌ None', value: 'none' },
			],
			default: 'vitest',
		},
		{
			type: 'list',
			name: 'testEnvironment',
			message: '🌍 Test environment?',
			choices: [
				{ name: '🖥️  Node.js', value: 'node' },
				{ name: '🌐 Browser (DOM)', value: 'browser' },
				{ name: '🔄 Both', value: 'both' },
			],
			when: (answers: any) => answers.testingFramework === 'jest',
			default: 'node',
		},
		{
			type: 'confirm',
			name: 'gitHooks',
			message: '🪝 Set up Git hooks (Husky + lint-staged)?',
			default: true,
		},
		{
			type: 'confirm',
			name: 'commitLint',
			message: '📝 Set up conventional commit linting?',
			default: true,
			when: (answers: any) => answers.gitHooks,
		},
		{
			type: 'list',
			name: 'releaseTool',
			message: '🚀 Automated release tool?',
			choices: [
				{ name: '📦 semantic-release (commit-message-driven)', value: 'semantic-release' },
				{ name: '📝 Changesets (changeset-file-driven, monorepo-friendly)', value: 'changesets' },
				{ name: '❌ None', value: 'none' },
			],
			default: 'semantic-release',
			when: (answers: any) => answers.projectType === 'library',
		},
		{
			type: 'confirm',
			name: 'treeshakeCheck',
			message: '🌳 Add a tree-shake verification check (apps/treeshake-check)?',
			default: false,
			when: (answers: any) => answers.projectType === 'library',
		},
		{
			type: 'confirm',
			name: 'publint',
			message: '📦 Add publint to lint your package before publishing?',
			default: true,
			when: (answers: any) => answers.projectType === 'library',
		},
		{
			type: 'confirm',
			name: 'badges',
			message: '🔖 Add status badges (CI, npm, coverage, license) to the README?',
			default: true,
		},
		{
			type: 'confirm',
			name: 'securityAutomation',
			message: '🛡️  Include security automation (Dependabot + CodeQL)?',
			default: true,
		},
		{
			type: 'confirm',
			name: 'aiSetup',
			message: '🤖 Add AI agent rules (AGENTS.md, CLAUDE.md, Cursor, Copilot, Claude skill)?',
			default: true,
		},
		{
			type: 'confirm',
			name: 'turborepo',
			message: '🚀 Add a Turborepo task pipeline (turbo.json)?',
			default: true,
			when: () => hasWorkspace,
		},
		{
			type: 'list',
			name: 'bundler',
			message: '📦 Which bundler/build tool?',
			choices: (answers: any) => {
				const choices = [
					{ name: '📦 tsup (TypeScript packages)', value: 'tsup' },
					{ name: '⚡ esbuild (Fast bundling)', value: 'esbuild' },
					{ name: '🍣 Rollup (library bundler)', value: 'rollup' },
					{ name: '❌ None', value: 'none' },
				]

				if (answers.projectType === 'web-app' || answers.projectType === 'react-app') {
					choices.unshift({ name: '⚡ Vite (Modern web apps)', value: 'vite' })
				}

				return choices
			},
			when: (answers: any) => answers.projectType !== 'nextjs-app', // Next.js has its own bundler
		},
	])

	return {
		projectName: answers.projectName,
		// v1 of the setup wizard scaffolds JS/TS repos only; the field exists so
		// doctor/fix can gate by language (#139). No prompt yet — always 'js'.
		language: 'js',
		projectType: answers.projectType,
		typescript: {
			enabled: answers.useTypeScript || false,
			config: answers.tsConfig || 'base',
		},
		linting: {
			tool: answers.lintingTool || 'none',
			eslintConfig: answers.eslintConfig,
		},
		formatting: {
			tool:
				answers.lintingTool === 'biome' || answers.lintingTool === 'both'
					? 'biome'
					: answers.lintingTool === 'eslint'
						? 'prettier'
						: 'none',
		},
		testing: {
			framework: answers.testingFramework || 'none',
			environment: answers.testEnvironment,
		},
		gitHooks: answers.gitHooks || false,
		commitLint: answers.commitLint || false,
		semanticRelease: answers.releaseTool === 'semantic-release',
		changesets: answers.releaseTool === 'changesets',
		oxlint: answers.oxlint || false,
		securityAutomation: answers.securityAutomation ?? false,
		bundler: answers.bundler || 'none',
		treeshakeCheck: answers.treeshakeCheck || false,
		publint: answers.publint ?? false,
		badges: answers.badges ?? false,
		aiSetup: answers.aiSetup ?? false,
		turborepo: answers.turborepo ?? false,
	}
}

function showNextSteps(config: ProjectConfig, _targetDir: string) {
	console.log(chalk.bold('\n📋 Next Steps:\n'))

	const steps = []

	if (config.typescript.enabled) {
		steps.push('🔧 Customize your tsconfig.json as needed')
	}

	if (config.linting.tool !== 'none') {
		steps.push(
			`🔍 Run linting with: ${config.linting.tool === 'biome' ? 'pnpm biome check .' : 'pnpm eslint .'}`
		)
	}

	if (config.testing.framework !== 'none') {
		steps.push(`🧪 Run tests with: pnpm ${config.testing.framework}`)
	}

	if (config.gitHooks) {
		steps.push('🪝 Commit your changes to test the git hooks')
	}

	steps.push(
		`🔒 ${LOCKFILE_NAME} records your setup choices — doctor uses it to suppress intentional opt-outs`
	)
	steps.push('📖 Check the generated README.md for more details')

	steps.forEach((step, index) => {
		console.log(`  ${index + 1}. ${step}`)
	})

	const skipped = collectSkippedFixSuggestions(config)
	if (skipped.length > 0) {
		console.log(chalk.bold('\n💡 Want to add something you skipped?\n'))
		for (const s of skipped) {
			console.log(`  ${chalk.gray('-')} ${s}`)
		}
	}

	console.log(
		chalk.dim('\n📁 All configuration files have been generated in your project directory.')
	)
	console.log(chalk.dim('   You can modify them to suit your specific needs.\n'))
}

function collectSkippedFixSuggestions(config: ProjectConfig): string[] {
	const suggestions: string[] = []
	if (!config.gitHooks) {
		suggestions.push('Run `npx @rtorcato/js-tooling fix husky` to add git hooks later')
	}
	if (!config.commitLint) {
		suggestions.push(
			'Run `npx @rtorcato/js-tooling fix commitlint` to add conventional-commit linting'
		)
	}
	if (!config.semanticRelease && config.projectType === 'library') {
		suggestions.push(
			'Run `npx @rtorcato/js-tooling fix semantic-release` to add automated releases'
		)
	}
	if (!config.securityAutomation) {
		suggestions.push(
			'Run `npx @rtorcato/js-tooling fix dependabot` and `fix codeql` for security automation'
		)
	}
	if (config.linting.tool === 'none') {
		suggestions.push('Run `npx @rtorcato/js-tooling fix biome` or `fix eslint` to add linting')
	}
	if (config.testing.framework === 'none') {
		suggestions.push('Run `npx @rtorcato/js-tooling fix vitest` to add a test runner')
	}
	if (config.projectType === 'library' && !config.treeshakeCheck) {
		suggestions.push(
			'Run `npx @rtorcato/js-tooling fix treeshake-check` to add an esbuild-based tree-shake assertion'
		)
	}
	suggestions.push('Run `npx @rtorcato/js-tooling doctor` any time to audit drift')
	return suggestions
}
