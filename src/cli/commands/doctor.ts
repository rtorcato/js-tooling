import path from 'node:path'
import chalk from 'chalk'
import fs from 'fs-extra'
import { getFixTargetForCheck } from './fix-targets.js'

export interface DoctorOptions {
	directory?: string
	json?: boolean
}

export type CheckStatus = 'ok' | 'drift' | 'missing' | 'optional-missing'

export interface CheckResult {
	check: string
	status: CheckStatus
	detail: string
	hint?: string
}

const PACKAGE = '@rtorcato/js-tooling'

const NODE_MIN_MAJOR = 22
const NODE_LTS_REQUIREMENTS: Record<number, { minor: number; patch: number }> = {
	22: { minor: 22, patch: 2 },
	24: { minor: 15, patch: 0 },
}

function parseNodeVersion(version: string): [number, number, number] {
	const clean = version.replace(/^v/, '').split('-')[0] ?? ''
	const [maj, min, pat] = clean.split('.').map((n) => Number.parseInt(n, 10) || 0)
	return [maj ?? 0, min ?? 0, pat ?? 0]
}

export function evaluateNodeVersion(version: string): CheckResult {
	const [major, minor, patch] = parseNodeVersion(version)
	const display = `v${major}.${minor}.${patch}`

	if (major < NODE_MIN_MAJOR) {
		return {
			check: 'Node',
			status: 'missing',
			detail: `${display} is below required Node ${NODE_MIN_MAJOR}+`,
			hint: `Install Node ${NODE_MIN_MAJOR} LTS or newer (https://nodejs.org)`,
		}
	}

	const lts = NODE_LTS_REQUIREMENTS[major]
	if (lts) {
		const meets = minor > lts.minor || (minor === lts.minor && patch >= lts.patch)
		if (!meets) {
			return {
				check: 'Node',
				status: 'drift',
				detail: `${display} — npm may emit EBADENGINE warnings from transitive deps`,
				hint: `Upgrade to Node ${major}.${lts.minor}.${lts.patch}+ (or 26+) to silence transitive engine warnings`,
			}
		}
	}

	return {
		check: 'Node',
		status: 'ok',
		detail: display,
	}
}

interface FileCheck {
	check: string
	candidates: string[]
	expected: string
	matcher: RegExp
	optional?: boolean
	hint?: string
}

const FILE_CHECKS: FileCheck[] = [
	{
		check: 'TypeScript',
		candidates: ['tsconfig.json'],
		expected: `extends "${PACKAGE}/typescript/*"`,
		matcher: /@rtorcato\/js-tooling\/typescript\//,
		hint: 'Set `"extends": "@rtorcato/js-tooling/typescript/base"` in tsconfig.json',
	},
	{
		check: 'Biome',
		candidates: ['biome.json', 'biome.jsonc'],
		expected: `extends "${PACKAGE}/biome"`,
		matcher: /@rtorcato\/js-tooling\/biome/,
		optional: true,
		hint: 'Run `npx @rtorcato/js-tooling copy biome` to scaffold',
	},
	{
		check: 'ESLint',
		candidates: ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs'],
		expected: `imports "${PACKAGE}/eslint/*"`,
		matcher: /@rtorcato\/js-tooling\/eslint\//,
		optional: true,
		hint: 'Import from @rtorcato/js-tooling/eslint/base in eslint.config.mjs',
	},
	{
		check: 'Prettier',
		candidates: ['prettier.config.js', 'prettier.config.mjs', 'prettier.config.cjs'],
		expected: `imports "${PACKAGE}/prettier"`,
		matcher: /@rtorcato\/js-tooling\/prettier/,
		optional: true,
		hint: `Re-export from "${PACKAGE}/prettier" in prettier.config.mjs`,
	},
	{
		check: 'Vitest',
		candidates: ['vitest.config.ts', 'vitest.config.js', 'vitest.config.mjs'],
		expected: `imports "${PACKAGE}/vitest/config"`,
		matcher: /@rtorcato\/js-tooling\/vitest\/config/,
		optional: true,
	},
	{
		check: 'Commitlint',
		candidates: ['commitlint.config.js', 'commitlint.config.mjs', 'commitlint.config.cjs'],
		expected: `exports "${PACKAGE}/commitlint/config"`,
		matcher: /@rtorcato\/js-tooling\/commitlint\/config/,
		optional: true,
	},
]

async function checkFile(dir: string, spec: FileCheck): Promise<CheckResult> {
	for (const candidate of spec.candidates) {
		const filepath = path.join(dir, candidate)
		if (!(await fs.pathExists(filepath))) continue

		const contents = await fs.readFile(filepath, 'utf-8')
		if (spec.matcher.test(contents)) {
			return {
				check: spec.check,
				status: 'ok',
				detail: `${candidate} ${spec.expected}`,
			}
		}
		return {
			check: spec.check,
			status: 'drift',
			detail: `${candidate} found but does not ${spec.expected}`,
			hint: spec.hint,
		}
	}

	return {
		check: spec.check,
		status: spec.optional ? 'optional-missing' : 'missing',
		detail: `no ${spec.candidates.join(' / ')} found`,
		hint: spec.hint,
	}
}

type Pkg = Record<string, unknown>

async function readPackageJson(dir: string): Promise<Pkg | null> {
	const filepath = path.join(dir, 'package.json')
	if (!(await fs.pathExists(filepath))) return null
	try {
		return (await fs.readJson(filepath)) as Pkg
	} catch {
		return null
	}
}

function checkPackageJson(pkg: Pkg | null): CheckResult {
	if (!pkg) {
		return {
			check: 'package.json',
			status: 'missing',
			detail: 'no package.json found',
		}
	}

	const deps = {
		...((pkg.dependencies as Record<string, string>) ?? {}),
		...((pkg.devDependencies as Record<string, string>) ?? {}),
	}

	if (deps[PACKAGE]) {
		return {
			check: 'package.json',
			status: 'ok',
			detail: `${PACKAGE}@${deps[PACKAGE]} in dependencies`,
		}
	}

	return {
		check: 'package.json',
		status: 'drift',
		detail: `${PACKAGE} not in dependencies or devDependencies`,
		hint: `Run \`pnpm add -D ${PACKAGE}\``,
	}
}

function checkEnginesNode(pkg: Pkg | null): CheckResult {
	if (!pkg) {
		return {
			check: 'engines.node',
			status: 'missing',
			detail: 'no package.json',
		}
	}
	const engines = (pkg.engines as Record<string, string> | undefined) ?? {}
	if (!engines.node) {
		return {
			check: 'engines.node',
			status: 'drift',
			detail: 'engines.node not set in package.json',
			hint: `Add \`"engines": { "node": ">=${NODE_MIN_MAJOR}" }\` to package.json`,
		}
	}
	return {
		check: 'engines.node',
		status: 'ok',
		detail: `engines.node = ${engines.node}`,
	}
}

async function checkEditorConfig(dir: string): Promise<CheckResult> {
	const exists = await fs.pathExists(path.join(dir, '.editorconfig'))
	return {
		check: 'EditorConfig',
		status: exists ? 'ok' : 'optional-missing',
		detail: exists ? '.editorconfig found' : 'no .editorconfig',
		hint: exists ? undefined : 'Add an .editorconfig for cross-editor formatting consistency',
	}
}

async function checkNodeVersionPin(dir: string): Promise<CheckResult> {
	for (const candidate of ['.nvmrc', '.node-version']) {
		if (await fs.pathExists(path.join(dir, candidate))) {
			return {
				check: 'Node version pin',
				status: 'ok',
				detail: `${candidate} found`,
			}
		}
	}
	return {
		check: 'Node version pin',
		status: 'optional-missing',
		detail: 'no .nvmrc / .node-version',
		hint: 'Add .nvmrc to pin Node version per repo (e.g. `echo 22 > .nvmrc`)',
	}
}

async function checkHusky(dir: string, pkg: Pkg | null): Promise<CheckResult> {
	const huskyDir = await fs.pathExists(path.join(dir, '.husky'))
	const scripts = (pkg?.scripts as Record<string, string> | undefined) ?? {}
	const prepareScript = scripts.prepare ?? ''
	const hasHookScript = /\bhusky\b/.test(prepareScript)

	if (huskyDir && hasHookScript) {
		return {
			check: 'Husky',
			status: 'ok',
			detail: '.husky/ directory and prepare script configured',
		}
	}
	if (huskyDir || hasHookScript) {
		return {
			check: 'Husky',
			status: 'drift',
			detail: huskyDir
				? '.husky/ exists but no `prepare: husky` script'
				: '`prepare: husky` set but no .husky/ directory',
			hint: 'Run `pnpm exec husky init` to scaffold both halves',
		}
	}
	return {
		check: 'Husky',
		status: 'optional-missing',
		detail: 'husky not configured',
		hint: 'Run `pnpm add -D husky && pnpm exec husky init` to enable git hooks',
	}
}

const LINT_STAGED_FILES = [
	'.lintstagedrc',
	'.lintstagedrc.json',
	'.lintstagedrc.yaml',
	'.lintstagedrc.yml',
	'.lintstagedrc.js',
	'.lintstagedrc.cjs',
	'.lintstagedrc.mjs',
	'lint-staged.config.js',
	'lint-staged.config.cjs',
	'lint-staged.config.mjs',
]

async function checkLintStaged(dir: string, pkg: Pkg | null): Promise<CheckResult> {
	const inPkg = pkg ? 'lint-staged' in pkg : false
	let inFile: string | null = null
	for (const candidate of LINT_STAGED_FILES) {
		if (await fs.pathExists(path.join(dir, candidate))) {
			inFile = candidate
			break
		}
	}

	if (inPkg || inFile) {
		return {
			check: 'lint-staged',
			status: 'ok',
			detail: inPkg ? '`lint-staged` field in package.json' : `${inFile} found`,
		}
	}
	return {
		check: 'lint-staged',
		status: 'optional-missing',
		detail: 'lint-staged not configured',
		hint: 'Add a `lint-staged` field to package.json and wire it into the husky pre-commit hook',
	}
}

const KNIP_FILES = [
	'knip.json',
	'knip.jsonc',
	'knip.ts',
	'knip.config.ts',
	'knip.config.js',
	'knip.config.mjs',
]

async function checkKnip(dir: string, pkg: Pkg | null): Promise<CheckResult> {
	const inPkg = pkg ? 'knip' in pkg : false
	let inFile: string | null = null
	for (const candidate of KNIP_FILES) {
		if (await fs.pathExists(path.join(dir, candidate))) {
			inFile = candidate
			break
		}
	}

	if (inPkg || inFile) {
		return {
			check: 'knip',
			status: 'ok',
			detail: inPkg ? '`knip` field in package.json' : `${inFile} found`,
		}
	}
	return {
		check: 'knip',
		status: 'optional-missing',
		detail: 'knip not configured',
		hint: 'Add `knip` to detect unused files, deps, and exports',
	}
}

const SEMANTIC_RELEASE_FILES = [
	'.releaserc',
	'.releaserc.json',
	'.releaserc.yaml',
	'.releaserc.yml',
	'.releaserc.js',
	'.releaserc.cjs',
	'release.config.js',
	'release.config.cjs',
	'release.config.mjs',
]

async function checkSemanticRelease(dir: string, pkg: Pkg | null): Promise<CheckResult> {
	const isPrivate = pkg?.private === true
	const inPkg = pkg ? 'release' in pkg : false

	let configFile: string | null = null
	let configContent: string | null = null
	for (const candidate of SEMANTIC_RELEASE_FILES) {
		const filepath = path.join(dir, candidate)
		if (await fs.pathExists(filepath)) {
			configFile = candidate
			try {
				configContent = await fs.readFile(filepath, 'utf-8')
			} catch {
				configContent = ''
			}
			break
		}
	}

	if (!inPkg && !configFile) {
		return {
			check: 'semantic-release',
			status: isPrivate ? 'optional-missing' : 'drift',
			detail: isPrivate
				? 'semantic-release not configured (package is private)'
				: 'semantic-release not configured',
			hint: isPrivate
				? undefined
				: `Extend "${PACKAGE}/semantic-release" or "${PACKAGE}/semantic-release/github" in a release config`,
		}
	}

	const presetRegex = /@rtorcato\/js-tooling\/semantic-release/
	const pkgReleaseStr = inPkg ? JSON.stringify(pkg?.release ?? '') : ''
	const usesPreset =
		(configContent && presetRegex.test(configContent)) || presetRegex.test(pkgReleaseStr)

	if (usesPreset) {
		return {
			check: 'semantic-release',
			status: 'ok',
			detail: configFile
				? `${configFile} extends ${PACKAGE}/semantic-release`
				: `release field extends ${PACKAGE}/semantic-release`,
		}
	}

	return {
		check: 'semantic-release',
		status: 'drift',
		detail: configFile
			? `${configFile} does not extend ${PACKAGE}/semantic-release`
			: '`release` field does not extend our preset',
		hint: `Extend "${PACKAGE}/semantic-release" or "${PACKAGE}/semantic-release/github"`,
	}
}

async function checkGitHubActions(dir: string): Promise<CheckResult> {
	const workflowsDir = path.join(dir, '.github', 'workflows')
	if (!(await fs.pathExists(workflowsDir))) {
		return {
			check: 'GitHub Actions',
			status: 'optional-missing',
			detail: 'no .github/workflows/',
			hint: 'Run `npx @rtorcato/js-tooling setup` to scaffold a CI workflow',
		}
	}

	try {
		const files = await fs.readdir(workflowsDir)
		const workflows = files.filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
		if (workflows.length === 0) {
			return {
				check: 'GitHub Actions',
				status: 'optional-missing',
				detail: '.github/workflows/ is empty',
				hint: 'Add a workflow file (e.g. ci.yml) under .github/workflows/',
			}
		}
		return {
			check: 'GitHub Actions',
			status: 'ok',
			detail: `${workflows.length} workflow${workflows.length === 1 ? '' : 's'} in .github/workflows/`,
		}
	} catch {
		return {
			check: 'GitHub Actions',
			status: 'optional-missing',
			detail: 'unable to read .github/workflows/',
		}
	}
}

async function checkDependabot(dir: string): Promise<CheckResult> {
	for (const candidate of ['.github/dependabot.yml', '.github/dependabot.yaml']) {
		if (await fs.pathExists(path.join(dir, candidate))) {
			return {
				check: 'Dependabot',
				status: 'ok',
				detail: `${candidate} found`,
			}
		}
	}
	return {
		check: 'Dependabot',
		status: 'optional-missing',
		detail: 'no .github/dependabot.yml',
		hint: 'Run `npx @rtorcato/js-tooling fix dependabot` to scaffold weekly dep updates',
	}
}

async function checkCodeQL(dir: string): Promise<CheckResult> {
	const workflowsDir = path.join(dir, '.github', 'workflows')
	if (!(await fs.pathExists(workflowsDir))) {
		return {
			check: 'CodeQL',
			status: 'optional-missing',
			detail: 'no .github/workflows/',
			hint: 'Run `npx @rtorcato/js-tooling fix codeql` to scaffold CodeQL security scanning',
		}
	}
	for (const candidate of ['codeql.yml', 'codeql.yaml']) {
		if (await fs.pathExists(path.join(workflowsDir, candidate))) {
			return {
				check: 'CodeQL',
				status: 'ok',
				detail: `.github/workflows/${candidate} found`,
			}
		}
	}
	try {
		const files = await fs.readdir(workflowsDir)
		for (const f of files) {
			if (!(f.endsWith('.yml') || f.endsWith('.yaml'))) continue
			const content = await fs.readFile(path.join(workflowsDir, f), 'utf-8')
			if (/github\/codeql-action/.test(content)) {
				return {
					check: 'CodeQL',
					status: 'ok',
					detail: `codeql-action referenced in ${f}`,
				}
			}
		}
	} catch {
		// fall through to optional-missing
	}
	return {
		check: 'CodeQL',
		status: 'optional-missing',
		detail: 'no codeql workflow found',
		hint: 'Run `npx @rtorcato/js-tooling fix codeql` to scaffold CodeQL security scanning',
	}
}

async function checkGitLabCI(dir: string): Promise<CheckResult> {
	for (const candidate of ['.gitlab-ci.yml', '.gitlab-ci.yaml']) {
		if (await fs.pathExists(path.join(dir, candidate))) {
			return {
				check: 'GitLab CI',
				status: 'ok',
				detail: `${candidate} found`,
			}
		}
	}
	return {
		check: 'GitLab CI',
		status: 'optional-missing',
		detail: 'no .gitlab-ci.yml',
		hint: 'Add a .gitlab-ci.yml if this repo is hosted on GitLab',
	}
}

export async function runDoctor(dir: string): Promise<CheckResult[]> {
	const targetDir = path.resolve(dir)
	const pkg = await readPackageJson(targetDir)
	const results: CheckResult[] = []

	results.push(evaluateNodeVersion(process.version))
	results.push(checkPackageJson(pkg))
	results.push(checkEnginesNode(pkg))
	results.push(await checkEditorConfig(targetDir))
	results.push(await checkNodeVersionPin(targetDir))
	for (const spec of FILE_CHECKS) {
		results.push(await checkFile(targetDir, spec))
	}
	results.push(await checkHusky(targetDir, pkg))
	results.push(await checkLintStaged(targetDir, pkg))
	results.push(await checkSemanticRelease(targetDir, pkg))
	results.push(await checkKnip(targetDir, pkg))
	results.push(await checkGitHubActions(targetDir))
	results.push(await checkDependabot(targetDir))
	results.push(await checkCodeQL(targetDir))
	results.push(await checkGitLabCI(targetDir))

	return results
}

const STATUS_ICONS: Record<CheckStatus, string> = {
	ok: chalk.green('✅'),
	drift: chalk.yellow('⚠️ '),
	missing: chalk.red('❌'),
	'optional-missing': chalk.gray('➖'),
}

function statusLabel(status: CheckStatus): string {
	switch (status) {
		case 'ok':
			return chalk.green('ok')
		case 'drift':
			return chalk.yellow('drift')
		case 'missing':
			return chalk.red('missing')
		case 'optional-missing':
			return chalk.gray('not configured')
	}
}

const MAX_NEXT_STEP_SUGGESTIONS = 8

export function nextStepSuggestions(results: CheckResult[]): string[] {
	const fixable = results.filter(
		(r) => r.status === 'drift' || r.status === 'missing' || r.status === 'optional-missing'
	)
	const lines: string[] = []
	let overflow = 0
	for (const r of fixable) {
		const target = getFixTargetForCheck(r.check)
		if (!target) continue
		if (lines.length >= MAX_NEXT_STEP_SUGGESTIONS) {
			overflow++
			continue
		}
		const verb = r.status === 'drift' ? 'align' : 'scaffold'
		lines.push(`Run \`npx @rtorcato/js-tooling fix ${target}\` to ${verb} ${r.check}`)
	}
	if (overflow > 0) {
		lines.push(
			`...and ${overflow} more — run \`npx @rtorcato/js-tooling fix\` to walk all findings`
		)
	} else if (lines.length > 0) {
		lines.push('Run `npx @rtorcato/js-tooling fix` to walk all findings interactively')
	}
	return lines
}

export function summarize(results: CheckResult[]): {
	ok: number
	drift: number
	missing: number
	optionalMissing: number
} {
	return {
		ok: results.filter((r) => r.status === 'ok').length,
		drift: results.filter((r) => r.status === 'drift').length,
		missing: results.filter((r) => r.status === 'missing').length,
		optionalMissing: results.filter((r) => r.status === 'optional-missing').length,
	}
}

export async function doctorCommand(options: DoctorOptions = {}) {
	const dir = options.directory ?? process.cwd()
	const results = await runDoctor(dir)

	if (options.json) {
		console.log(JSON.stringify({ directory: path.resolve(dir), results }, null, 2))
	} else {
		console.log(chalk.cyan(`\n🩺 Diagnosing ${path.resolve(dir)} against ${PACKAGE} presets...\n`))
		for (const r of results) {
			console.log(`  ${STATUS_ICONS[r.status]} ${chalk.bold(r.check)} — ${statusLabel(r.status)}`)
			console.log(`     ${chalk.gray(r.detail)}`)
			if (r.hint && r.status !== 'ok') {
				console.log(`     ${chalk.dim('hint:')} ${chalk.dim(r.hint)}`)
			}
		}
		const summary = summarize(results)
		console.log()
		console.log(
			`  Summary: ${chalk.green(`${summary.ok} ok`)}, ${chalk.yellow(`${summary.drift} drift`)}, ${chalk.red(`${summary.missing} missing`)}, ${chalk.gray(`${summary.optionalMissing} not configured`)}\n`
		)
		const suggestions = nextStepSuggestions(results)
		if (suggestions.length > 0) {
			console.log(chalk.bold('  Next steps:'))
			for (const s of suggestions) {
				console.log(`    ${chalk.gray('-')} ${s}`)
			}
			console.log()
		}
	}

	const summary = summarize(results)
	const exitCode = summary.drift > 0 || summary.missing > 0 ? 1 : 0
	process.exitCode = exitCode
}
