#!/usr/bin/env node

import path from 'node:path'
import chalk from 'chalk'
import { Command } from 'commander'
import fs from 'fs-extra'
import packageJson from '../../package.json' with { type: 'json' }
import { doctorCommand } from './commands/doctor.js'
import { fixCommand } from './commands/fix.js'
import { setupProject } from './commands/setup.js'
import { copyPreset, PRESETS, type PresetName } from './utils/copy-preset.js'

async function isSelfRepo(dir: string): Promise<boolean> {
	try {
		const pkg = await fs.readJson(path.join(dir, 'package.json'))
		return pkg.name === '@rtorcato/js-tooling'
	} catch {
		return false
	}
}

const program = new Command()

program
	.name('@rtorcato/js-tooling')
	.description('🛠️  JavaScript and TypeScript tooling setup for modern projects')
	.version(packageJson.version)

program
	.command('setup')
	.alias('init')
	.description('🚀 Setup tooling for a new or existing project')
	.option('-d, --directory <path>', 'Target directory for setup', process.cwd())
	.option('--skip-install', 'Skip installing dependencies')
	.option('--preset <name>', 'Skip prompts; use defaults for a project type')
	.option('--config <path>', 'Skip prompts; read a JSON ProjectConfig from <path>')
	.option('--dry-run', 'Print the resolved config and file list, write nothing')
	.option('--config-schema', 'Print the JSON Schema for ProjectConfig and exit')
	.action(setupProject)

program
	.command('copy <config>')
	.description('📋 Copy a specific configuration file to current directory')
	.action(async (config: string) => {
		if (!(config in PRESETS)) {
			console.error(chalk.red(`\n❌ Unknown configuration: ${config}`))
			console.log(chalk.gray('Available configurations:'))
			for (const [key, { desc }] of Object.entries(PRESETS)) {
				console.log(`  ${chalk.green('●')} ${chalk.bold(key)}: ${chalk.gray(desc)}`)
			}
			console.log()
			process.exit(1)
		}

		try {
			const result = await copyPreset(config as PresetName)
			console.log(chalk.green(`\n✅ Copied ${result.desc}`))
			console.log(chalk.gray(`   From: ${result.source}`))
			console.log(chalk.gray(`   To:   ${result.target}\n`))
		} catch (error) {
			console.error(chalk.red(`\n❌ Error copying configuration: ${error}\n`))
		}
	})

interface ToolCatalogEntry {
	name: string
	description: string
	exports: string[]
	fixTarget: string | null
}

const TOOL_CATALOG: ToolCatalogEntry[] = [
	{
		name: 'TypeScript',
		description: 'Base, React, Next.js, Node.js, Express tsconfig presets',
		exports: [
			'@rtorcato/js-tooling/typescript/base',
			'@rtorcato/js-tooling/typescript/react',
			'@rtorcato/js-tooling/typescript/next',
			'@rtorcato/js-tooling/typescript/node',
			'@rtorcato/js-tooling/typescript/express',
			'@rtorcato/js-tooling/typescript/test',
			'@rtorcato/js-tooling/typescript/reset',
		],
		fixTarget: 'tsconfig',
	},
	{
		name: 'ESLint',
		description: 'Base and Next.js ESLint configurations',
		exports: ['@rtorcato/js-tooling/eslint/base', '@rtorcato/js-tooling/eslint/nextjs'],
		fixTarget: 'eslint',
	},
	{
		name: 'Biome',
		description: 'Fast formatter and linter configuration',
		exports: ['@rtorcato/js-tooling/biome'],
		fixTarget: 'biome',
	},
	{
		name: 'Prettier',
		description: 'Code formatter configuration',
		exports: ['@rtorcato/js-tooling/prettier'],
		fixTarget: 'prettier',
	},
	{
		name: 'Vitest',
		description: 'Testing framework configuration',
		exports: [
			'@rtorcato/js-tooling/vitest/config',
			'@rtorcato/js-tooling/vitest/react',
			'@rtorcato/js-tooling/vitest/setup',
		],
		fixTarget: 'vitest',
	},
	{
		name: 'Jest',
		description: 'Testing framework presets for browser and Node.js',
		exports: [
			'@rtorcato/js-tooling/jest-presets/browser/jest-preset',
			'@rtorcato/js-tooling/jest-presets/node/jest-preset',
		],
		fixTarget: null,
	},
	{
		name: 'Playwright',
		description: 'End-to-end testing configuration',
		exports: ['@rtorcato/js-tooling/playwright'],
		fixTarget: null,
	},
	{
		name: 'Commitlint',
		description: 'Conventional commit linting',
		exports: ['@rtorcato/js-tooling/commitlint/config'],
		fixTarget: 'commitlint',
	},
	{
		name: 'Husky',
		description: 'Git hooks for pre-commit validation',
		exports: [],
		fixTarget: 'husky',
	},
	{
		name: 'lint-staged',
		description: 'Run linters on staged files (pairs with Husky)',
		exports: [],
		fixTarget: 'husky',
	},
	{
		name: 'Semantic Release',
		description: 'Automated versioning and publishing',
		exports: [
			'@rtorcato/js-tooling/semantic-release',
			'@rtorcato/js-tooling/semantic-release/github',
			'@rtorcato/js-tooling/semantic-release/docker',
		],
		fixTarget: 'semantic-release',
	},
	{
		name: 'tsup',
		description: 'TypeScript bundler configuration',
		exports: ['@rtorcato/js-tooling/tsup'],
		fixTarget: null,
	},
	{
		name: 'esbuild',
		description: 'Fast JavaScript bundler configuration',
		exports: ['@rtorcato/js-tooling/esbuild'],
		fixTarget: null,
	},
	{
		name: 'Vite',
		description: 'Modern web app build tool configuration',
		exports: ['@rtorcato/js-tooling/vite'],
		fixTarget: null,
	},
	{
		name: 'EditorConfig',
		description: 'Cross-editor formatting consistency (.editorconfig)',
		exports: [],
		fixTarget: 'editorconfig',
	},
	{
		name: '.nvmrc',
		description: 'Pin Node version per repository',
		exports: [],
		fixTarget: 'nvmrc',
	},
	{
		name: 'knip',
		description: 'Find unused files, exports, and dependencies',
		exports: [],
		fixTarget: 'knip',
	},
	{
		name: 'Dependabot',
		description: 'Weekly automated dependency updates',
		exports: [],
		fixTarget: 'dependabot',
	},
	{
		name: 'CodeQL',
		description: 'GitHub security scanning workflow',
		exports: [],
		fixTarget: 'codeql',
	},
]

program
	.command('list')
	.alias('ls')
	.description('📋 List all available tooling configurations')
	.option('--json', 'Emit machine-readable JSON output')
	.action((options: { json?: boolean }) => {
		if (options.json) {
			console.log(JSON.stringify({ tools: TOOL_CATALOG }, null, 2))
			return
		}

		console.log(chalk.cyan('\n🛠️  Available tooling configurations:\n'))
		for (const { name, description } of TOOL_CATALOG) {
			console.log(`  ${chalk.green('●')} ${chalk.bold(name)}: ${chalk.gray(description)}`)
		}
		console.log(chalk.dim('\n💡 Run `js-tooling setup` for a new project'))
		console.log(chalk.dim('   or `js-tooling fix` to apply missing pieces to an existing one\n'))
	})

program
	.command('doctor')
	.description('🩺 Diagnose project alignment with @rtorcato/js-tooling presets')
	.option('-d, --directory <path>', 'Target directory to diagnose', process.cwd())
	.option('--json', 'Emit machine-readable JSON output')
	.action(doctorCommand)

program
	.command('fix [target]')
	.description('🔧 Apply scaffolders for items doctor flagged')
	.option('-d, --directory <path>', 'Target directory', process.cwd())
	.option('--yes', 'Assume yes to all prompts (including drift overwrites)')
	.option('--dry-run', 'Print what would change without writing files')
	.option('--json', 'Emit machine-readable JSON output (implies --yes)')
	.action((target: string | undefined, options) =>
		fixCommand(target, {
			directory: options.directory,
			yes: options.yes,
			dryRun: options.dryRun,
			json: options.json,
		})
	)

program.hook('preAction', async (_, actionCommand) => {
	const name = actionCommand.name()
	if (name === 'setup' || name === 'doctor' || name === 'fix') {
		const dir = (actionCommand.opts().directory as string | undefined) ?? process.cwd()
		if (await isSelfRepo(dir)) {
			console.log(
				chalk.yellow(
					'\n⚠️  This command cannot be run inside the @rtorcato/js-tooling repo itself.\n'
				)
			)
			console.log(
				chalk.gray('   setup and doctor are for consumer projects, not for the tooling repo.\n')
			)
			process.exit(0)
		}
	}
})

// Handle unknown commands
program.on('command:*', () => {
	console.error(chalk.red(`\n❌ Unknown command: ${program.args.join(' ')}`))
	console.log(chalk.gray('See --help for a list of available commands.\n'))
	process.exit(1)
})

// Show help if no arguments
if (!process.argv.slice(2).length) {
	program.outputHelp()
}

program.parse()
