import path from 'node:path'
import chalk from 'chalk'
import fs from 'fs-extra'
import inquirer from 'inquirer'
import { generateSemanticReleaseConfig } from '../generators/build.js'
import { generateCommitlintConfig, generateHuskyConfig } from '../generators/git.js'
import { generateGitHubActions } from '../generators/github-actions.js'
import { generateESLintConfig, generatePrettierConfig } from '../generators/linting.js'
import {
	ensureEnginesNode,
	generateEditorConfig,
	generateKnipConfig,
	generateNvmrc,
} from '../generators/misc.js'
import { generateCodeQLWorkflow, generateDependabotConfig } from '../generators/security.js'
import { generateVitestConfig } from '../generators/testing.js'
import { copyPreset } from '../utils/copy-preset.js'
import type { CheckResult } from './doctor.js'
import { runDoctor } from './doctor.js'
import type { ProjectConfig } from './setup.js'

export interface FixOptions {
	directory?: string
	yes?: boolean
	dryRun?: boolean
	json?: boolean
}

export type FixActionStatus = 'applied' | 'dry-run' | 'skipped' | 'already-ok' | 'unsupported'

export interface FixActionRecord {
	target: string | null
	check: string
	status: FixActionStatus
	doctorStatus: CheckResult['status']
	filesWritten: string[]
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
		description: 'Set up Husky + lint-staged',
		appliesTo: ['Husky', 'lint-staged'],
		outputs: ['.husky/pre-commit', 'package.json (lint-staged field)'],
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
			return { filesWritten: ['.husky/pre-commit', 'package.json'] }
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
]

export function getFixers(): Fixer[] {
	return FIXERS
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

async function applyFixer(
	fixer: Fixer,
	result: CheckResult,
	targetDir: string,
	pkg: Pkg,
	dryRun: boolean,
	silent: boolean
): Promise<{ filesWritten: string[]; dryRun: boolean }> {
	if (dryRun) {
		if (!silent) {
			console.log(chalk.cyan(`  [dry-run] would write: ${fixer.outputs.join(', ')}`))
		}
		return { filesWritten: [], dryRun: true }
	}
	const { filesWritten } = await fixer.run({ targetDir, pkg, result })
	if (!silent && filesWritten.length > 0) {
		console.log(chalk.green(`  ✅ wrote ${filesWritten.join(', ')}`))
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
	filesWritten: string[]
): FixActionRecord {
	return { target, check, status, doctorStatus, filesWritten }
}

export async function fixCommand(target: string | undefined, options: FixOptions = {}) {
	const targetDir = path.resolve(options.directory ?? process.cwd())
	const dryRun = options.dryRun === true
	const json = options.json === true
	// JSON mode implies --yes so prompts don't corrupt the output stream.
	const assumeYes = options.yes === true || json
	const silent = json

	const pkg = await readPackageJson(targetDir)
	const results = await runDoctor(targetDir)
	const actions: FixActionRecord[] = []

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
		if (result.status === 'ok') {
			actions.push(recordFor(fixer.target, result.check, 'ok', 'already-ok', []))
			if (json) return emitJson(fixer.target)
			console.log(chalk.green(`\n✅ ${result.check} is already configured\n`))
			return
		}
		if (!silent) {
			console.log(
				chalk.cyan(`\n🔧 ${fixer.target} — ${chalk.bold(result.check)} is ${result.status}\n`)
			)
		}
		const ok = await confirmApply(fixer, result, assumeYes)
		if (!ok) {
			actions.push(recordFor(fixer.target, result.check, result.status, 'skipped', []))
			if (json) return emitJson(fixer.target)
			console.log(chalk.gray('   skipped\n'))
			return
		}
		const outcome = await applyFixer(fixer, result, targetDir, pkg, dryRun, silent)
		actions.push(
			recordFor(
				fixer.target,
				result.check,
				result.status,
				outcome.dryRun ? 'dry-run' : 'applied',
				outcome.filesWritten
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
		const ok = await confirmApply(fixer, result, assumeYes)
		if (!ok) {
			actions.push(recordFor(fixer.target, result.check, result.status, 'skipped', []))
			if (!silent) console.log(chalk.gray('    skipped'))
			skippedCount++
			continue
		}
		const outcome = await applyFixer(fixer, result, targetDir, pkg, dryRun, silent)
		actions.push(
			recordFor(
				fixer.target,
				result.check,
				result.status,
				outcome.dryRun ? 'dry-run' : 'applied',
				outcome.filesWritten
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
