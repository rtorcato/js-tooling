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

program
	.command('list')
	.alias('ls')
	.description('📋 List all available tooling configurations')
	.action(() => {
		console.log(chalk.cyan('\n🛠️  Available tooling configurations:\n'))

		const configs = [
			{
				name: 'TypeScript',
				desc: 'Base, React, Next.js, Node.js, Express configurations',
			},
			{ name: 'ESLint', desc: 'Base and Next.js ESLint configurations' },
			{ name: 'Biome', desc: 'Fast formatter and linter configuration' },
			{ name: 'Prettier', desc: 'Code formatter configuration' },
			{ name: 'Vitest', desc: 'Testing framework configuration' },
			{
				name: 'Jest',
				desc: 'Testing framework presets for browser and Node.js',
			},
			{ name: 'Playwright', desc: 'End-to-end testing configuration' },
			{ name: 'Commitlint', desc: 'Conventional commit linting' },
			{ name: 'Husky', desc: 'Git hooks for pre-commit validation' },
			{ name: 'Semantic Release', desc: 'Automated versioning and publishing' },
			{ name: 'tsup', desc: 'TypeScript bundler configuration' },
			{ name: 'esbuild', desc: 'Fast JavaScript bundler configuration' },
		]

		configs.forEach(({ name, desc }) => {
			console.log(`  ${chalk.green('●')} ${chalk.bold(name)}: ${chalk.gray(desc)}`)
		})

		console.log(chalk.dim('\n💡 Run "js-tooling setup" to configure your project\n'))
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
	.action((target: string | undefined, options) =>
		fixCommand(target, {
			directory: options.directory,
			yes: options.yes,
			dryRun: options.dryRun,
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
