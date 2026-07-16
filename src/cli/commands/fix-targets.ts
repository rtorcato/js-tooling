import type { Lockfile } from '../utils/lockfile.js'
import type { ProjectConfig } from './setup.js'

export const FIX_TARGETS: Record<string, string> = {
	'package.json': 'package-json',
	'engines.node': 'engines',
	EditorConfig: 'editorconfig',
	'VS Code extensions': 'vscode-extensions',
	'Node version pin': 'nvmrc',
	'Node version consistency': 'node-version',
	TypeScript: 'tsconfig',
	Biome: 'biome',
	ESLint: 'eslint',
	Prettier: 'prettier',
	Vitest: 'vitest',
	Commitlint: 'commitlint',
	Husky: 'husky',
	'lint-staged': 'husky',
	'Husky pre-push': 'husky',
	'verify script': 'verify',
	'semantic-release': 'semantic-release',
	knip: 'knip',
	'size-limit': 'size-limit',
	'Tree-shake check': 'treeshake-check',
	'GitHub Actions': 'github-actions',
	'Coverage upload': 'github-actions',
	Dependabot: 'dependabot',
	CodeQL: 'codeql',
	CODEOWNERS: 'codeowners',
	'GitLab CI': 'gitlab-ci',
	'Branch protection': 'github-settings',
	'Merge settings': 'github-settings',
	'Workflow permissions': 'github-settings',
	Turborepo: 'turborepo',
	Tailwind: 'tailwind',
	lockfile: 'lockfile',
	'.js-tooling.json': 'lockfile',
	'are-the-types-wrong': 'attw',
	publint: 'publint',
	'README badges': 'badges',
	TypeDoc: 'typedoc',
	'AI setup': 'ai',
}

export function getFixTargetForCheck(checkName: string): string | null {
	return FIX_TARGETS[checkName] ?? null
}

/**
 * For a given doctor check name, returns true when the lockfile records that
 * the user intentionally opted out of the tool that check covers. Used by
 * doctor to demote `optional-missing` to `ok` and by fix to print a conflict
 * warning before overriding the recorded choice.
 */
export function declinedInLock(lock: Lockfile | null, checkName: string): boolean {
	if (!lock) return false
	const c = lock.config
	switch (checkName) {
		case 'TypeScript':
			return c.typescript?.enabled === false
		case 'Biome':
			return c.linting?.tool !== 'biome' && c.linting?.tool !== 'both'
		case 'ESLint':
			return c.linting?.tool !== 'eslint' && c.linting?.tool !== 'both'
		case 'Prettier':
			return c.formatting?.tool !== 'prettier'
		case 'Vitest':
			return c.testing?.framework !== 'vitest'
		case 'Commitlint':
			return c.commitLint === false
		case 'Husky':
		case 'lint-staged':
		case 'Husky pre-push':
			return c.gitHooks === false
		case 'verify script':
			// Verify is derived from other tools; only "declined" if none of typecheck/lint/test are enabled.
			return (
				c.typescript?.enabled === false &&
				c.linting?.tool === 'none' &&
				c.testing?.framework === 'none'
			)
		case 'semantic-release':
			return c.semanticRelease === false
		case 'Dependabot':
		case 'CodeQL':
		// GitHub repo-settings checks (#137) share the securityAutomation opt-out.
		case 'Branch protection':
		case 'Merge settings':
		case 'Workflow permissions':
			return c.securityAutomation === false
		case 'publint':
			return c.publint === false
		case 'README badges':
			return c.badges === false
		case 'AI setup':
			return c.aiSetup === false
		case 'Turborepo':
			return c.turborepo === false
		case 'Tailwind':
			return c.tailwind === false
		default:
			return false
	}
}

/**
 * When a fixer is about to scaffold a tool, return the patch to apply to the
 * lockfile's recorded choices so intent stays in sync with reality. Returns
 * null when the target either doesn't change any recorded choice (e.g. the
 * `verify` fixer is derived, or `engines` writes a universal field) or when
 * the lockfile already reflects the change.
 */
export function lockfilePatchForTarget(
	target: string,
	lock: Lockfile
): Partial<ProjectConfig> | null {
	const c = lock.config
	switch (target) {
		case 'biome':
			if (c.linting.tool === 'biome' || c.linting.tool === 'both') return null
			return {
				linting: { tool: 'biome' },
				formatting: { tool: 'biome' },
			}
		case 'eslint':
			if (c.linting.tool === 'eslint' || c.linting.tool === 'both') return null
			return {
				linting: { tool: 'eslint', eslintConfig: c.linting.eslintConfig ?? 'base' },
				formatting: { tool: 'prettier' },
			}
		case 'prettier':
			if (c.formatting.tool === 'prettier') return null
			return { formatting: { tool: 'prettier' } }
		case 'vitest':
			if (c.testing.framework === 'vitest') return null
			return {
				testing: { framework: 'vitest', environment: c.testing.environment ?? 'node' },
			}
		case 'commitlint':
			return c.commitLint ? null : { commitLint: true }
		case 'husky':
			return c.gitHooks ? null : { gitHooks: true }
		case 'semantic-release':
			return c.semanticRelease ? null : { semanticRelease: true }
		case 'dependabot':
		case 'renovate':
		case 'codeql':
			return c.securityAutomation ? null : { securityAutomation: true }
		case 'tsconfig':
			return c.typescript.enabled ? null : { typescript: { enabled: true, config: 'base' } }
		case 'treeshake-check':
			return c.treeshakeCheck ? null : { treeshakeCheck: true }
		case 'publint':
			return c.publint ? null : { publint: true }
		case 'badges':
			return c.badges ? null : { badges: true }
		case 'ai':
			return c.aiSetup ? null : { aiSetup: true }
		case 'turborepo':
			return c.turborepo ? null : { turborepo: true }
		case 'tailwind':
			return c.tailwind ? null : { tailwind: true }
		default:
			return null
	}
}
