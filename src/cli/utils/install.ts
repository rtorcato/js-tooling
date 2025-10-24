import chalk from 'chalk'
import { spawn } from 'child_process'
import type { ProjectConfig } from '../commands/setup.js'

export async function installDependencies(
	_config: ProjectConfig,
	targetDir: string
): Promise<void> {
	return new Promise((resolve) => {
		console.log(chalk.blue('📦 Installing dependencies with pnpm...'))

		const child = spawn('pnpm', ['install'], {
			cwd: targetDir,
			stdio: 'inherit',
			shell: true,
		})

		child.on('close', (code) => {
			if (code === 0) {
				console.log(chalk.green('✅ Dependencies installed successfully!'))
				resolve()
			} else {
				console.error(chalk.red(`❌ pnpm install failed with code ${code}`))
				console.log(chalk.yellow('💡 You can install dependencies manually with: pnpm install'))
				resolve() // Don't reject, just warn
			}
		})

		child.on('error', (error) => {
			console.error(chalk.red('❌ Error running pnpm install:'), error.message)
			console.log(chalk.yellow('💡 You can install dependencies manually with: pnpm install'))
			resolve() // Don't reject, just warn
		})
	})
}
