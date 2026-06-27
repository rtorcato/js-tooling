import fs from 'fs-extra'
import path from 'node:path'
import type { ProjectConfig } from '../commands/setup.js'

export const PRE_PUSH_HOOK_CONTENT = `echo "🔍 Running pre-push verify..."
pnpm verify
STATUS=$?
if [ $STATUS -ne 0 ]; then
  echo "❌ Verify failed — push aborted."
  exit 1
fi
echo "✅ Verify passed — pushing."
`

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

export async function generateHuskyConfig(config: ProjectConfig, targetDir: string) {
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

	// Pre-push hook — only when the package.json already has a `verify` script.
	// In the setup flow, generatePackageJson runs before this and writes verify
	// when 2+ tools are enabled. In the `fix husky` path, a pre-existing verify
	// script is what unlocks the hook.
	const pkgPath = path.join(targetDir, 'package.json')
	if (await fs.pathExists(pkgPath)) {
		const pkg = (await fs.readJson(pkgPath)) as Record<string, unknown>
		const scripts = (pkg.scripts as Record<string, string> | undefined) ?? {}
		if (scripts.verify) {
			await generatePrePushHook(targetDir)
		}
	}

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

	// No explicit `git add` — lint-staged stages tool output itself, and the
	// extra add races its index lock. `--no-errors-on-unmatched` keeps biome
	// from failing a commit when every matched file is biome-ignored.
	const useBiome = config.linting.tool === 'biome' || config.linting.tool === 'both'
	packageJson['lint-staged'] = {
		'*.{js,ts,jsx,tsx}': useBiome ? 'biome check --fix --no-errors-on-unmatched' : 'eslint --fix',
		'*.{json,md,yml,yaml}': useBiome
			? 'biome format --write --no-errors-on-unmatched'
			: 'prettier --write',
	}

	await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 })
}

export async function generatePrePushHook(targetDir: string) {
	const huskyDir = path.join(targetDir, '.husky')
	await fs.ensureDir(huskyDir)
	const prePushPath = path.join(huskyDir, 'pre-push')
	await fs.writeFile(prePushPath, PRE_PUSH_HOOK_CONTENT)
	await fs.chmod(prePushPath, 0o755)
}

export async function generateCommitlintConfig(targetDir: string) {
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
