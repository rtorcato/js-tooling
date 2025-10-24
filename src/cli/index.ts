#!/usr/bin/env node

import chalk from 'chalk'
import { Command } from 'commander'
import packageJson from '../../package.json' with { type: 'json' }
import { setupProject } from './commands/setup.js'

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
	.command('list')
	.alias('ls')
	.description('📋 List all available tooling configurations')
	.action(() => {
		console.log(chalk.cyan('\n🛠️  Available tooling configurations:\n'))

		const configs = [
			{ name: 'TypeScript', desc: 'Base, React, Next.js, Node.js, Express configurations' },
			{ name: 'ESLint', desc: 'Base and Next.js ESLint configurations' },
			{ name: 'Biome', desc: 'Fast formatter and linter configuration' },
			{ name: 'Prettier', desc: 'Code formatter configuration' },
			{ name: 'Vitest', desc: 'Testing framework configuration' },
			{ name: 'Jest', desc: 'Testing framework presets for browser and Node.js' },
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
