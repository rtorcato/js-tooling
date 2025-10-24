import fs from 'fs-extra'
import path from 'node:path'
import type { ProjectConfig } from '../commands/setup.js'

export async function generateGitConfigs(config: ProjectConfig, targetDir: string) {
	if (config.gitHooks) {
		await generateHuskyConfig(config, targetDir)
	}

	if (config.commitLint) {
		await generateCommitlintConfig(targetDir)
	}

	// Generate .gitignore
	await generateGitignore(config, targetDir)
}

async function generateHuskyConfig(config: ProjectConfig, targetDir: string) {
	const huskyDir = path.join(targetDir, '.husky')
	await fs.ensureDir(huskyDir)

	// Pre-commit hook
	const preCommitPath = path.join(huskyDir, 'pre-commit')
	const preCommitContent = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
`
	await fs.writeFile(preCommitPath, preCommitContent)
	await fs.chmod(preCommitPath, 0o755)

	// Commit-msg hook (if commitlint is enabled)
	if (config.commitLint) {
		const commitMsgPath = path.join(huskyDir, 'commit-msg')
		const commitMsgContent = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx --no -- commitlint --edit $1
`
		await fs.writeFile(commitMsgPath, commitMsgContent)
		await fs.chmod(commitMsgPath, 0o755)
	}

	// lint-staged configuration in package.json
	const packageJsonPath = path.join(targetDir, 'package.json')
	const packageJson = await fs.readJson(packageJsonPath)

	packageJson['lint-staged'] = {
		'*.{js,ts,jsx,tsx}': [
			config.linting.tool === 'biome' || config.linting.tool === 'both'
				? 'biome check --fix'
				: 'eslint --fix',
			'git add',
		],
		'*.{json,md,yml,yaml}': [
			config.linting.tool === 'biome' || config.linting.tool === 'both'
				? 'biome format --write'
				: 'prettier --write',
			'git add',
		],
	}

	await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 })
}

async function generateCommitlintConfig(targetDir: string) {
	const commitlintConfigPath = path.join(targetDir, 'commitlint.config.mjs')

	const commitlintConfig = `export { default } from '@rtorcato/js-tooling/commitlint/config'
`

	await fs.writeFile(commitlintConfigPath, commitlintConfig)
}

async function generateGitignore(config: ProjectConfig, targetDir: string) {
	const gitignorePath = path.join(targetDir, '.gitignore')

	let gitignoreContent = `# Dependencies
node_modules/
.pnpm-store

# Build outputs
dist/
build/
out/

# Environment files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# TypeScript
*.tsbuildinfo
`

	// Add framework-specific ignores
	if (config.projectType === 'nextjs-app') {
		gitignoreContent += `
# Next.js
.next/
.vercel
`
	}

	if (config.bundler === 'vite') {
		gitignoreContent += `
# Vite
.vite/
`
	}

	if (config.testing.framework === 'playwright') {
		gitignoreContent += `
# Playwright
/test-results/
/playwright-report/
/playwright/.cache/
`
	}

	await fs.writeFile(gitignorePath, gitignoreContent)
}
