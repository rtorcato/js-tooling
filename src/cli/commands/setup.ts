import chalk from 'chalk'
import fs from 'fs-extra'
import inquirer from 'inquirer'
import path from 'node:path'
import { generateConfigs } from '../generators/index.js'
import { installDependencies } from '../utils/install.js'

export interface ProjectConfig {
	projectName: string
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
	bundler: 'tsup' | 'esbuild' | 'vite' | 'none'
}

export async function setupProject(options: { directory: string; skipInstall?: boolean }) {
	const targetDir = path.resolve(options.directory)

	console.log(chalk.cyan('\n🛠️  Welcome to JS Tooling Setup!\n'))
	console.log(chalk.gray(`Setting up tooling in: ${targetDir}\n`))

	try {
		// Check if directory exists and is writable
		await fs.ensureDir(targetDir)

		const config = await promptForConfig()

		console.log(chalk.cyan('\n📝 Generating configuration files...\n'))

		await generateConfigs(config, targetDir)

		if (!options.skipInstall) {
			console.log(chalk.cyan('\n📦 Installing dependencies...\n'))
			await installDependencies(config, targetDir)
		}

		console.log(chalk.green('\n✅ Setup completed successfully!\n'))

		// Show next steps
		showNextSteps(config, targetDir)
	} catch (error) {
		console.error(chalk.red('\n❌ Setup failed:'), error)
		process.exit(1)
	}
}

async function promptForConfig(): Promise<ProjectConfig> {
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
			type: 'confirm',
			name: 'semanticRelease',
			message: '🚀 Set up semantic release for automated versioning?',
			default: (answers: any) => answers.projectType === 'library',
			when: (answers: any) => answers.projectType === 'library',
		},
		{
			type: 'list',
			name: 'bundler',
			message: '📦 Which bundler/build tool?',
			choices: (answers: any) => {
				const choices = [
					{ name: '📦 tsup (TypeScript packages)', value: 'tsup' },
					{ name: '⚡ esbuild (Fast bundling)', value: 'esbuild' },
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
		semanticRelease: answers.semanticRelease || false,
		bundler: answers.bundler || 'none',
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

	steps.push('📖 Check the generated README.md for more details')

	steps.forEach((step, index) => {
		console.log(`  ${index + 1}. ${step}`)
	})

	console.log(
		chalk.dim('\n💡 All configuration files have been generated in your project directory.')
	)
	console.log(chalk.dim('   You can modify them to suit your specific needs.\n'))
}
