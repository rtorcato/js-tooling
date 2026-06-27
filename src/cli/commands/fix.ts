import path from 'node:path'
import os from 'node:os'
import chalk from 'chalk'
import { createPatch } from 'diff'
import fs from 'fs-extra'
import inquirer from 'inquirer'
import { generateSemanticReleaseConfig } from '../generators/build.js'
import {
	generateCommitlintConfig,
	generateHuskyConfig,
	generatePrePushHook,
} from '../generators/git.js'
import { generateGitHubActions } from '../generators/github-actions.js'
import { generateGitLabCI } from '../generators/gitlab-ci.js'
import { generateESLintConfig, generatePrettierConfig } from '../generators/linting.js'
import {
	ensureEnginesNode,
	generateCodeowners,
	generateEditorConfig,
	generateKnipConfig,
	generateNvmrc,
	generateSizeLimitConfig,
} from '../generators/misc.js'
import { generateConfigs } from '../generators/index.js'
import { composeVerifyScriptFromPkg } from '../generators/package-json.js'
import {
	generateCodeQLWorkflow,
	generateDependabotConfig,
	generateRenovateConfig,
} from '../generators/security.js'
import { generateVitestConfig } from '../generators/testing.js'
import { generateTreeshakeCheck, inferSubpathsFromExports } from '../generators/treeshake.js'
import { generateTypedocConfig, generateTypedocWorkflow } from '../generators/typedoc.js'
import { copyPreset } from '../utils/copy-preset.js'
import {
	type Lockfile,
	LOCKFILE_NAME,
	readLockfile,
	updateLockfileConfig,
	writeLockfile,
} from '../utils/lockfile.js'
import type { CheckResult } from './doctor.js'
import { runDoctor } from './doctor.js'
import { declinedInLock, lockfilePatchForTarget } from './fix-targets.js'
import { computeFileList } from './setup-presets.js'
import type { ProjectConfig } from './setup.js'

export interface FixOptions {
	directory?: string
	yes?: boolean
	dryRun?: boolean
	json?: boolean
	list?: boolean
	resync?: boolean
	diff?: boolean
}

export type FixActionStatus = 'applied' | 'dry-run' | 'skipped' | 'already-ok' | 'unsupported'

export interface FixActionRecord {
	target: string | null
	check: string
	status: FixActionStatus
	doctorStatus: CheckResult['status']
	filesWritten: string[]
	lockfileConflict?: boolean
}

export interface FixJsonResult {
	directory: string
	target: string | null
	actions: FixActionRecord[]
}

type Pkg = Record<string, unknown> | null

export interface FixerContext {
	targetDir: string
	pkg: Pkg
	result: CheckResult
	lock: Lockfile | null
}

export type FixRiskLevel = 'destructive' | 'safe-merge' | 'safe-add'

export interface Fixer {
	target: string
	description: string
	appliesTo: string[]
	outputs: string[]
	/**
	 * - destructive (default): overwrites the target file
	 * - safe-merge: modifies an existing file without replacing user values
	 * - safe-add: only writes when the target file doesn't yet exist
	 */
	riskLevel?: FixRiskLevel
	canFixDrift?: boolean
	run(ctx: FixerContext): Promise<{ filesWritten: string[] }>
}

function inferProjectConfig(pkg: Pkg): ProjectConfig {
	const deps = {
		...((pkg?.dependencies as Record<string, string> | undefined) ?? {}),
		...((pkg?.devDependencies as Record<string, string> | undefined) ?? {}),
	}
	let projectType: ProjectConfig['projectType'] = 'library'
	if (deps.next) projectType = 'nextjs-app'
	else if (deps['react-dom']) projectType = 'react-app'

	return {
		projectName: (pkg?.name as string) ?? 'project',
		projectType,
		typescript: { enabled: true, config: projectType === 'nextjs-app' ? 'next' : 'base' },
		linting: {
			tool: 'biome',
			eslintConfig: projectType === 'nextjs-app' ? 'nextjs' : 'base',
		},
		formatting: { tool: 'biome' },
		testing: { framework: 'vitest', environment: 'node' },
		gitHooks: true,
		commitLint: true,
		semanticRelease: pkg?.private !== true,
		securityAutomation: true,
		bundler: 'tsup',
	}
}

async function readPackageJson(dir: string): Promise<Pkg> {
	const filepath = path.join(dir, 'package.json')
	if (!(await fs.pathExists(filepath))) return null
	try {
		return (await fs.readJson(filepath)) as Pkg
	} catch {
		return null
	}
}

/** True when any (possibly nested) exports condition declares a `require`/CJS entry. */
function hasRequireCondition(exports: unknown): boolean {
	if (!exports || typeof exports !== 'object') return false
	for (const value of Object.values(exports as Record<string, unknown>)) {
		if (value && typeof value === 'object') {
			if ('require' in value) return true
			if (hasRequireCondition(value)) return true
		}
	}
	return false
}

/** ESM-only = `"type": "module"` and no CJS/`require` resolution in exports. */
function isEsmOnly(pkg: Record<string, unknown>): boolean {
	return pkg.type === 'module' && !hasRequireCondition(pkg.exports)
}

const FIXERS: Fixer[] = [
	{
		target: 'biome',
		description: 'Scaffold biome.json extending the @rtorcato/js-tooling preset',
		appliesTo: ['Biome'],
		outputs: ['biome.json'],
		canFixDrift: true,
		async run({ targetDir }) {
			const result = await copyPreset('biome', targetDir)
			return { filesWritten: [result.target] }
		},
	},
	{
		target: 'tsconfig',
		description: 'Scaffold tsconfig.json extending the @rtorcato/js-tooling preset',
		appliesTo: ['TypeScript'],
		outputs: ['tsconfig.json'],
		canFixDrift: true,
		async run({ targetDir }) {
			const result = await copyPreset('tsconfig', targetDir)
			return { filesWritten: [result.target] }
		},
	},
	{
		target: 'eslint',
		description: 'Scaffold eslint.config.mjs importing the @rtorcato/js-tooling preset',
		appliesTo: ['ESLint'],
		outputs: ['eslint.config.mjs'],
		canFixDrift: true,
		async run({ targetDir, pkg }) {
			await generateESLintConfig(inferProjectConfig(pkg), targetDir)
			return { filesWritten: ['eslint.config.mjs'] }
		},
	},
	{
		target: 'prettier',
		description: 'Scaffold prettier.config.mjs re-exporting the preset',
		appliesTo: ['Prettier'],
		outputs: ['prettier.config.mjs'],
		canFixDrift: true,
		async run({ targetDir }) {
			await generatePrettierConfig(targetDir)
			return { filesWritten: ['prettier.config.mjs'] }
		},
	},
	{
		target: 'vitest',
		description: 'Scaffold vitest.config.ts (preserves vitest.setup.ts if present)',
		appliesTo: ['Vitest'],
		outputs: ['vitest.config.ts'],
		canFixDrift: true,
		async run({ targetDir, pkg }) {
			const setupPath = path.join(targetDir, 'vitest.setup.ts')
			const hadSetup = await fs.pathExists(setupPath)
			const savedSetup = hadSetup ? await fs.readFile(setupPath, 'utf-8') : null
			await generateVitestConfig(inferProjectConfig(pkg), targetDir)
			if (hadSetup && savedSetup !== null) {
				await fs.writeFile(setupPath, savedSetup)
			}
			return { filesWritten: ['vitest.config.ts'] }
		},
	},
	{
		target: 'commitlint',
		description: 'Scaffold commitlint.config.mjs exporting the preset',
		appliesTo: ['Commitlint'],
		outputs: ['commitlint.config.mjs'],
		canFixDrift: true,
		async run({ targetDir }) {
			await generateCommitlintConfig(targetDir)
			return { filesWritten: ['commitlint.config.mjs'] }
		},
	},
	{
		target: 'husky',
		description: 'Set up Husky + lint-staged (and a `pnpm verify` pre-push hook)',
		appliesTo: ['Husky', 'lint-staged', 'Husky pre-push'],
		outputs: ['.husky/pre-commit', '.husky/pre-push', 'package.json (lint-staged field)'],
		riskLevel: 'safe-merge',
		canFixDrift: true,
		async run({ targetDir, pkg }) {
			const pkgPath = path.join(targetDir, 'package.json')
			const existingLintStaged = (pkg?.['lint-staged'] as Record<string, unknown> | undefined) ?? {}
			await generateHuskyConfig(inferProjectConfig(pkg), targetDir)
			const updated = (await fs.readJson(pkgPath)) as Record<string, unknown>
			const generated = (updated['lint-staged'] as Record<string, unknown> | undefined) ?? {}
			updated['lint-staged'] = { ...generated, ...existingLintStaged }
			await fs.writeJson(pkgPath, updated, { spaces: 2 })
			const filesWritten = ['.husky/pre-commit', 'package.json']
			const scripts = (updated.scripts as Record<string, string> | undefined) ?? {}
			if (scripts.verify) {
				await generatePrePushHook(targetDir)
				filesWritten.push('.husky/pre-push')
			}
			return { filesWritten }
		},
	},
	{
		target: 'verify',
		description: 'Add a unified `verify` script (typecheck && lint && tests) to package.json',
		appliesTo: ['verify script'],
		outputs: ['package.json (scripts.verify)'],
		riskLevel: 'safe-merge',
		canFixDrift: true,
		async run({ targetDir, pkg }) {
			const pkgPath = path.join(targetDir, 'package.json')
			if (!pkg) {
				console.log(chalk.yellow('   no package.json found — skipping'))
				return { filesWritten: [] }
			}
			const includeTreeshake = await fs.pathExists(
				path.join(targetDir, 'apps', 'treeshake-check', 'check.mjs')
			)
			const verify = composeVerifyScriptFromPkg(pkg, { includeTreeshake })
			if (!verify) {
				console.log(
					chalk.gray(
						'   not enough tools enabled to compose a verify chain — skipping (need 2+ of typecheck/lint/tests)'
					)
				)
				return { filesWritten: [] }
			}
			const updated = { ...pkg }
			const scripts = { ...((updated.scripts as Record<string, string> | undefined) ?? {}) }
			scripts.verify = verify
			if (includeTreeshake && !scripts.treeshake) {
				scripts.treeshake = 'pnpm --filter=*treeshake-check run check'
				if (!scripts.pretreeshake) {
					scripts.pretreeshake = scripts.build ? 'pnpm build' : 'echo "no build step"'
				}
			}
			updated.scripts = scripts
			await fs.writeJson(pkgPath, updated, { spaces: 2 })
			return { filesWritten: ['package.json'] }
		},
	},
	{
		target: 'semantic-release',
		description: 'Scaffold release.config.mjs (skipped on private packages)',
		appliesTo: ['semantic-release'],
		outputs: ['release.config.mjs'],
		canFixDrift: true,
		async run({ targetDir, pkg }) {
			if (pkg?.private === true) {
				console.log(chalk.gray('   skipping — package is private'))
				return { filesWritten: [] }
			}
			await generateSemanticReleaseConfig(targetDir)
			return { filesWritten: ['release.config.mjs'] }
		},
	},
	{
		target: 'changesets',
		description: 'Scaffold .changeset/config.json (alternative to semantic-release)',
		appliesTo: ['Changesets'],
		outputs: ['.changeset/config.json'],
		canFixDrift: true,
		async run({ targetDir }) {
			const result = await copyPreset('changesets', targetDir)
			return { filesWritten: [result.target] }
		},
	},
	{
		target: 'oxlint',
		description: 'Scaffold .oxlintrc.json (additive to Biome/ESLint)',
		appliesTo: ['Oxlint'],
		outputs: ['.oxlintrc.json'],
		canFixDrift: true,
		async run({ targetDir }) {
			const result = await copyPreset('oxlint', targetDir)
			return { filesWritten: [result.target] }
		},
	},
	{
		target: 'github-actions',
		description: 'Scaffold .github/workflows/ci.yml',
		appliesTo: ['GitHub Actions'],
		outputs: ['.github/workflows/ci.yml'],
		canFixDrift: true,
		async run({ targetDir, pkg }) {
			await generateGitHubActions(inferProjectConfig(pkg), targetDir)
			return { filesWritten: ['.github/workflows/ci.yml'] }
		},
	},
	{
		target: 'dependabot',
		description: 'Scaffold .github/dependabot.yml (weekly npm + actions updates)',
		appliesTo: ['Dependabot'],
		outputs: ['.github/dependabot.yml'],
		async run({ targetDir }) {
			await generateDependabotConfig(targetDir)
			return { filesWritten: ['.github/dependabot.yml'] }
		},
	},
	{
		target: 'renovate',
		description: 'Scaffold renovate.json (weekly schedule; alternative to Dependabot)',
		appliesTo: ['Dependabot'],
		outputs: ['renovate.json'],
		riskLevel: 'safe-add',
		async run({ targetDir }) {
			await generateRenovateConfig(targetDir)
			return { filesWritten: ['renovate.json'] }
		},
	},
	{
		target: 'codeql',
		description: 'Scaffold .github/workflows/codeql.yml (security scanning)',
		appliesTo: ['CodeQL'],
		outputs: ['.github/workflows/codeql.yml'],
		async run({ targetDir }) {
			await generateCodeQLWorkflow(targetDir)
			return { filesWritten: ['.github/workflows/codeql.yml'] }
		},
	},
	{
		target: 'codeowners',
		description: 'Scaffold .github/CODEOWNERS with commented examples',
		appliesTo: ['CODEOWNERS'],
		outputs: ['.github/CODEOWNERS'],
		riskLevel: 'safe-add',
		canFixDrift: false,
		async run({ targetDir }) {
			const written = await generateCodeowners(targetDir)
			return { filesWritten: [written] }
		},
	},
	{
		target: 'gitlab-ci',
		description: 'Scaffold .gitlab-ci.yml (lint/typecheck/test/build mirrored from GitHub Actions)',
		appliesTo: ['GitLab CI'],
		outputs: ['.gitlab-ci.yml'],
		canFixDrift: true,
		async run({ targetDir, pkg }) {
			const written = await generateGitLabCI(inferProjectConfig(pkg), targetDir)
			return { filesWritten: [written] }
		},
	},
	{
		target: 'editorconfig',
		description: 'Scaffold .editorconfig (UTF-8, LF, tab indent)',
		appliesTo: ['EditorConfig'],
		outputs: ['.editorconfig'],
		canFixDrift: true,
		async run({ targetDir }) {
			await generateEditorConfig(targetDir)
			return { filesWritten: ['.editorconfig'] }
		},
	},
	{
		target: 'nvmrc',
		description: 'Scaffold .nvmrc pinned to Node 22',
		appliesTo: ['Node version pin'],
		outputs: ['.nvmrc'],
		canFixDrift: true,
		async run({ targetDir }) {
			await generateNvmrc(targetDir)
			return { filesWritten: ['.nvmrc'] }
		},
	},
	{
		target: 'engines',
		description: 'Add engines.node to package.json',
		appliesTo: ['engines.node'],
		outputs: ['package.json (engines.node field)'],
		riskLevel: 'safe-merge',
		canFixDrift: true,
		async run({ targetDir }) {
			const result = await ensureEnginesNode(targetDir)
			return { filesWritten: result === 'added' ? ['package.json'] : [] }
		},
	},
	{
		target: 'knip',
		description: 'Scaffold knip.json with default entry/project globs',
		appliesTo: ['knip'],
		outputs: ['knip.json'],
		canFixDrift: true,
		async run({ targetDir }) {
			await generateKnipConfig(targetDir)
			return { filesWritten: ['knip.json'] }
		},
	},
	{
		target: 'size-limit',
		description:
			'Scaffold .size-limit.json with a default 10 kB budget (customize per-subpath for libraries)',
		appliesTo: ['size-limit'],
		outputs: ['.size-limit.json'],
		canFixDrift: true,
		async run({ targetDir }) {
			await generateSizeLimitConfig(targetDir)
			return { filesWritten: ['.size-limit.json'] }
		},
	},
	{
		target: 'treeshake-check',
		description:
			'Scaffold apps/treeshake-check — esbuild + metafile assertion that one subpath bundles cleanly',
		appliesTo: ['Tree-shake check'],
		outputs: [
			'apps/treeshake-check/package.json',
			'apps/treeshake-check/check.mjs',
			'apps/treeshake-check/src/entry.ts',
		],
		riskLevel: 'safe-add',
		canFixDrift: false,
		async run({ targetDir, pkg }) {
			if (!pkg) {
				console.log(chalk.yellow('   no package.json found — skipping'))
				return { filesWritten: [] }
			}
			const workspaceName = (pkg.name as string | undefined) ?? null
			if (!workspaceName) {
				console.log(chalk.yellow('   package.json has no `name` — skipping'))
				return { filesWritten: [] }
			}
			const { allCandidates, defaultAllowed } = inferSubpathsFromExports(pkg)
			if (allCandidates.length < 2 || !defaultAllowed) {
				console.log(
					chalk.yellow(
						'   package.json does not expose ≥2 subpath exports — tree-shake check needs multiple subpaths to be meaningful. Skipping.'
					)
				)
				return { filesWritten: [] }
			}
			const allowedSubpath = defaultAllowed
			const forbiddenSubpaths = allCandidates.filter((s) => s !== allowedSubpath)
			const written = await generateTreeshakeCheck(targetDir, {
				workspaceName,
				allowedSubpath,
				forbiddenSubpaths,
			})
			console.log(
				chalk.dim(
					`   Wired '${allowedSubpath}' as allowed; forbidden = [${forbiddenSubpaths.join(', ')}]. Edit apps/treeshake-check/check.mjs to tune.`
				)
			)
			return { filesWritten: written }
		},
	},
	{
		target: 'typedoc',
		description:
			'Scaffold typedoc.json extending the preset + .github/workflows/docs.yml (GitHub Pages)',
		appliesTo: ['TypeDoc'],
		outputs: ['typedoc.json', '.github/workflows/docs.yml'],
		riskLevel: 'safe-add',
		canFixDrift: true,
		async run({ targetDir, pkg }) {
			await generateTypedocConfig(pkg, targetDir)
			const workflow = await generateTypedocWorkflow(targetDir)
			const pkgPath = path.join(targetDir, 'package.json')
			const filesWritten: string[] = ['typedoc.json', workflow]
			if (await fs.pathExists(pkgPath)) {
				const pkgData = (await fs.readJson(pkgPath)) as Record<string, unknown>
				const scripts = (pkgData.scripts as Record<string, string> | undefined) ?? {}
				if (!scripts.docs) {
					pkgData.scripts = { ...scripts, docs: 'typedoc' }
					await fs.writeJson(pkgPath, pkgData, { spaces: 2 })
					filesWritten.push('package.json')
				}
			}
			return { filesWritten }
		},
	},
	{
		target: 'attw',
		description:
			'Install @arethetypeswrong/cli + add an `attw` script (esm-only profile when applicable) and wire it into verify',
		appliesTo: ['are-the-types-wrong'],
		outputs: ['package.json (devDependencies + scripts.attw)'],
		riskLevel: 'safe-merge',
		canFixDrift: true,
		async run({ targetDir, pkg }) {
			const pkgPath = path.join(targetDir, 'package.json')
			if (!pkg) {
				console.log(chalk.yellow('   no package.json found — skipping'))
				return { filesWritten: [] }
			}
			const updated = { ...pkg }
			const devDeps = {
				...((updated.devDependencies as Record<string, string> | undefined) ?? {}),
			}
			if (!devDeps['@arethetypeswrong/cli']) devDeps['@arethetypeswrong/cli'] = '^0.18.2'
			updated.devDependencies = devDeps

			const scripts = { ...((updated.scripts as Record<string, string> | undefined) ?? {}) }
			scripts.attw = isEsmOnly(pkg) ? 'attw --pack --profile esm-only' : 'attw --pack'
			if (scripts.verify && !/\battw\b/.test(scripts.verify)) {
				scripts.verify = `${scripts.verify} && pnpm attw`
			}
			updated.scripts = scripts

			await fs.writeJson(pkgPath, updated, { spaces: 2 })
			return { filesWritten: ['package.json'] }
		},
	},
	{
		target: 'claude-skill',
		description: 'Install the js-tooling Claude Code skill into .claude/skills/',
		appliesTo: ['Claude skill'],
		outputs: ['.claude/skills/js-tooling.md'],
		riskLevel: 'safe-add',
		canFixDrift: true,
		async run({ targetDir }) {
			const result = await copyPreset('claude-skill', targetDir)
			return { filesWritten: [result.target] }
		},
	},
	{
		target: 'package-json',
		description: 'Add @rtorcato/js-tooling to devDependencies',
		appliesTo: ['package.json'],
		outputs: ['package.json (devDependencies)'],
		riskLevel: 'safe-merge',
		canFixDrift: true,
		async run({ targetDir, pkg }) {
			const pkgPath = path.join(targetDir, 'package.json')
			if (!pkg) {
				console.log(chalk.yellow('   no package.json found — skipping'))
				return { filesWritten: [] }
			}
			const updated = { ...pkg }
			const devDeps = {
				...((updated.devDependencies as Record<string, string> | undefined) ?? {}),
			}
			devDeps['@rtorcato/js-tooling'] = 'latest'
			updated.devDependencies = devDeps
			await fs.writeJson(pkgPath, updated, { spaces: 2 })
			console.log(chalk.dim('   reminder: run `pnpm install` to install the new dep'))
			return { filesWritten: ['package.json'] }
		},
	},
	{
		target: 'lockfile',
		description: `Scaffold ${LOCKFILE_NAME} recording current tool choices`,
		appliesTo: ['lockfile'],
		outputs: [LOCKFILE_NAME],
		riskLevel: 'safe-add',
		canFixDrift: false,
		async run({ targetDir, pkg }) {
			if (!pkg) {
				console.log(chalk.yellow('   no package.json found — skipping'))
				return { filesWritten: [] }
			}
			const config = inferProjectConfig(pkg)
			await writeLockfile(targetDir, config)
			return { filesWritten: [LOCKFILE_NAME] }
		},
	},
]

export function getFixers(): Fixer[] {
	return FIXERS
}

async function ownOutputsPresent(targetDir: string, fixer: Fixer): Promise<boolean> {
	for (const out of fixer.outputs) {
		// Outputs that reference a package.json field (e.g. "package.json (scripts.verify)")
		// can't be cheaply file-checked here; treat as present so we don't accidentally
		// re-run safe-merge fixers on every targeted invocation.
		if (out.includes('(')) return true
		if (await fs.pathExists(path.join(targetDir, out))) return true
	}
	return false
}

function findFixer(target: string): Fixer | undefined {
	const normalized = target.toLowerCase()
	return FIXERS.find((f) => f.target.toLowerCase() === normalized)
}

function findFixerForCheck(checkName: string): Fixer | undefined {
	return FIXERS.find((f) => f.appliesTo.includes(checkName))
}

function logTargets() {
	console.log(chalk.gray('Available fix targets:'))
	for (const f of FIXERS) {
		console.log(`  ${chalk.green('●')} ${chalk.bold(f.target)}: ${chalk.gray(f.description)}`)
	}
}

export interface FixerSummary {
	target: string
	description: string
	appliesTo: string[]
	outputs: string[]
	riskLevel: FixRiskLevel
	canFixDrift: boolean
}

export function listFixers(): FixerSummary[] {
	return FIXERS.map((f) => ({
		target: f.target,
		description: f.description,
		appliesTo: f.appliesTo,
		outputs: f.outputs,
		riskLevel: f.riskLevel ?? 'destructive',
		canFixDrift: f.canFixDrift ?? false,
	}))
}

// Fixer outputs sometimes carry annotations like
// "package.json (lint-staged field)" — strip them to get a usable filesystem path.
function outputToRelativePath(output: string): string {
	return output.split(' ')[0] ?? output
}

function shouldColorise(): boolean {
	// Respect NO_COLOR (https://no-color.org) and chalk's own detection.
	if (process.env.NO_COLOR && process.env.NO_COLOR !== '') return false
	return chalk.level > 0
}

function colorisePatch(patch: string): string {
	if (!shouldColorise()) return patch
	return patch
		.split('\n')
		.map((line) => {
			if (line.startsWith('+++') || line.startsWith('---')) return chalk.bold(line)
			if (line.startsWith('@@')) return chalk.cyan(line)
			if (line.startsWith('+')) return chalk.green(line)
			if (line.startsWith('-')) return chalk.red(line)
			return line
		})
		.join('\n')
}

interface PreviewEntry {
	path: string
	kind: 'create' | 'modify' | 'unchanged'
	patch: string | null
}

/**
 * Shadow-run a fixer in a temp copy of the target directory and return per-output
 * diffs. We copy the real target into tmp so fixers that read existing state
 * (e.g. husky reading package.json) still produce realistic output.
 */
async function previewFixer(
	fixer: Fixer,
	result: CheckResult,
	targetDir: string,
	pkg: Pkg,
	lock: Lockfile | null
): Promise<PreviewEntry[]> {
	// Pick a tmp root that is NOT inside targetDir. macOS sometimes hands us a
	// $TMPDIR that lives under the working dir (e.g. when the caller is itself
	// running inside a tempdir tree), which would make fs.copy fail with
	// "subdirectory of itself". Fall back to the parent of targetDir if so.
	const resolvedTarget = path.resolve(targetDir)
	let tmpRoot = path.resolve(os.tmpdir())
	if (tmpRoot === resolvedTarget || tmpRoot.startsWith(resolvedTarget + path.sep)) {
		tmpRoot = path.dirname(resolvedTarget)
	}
	const tmpDir = await fs.mkdtemp(path.join(tmpRoot, 'js-tooling-fix-preview-'))
	try {
		await fs.copy(targetDir, tmpDir, {
			filter: (src) => {
				const rel = path.relative(targetDir, src)
				if (!rel) return true
				const first = rel.split(path.sep)[0]
				// Skip large/derived dirs that fixers never touch — keeps preview fast on
				// big repos.
				return first !== 'node_modules' && first !== 'dist' && first !== 'build' && first !== '.git'
			},
		})
		await fixer.run({ targetDir: tmpDir, pkg, result, lock })

		const previews: PreviewEntry[] = []
		const seen = new Set<string>()
		for (const output of fixer.outputs) {
			const rel = outputToRelativePath(output)
			if (seen.has(rel)) continue
			seen.add(rel)

			const tmpPath = path.join(tmpDir, rel)
			const realPath = path.join(targetDir, rel)
			if (!(await fs.pathExists(tmpPath))) continue

			const newContent = await fs.readFile(tmpPath, 'utf-8')
			const existed = await fs.pathExists(realPath)
			const oldContent = existed ? await fs.readFile(realPath, 'utf-8') : ''

			if (newContent === oldContent) {
				previews.push({ path: rel, kind: 'unchanged', patch: null })
				continue
			}
			const patch = createPatch(rel, oldContent, newContent, undefined, undefined, { context: 3 })
			previews.push({
				path: rel,
				kind: existed ? 'modify' : 'create',
				patch: colorisePatch(patch),
			})
		}
		return previews
	} finally {
		await fs.remove(tmpDir).catch(() => {
			// Best-effort cleanup; tmp dirs get GC'd by the OS eventually.
		})
	}
}

function printPreviews(previews: PreviewEntry[]): void {
	if (previews.length === 0) {
		console.log(chalk.gray('  (no preview available — fixer produced no recognisable outputs)'))
		return
	}
	for (const p of previews) {
		if (p.kind === 'unchanged') {
			console.log(chalk.gray(`  ${p.path} — unchanged`))
			continue
		}
		const label = p.kind === 'create' ? chalk.green('create') : chalk.yellow('modify')
		console.log(`  ${label} ${chalk.bold(p.path)}`)
		if (p.patch) {
			console.log(
				p.patch
					.split('\n')
					.map((l) => `    ${l}`)
					.join('\n')
			)
		}
	}
}

async function applyFixer(
	fixer: Fixer,
	result: CheckResult,
	targetDir: string,
	pkg: Pkg,
	lock: Lockfile | null,
	dryRun: boolean,
	silent: boolean
): Promise<{ filesWritten: string[]; dryRun: boolean }> {
	if (dryRun) {
		if (!silent) {
			console.log(chalk.cyan(`  [dry-run] would write: ${fixer.outputs.join(', ')}`))
		}
		return { filesWritten: [], dryRun: true }
	}
	const { filesWritten } = await fixer.run({ targetDir, pkg, result, lock })
	if (!silent && filesWritten.length > 0) {
		console.log(chalk.green(`  ✅ wrote ${filesWritten.join(', ')}`))
	}
	// Auto-resync the lockfile when a fix changes a recorded choice.
	if (lock && fixer.target !== 'lockfile') {
		const patch = lockfilePatchForTarget(fixer.target, lock)
		if (patch) {
			const ok = await updateLockfileConfig(targetDir, patch)
			if (ok && !silent) {
				console.log(chalk.dim(`     ↻ ${LOCKFILE_NAME} updated to reflect the new choice`))
			}
		}
	}
	return { filesWritten, dryRun: false }
}

function promptMessageFor(
	fixer: Fixer,
	result: CheckResult
): { message: string; default: boolean } {
	const risk: FixRiskLevel = fixer.riskLevel ?? 'destructive'
	if (risk === 'safe-merge') {
		return { message: `${fixer.description} (existing fields preserved)?`, default: true }
	}
	if (risk === 'safe-add') {
		return { message: `${fixer.description}?`, default: true }
	}
	// destructive
	if (result.status === 'drift') {
		return {
			message: `⚠️  ${fixer.description} — overwrite existing file? user customizations will be lost`,
			default: false,
		}
	}
	return { message: `Apply ${fixer.description}?`, default: true }
}

async function confirmApply(
	fixer: Fixer,
	result: CheckResult,
	assumeYes: boolean
): Promise<boolean> {
	if (assumeYes) return true
	const { message, default: defaultValue } = promptMessageFor(fixer, result)
	const { confirm } = await inquirer.prompt([
		{ type: 'confirm', name: 'confirm', message, default: defaultValue },
	])
	return confirm === true
}

function recordFor(
	target: string | null,
	check: string,
	doctorStatus: CheckResult['status'],
	status: FixActionStatus,
	filesWritten: string[],
	lockfileConflict = false
): FixActionRecord {
	const base: FixActionRecord = { target, check, status, doctorStatus, filesWritten }
	if (lockfileConflict) base.lockfileConflict = true
	return base
}

export async function fixCommand(target: string | undefined, options: FixOptions = {}) {
	const targetDir = path.resolve(options.directory ?? process.cwd())
	const dryRun = options.dryRun === true
	const json = options.json === true
	// JSON mode implies --yes so prompts don't corrupt the output stream.
	const assumeYes = options.yes === true || json
	const silent = json
	// Diff preview is interactive-only — suppress in JSON mode.
	const showDiff = options.diff === true && !json

	if (options.list) {
		const summary = listFixers()
		if (json) {
			console.log(JSON.stringify({ targets: summary }, null, 2))
			return
		}
		console.log(chalk.cyan('\n🔧 Registered fix targets:\n'))
		for (const f of summary) {
			console.log(`  ${chalk.green('●')} ${chalk.bold(f.target)}`)
			console.log(`     ${chalk.gray(f.description)}`)
			console.log(
				`     ${chalk.dim(`risk=${f.riskLevel}, drift=${f.canFixDrift ? 'yes' : 'no'}, outputs=${f.outputs.join(', ')}`)}`
			)
		}
		console.log()
		return
	}

	if (options.resync) {
		if (target) {
			console.error(chalk.red('\n❌ --resync cannot be combined with a [target] argument\n'))
			process.exit(1)
		}
		const resyncLock = await readLockfile(targetDir)
		if (!resyncLock) {
			if (json) {
				console.log(
					JSON.stringify(
						{ directory: targetDir, error: 'no-lockfile', hint: 'run `fix lockfile` first' },
						null,
						2
					)
				)
			} else {
				console.error(
					chalk.red(
						`\n❌ No ${LOCKFILE_NAME} found — run \`fix lockfile\` first to record choices\n`
					)
				)
			}
			process.exit(1)
		}
		const files = computeFileList(resyncLock.config)
		if (!silent) {
			console.log(
				chalk.cyan(`\n🔄 Resync from ${LOCKFILE_NAME} (${files.length} files in scope)\n`)
			)
		}
		if (dryRun) {
			if (json) {
				console.log(
					JSON.stringify({ directory: targetDir, mode: 'resync', dryRun: true, files }, null, 2)
				)
			} else {
				for (const f of files) console.log(chalk.cyan(`  [dry-run] would write: ${f}`))
				console.log()
			}
			return
		}
		if (!assumeYes) {
			const { confirm } = await inquirer.prompt([
				{
					type: 'confirm',
					name: 'confirm',
					message: `Re-scaffold ${files.length} file(s) from ${LOCKFILE_NAME}? Generators preserve existing customizations where possible, but README.md will be rewritten.`,
					default: false,
				},
			])
			if (!confirm) {
				console.log(chalk.gray('   skipped\n'))
				return
			}
		}
		await generateConfigs(resyncLock.config, targetDir)
		await writeLockfile(targetDir, resyncLock.config)
		if (json) {
			console.log(
				JSON.stringify({ directory: targetDir, mode: 'resync', dryRun: false, files }, null, 2)
			)
		} else {
			console.log(chalk.green(`  ✅ resynced ${files.length} file(s)\n`))
		}
		return
	}

	const pkg = await readPackageJson(targetDir)
	const lock = await readLockfile(targetDir)
	const results = await runDoctor(targetDir)
	const actions: FixActionRecord[] = []

	const noteLockConflict = (check: string): boolean => {
		if (!lock) return false
		const conflict = declinedInLock(lock, check)
		if (conflict && !silent) {
			console.log(
				chalk.yellow(
					`  ⚠ ${LOCKFILE_NAME} says this tool was declined — applying anyway will update the lockfile to reflect the new choice.`
				)
			)
		}
		return conflict
	}

	const emitJson = (resolvedTarget: string | null) => {
		const payload: FixJsonResult = { directory: targetDir, target: resolvedTarget, actions }
		console.log(JSON.stringify(payload, null, 2))
	}

	if (target) {
		const fixer = findFixer(target)
		if (!fixer) {
			if (json) {
				console.log(
					JSON.stringify(
						{
							directory: targetDir,
							error: 'unknown-target',
							target,
							available: FIXERS.map((f) => f.target),
						},
						null,
						2
					)
				)
				process.exit(1)
			}
			console.error(chalk.red(`\n❌ Unknown fix target: ${target}\n`))
			logTargets()
			console.log()
			process.exit(1)
		}
		const result =
			results.find((r) => fixer.appliesTo.includes(r.check)) ??
			({ check: fixer.appliesTo[0] ?? fixer.target, status: 'missing', detail: '' } as CheckResult)
		// A check that's `ok` because the lockfile records an opt-out should still be
		// fixable when the user explicitly targets it — treat it as optional-missing
		// so the override + lockfile resync paths run.
		const lockfileDemoted = lock !== null && declinedInLock(lock, result.check)
		// When multiple fixers share a check (e.g. dependabot + renovate both apply to
		// "Dependabot" deps-update coverage), the check can be `ok` from a sibling tool
		// while this fixer's own outputs are still absent. In that case, treat as missing
		// so the targeted scaffold runs.
		const fixerOutputsPresent = await ownOutputsPresent(targetDir, fixer)
		const effectiveResult: CheckResult =
			result.status === 'ok' && (lockfileDemoted || !fixerOutputsPresent)
				? { ...result, status: 'optional-missing' }
				: result
		if (effectiveResult.status === 'ok') {
			actions.push(recordFor(fixer.target, result.check, 'ok', 'already-ok', []))
			if (json) return emitJson(fixer.target)
			console.log(chalk.green(`\n✅ ${result.check} is already configured\n`))
			return
		}
		if (!silent) {
			console.log(
				chalk.cyan(
					`\n🔧 ${fixer.target} — ${chalk.bold(result.check)} is ${effectiveResult.status}\n`
				)
			)
		}
		const conflict = noteLockConflict(result.check)
		if (showDiff && (fixer.riskLevel ?? 'destructive') !== 'safe-add') {
			const previews = await previewFixer(fixer, effectiveResult, targetDir, pkg, lock)
			printPreviews(previews)
		}
		const ok = await confirmApply(fixer, effectiveResult, assumeYes)
		if (!ok) {
			actions.push(
				recordFor(fixer.target, result.check, effectiveResult.status, 'skipped', [], conflict)
			)
			if (json) return emitJson(fixer.target)
			console.log(chalk.gray('   skipped\n'))
			return
		}
		const outcome = await applyFixer(fixer, effectiveResult, targetDir, pkg, lock, dryRun, silent)
		actions.push(
			recordFor(
				fixer.target,
				result.check,
				effectiveResult.status,
				outcome.dryRun ? 'dry-run' : 'applied',
				outcome.filesWritten,
				conflict
			)
		)
		if (json) return emitJson(fixer.target)
		console.log()
		return
	}

	const fixable = results.filter((r) => r.status !== 'ok')
	if (fixable.length === 0) {
		if (json) return emitJson(null)
		console.log(chalk.green('\n✅ All checks pass — nothing to fix\n'))
		return
	}

	if (!silent) {
		console.log(chalk.cyan(`\n🔧 ${fixable.length} item(s) to address\n`))
	}

	let appliedCount = 0
	let skippedCount = 0
	let unsupportedCount = 0

	for (const result of fixable) {
		const fixer = findFixerForCheck(result.check)
		if (!fixer) {
			actions.push(recordFor(null, result.check, result.status, 'unsupported', []))
			if (!silent) console.log(chalk.gray(`  — ${result.check}: no fixer registered`))
			unsupportedCount++
			continue
		}
		if (!silent) {
			console.log(`  ${chalk.bold(result.check)} (${result.status}) → ${fixer.target}`)
		}
		const conflict = noteLockConflict(result.check)
		if (showDiff && (fixer.riskLevel ?? 'destructive') !== 'safe-add') {
			const previews = await previewFixer(fixer, result, targetDir, pkg, lock)
			printPreviews(previews)
		}
		const ok = await confirmApply(fixer, result, assumeYes)
		if (!ok) {
			actions.push(recordFor(fixer.target, result.check, result.status, 'skipped', [], conflict))
			if (!silent) console.log(chalk.gray('    skipped'))
			skippedCount++
			continue
		}
		const outcome = await applyFixer(fixer, result, targetDir, pkg, lock, dryRun, silent)
		actions.push(
			recordFor(
				fixer.target,
				result.check,
				result.status,
				outcome.dryRun ? 'dry-run' : 'applied',
				outcome.filesWritten,
				conflict
			)
		)
		appliedCount++
	}

	if (json) return emitJson(null)

	console.log()
	console.log(
		`  Summary: ${chalk.green(`${appliedCount} applied`)}, ${chalk.gray(`${skippedCount} skipped`)}, ${chalk.yellow(`${unsupportedCount} unsupported`)}\n`
	)
}
