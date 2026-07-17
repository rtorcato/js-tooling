import path from 'node:path'
import chalk from 'chalk'
import fs from 'fs-extra'
import { BADGE_START, hasPublicOnlyBadges } from '../generators/badges.js'
import { detectLanguage } from '../utils/detect-language.js'
import { checkGitHubSettings } from '../utils/github-settings.js'
import { type Lockfile, LOCKFILE_VERSION, readLockfile } from '../utils/lockfile.js'
import { declinedInLock, getFixTargetForCheck } from './fix-targets.js'

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
	{
		check: 'Oxlint',
		candidates: ['.oxlintrc.json', 'oxlintrc.json'],
		// Oxlint configs are project-owned (extends from npm packages isn't
		// reliably supported), so any well-formed file counts as ok.
		expected: 'is a valid Oxlint configuration',
		matcher: /"(rules|plugins|categories|extends)"/,
		optional: true,
		hint: 'Run `npx @rtorcato/js-tooling copy oxlint` to scaffold',
	},
	{
		check: 'Changesets',
		candidates: ['.changeset/config.json'],
		expected: 'is a valid Changesets configuration',
		matcher: /"(changelog|access|baseBranch)"/,
		optional: true,
		hint: 'Run `npx @rtorcato/js-tooling copy changesets` to scaffold',
	},
	{
		check: 'Release Please',
		candidates: ['release-please-config.json'],
		expected: 'is a valid Release Please configuration',
		matcher: /"(packages|release-type|bootstrap-sha)"/,
		optional: true,
		hint: 'Run `npx @rtorcato/js-tooling fix release-please` to scaffold',
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

/** Merged dependencies + devDependencies of a package.json, for presence checks. */
function allDeps(pkg: Pkg | null): Record<string, string> {
	if (!pkg) return {}
	return {
		...((pkg.dependencies as Record<string, string> | undefined) ?? {}),
		...((pkg.devDependencies as Record<string, string> | undefined) ?? {}),
	}
}

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

// Maps a present tool-config file to the VS Code extension that should be
// recommended for it. Mirrors recommendedExtensions() in the generator, but
// keyed off files on disk (doctor audits an existing repo, not a config object).
const EXTENSION_SIGNALS: Array<{ candidates: string[]; ext: string }> = [
	{ candidates: ['.editorconfig'], ext: 'EditorConfig.EditorConfig' },
	{ candidates: ['biome.json', 'biome.jsonc'], ext: 'biomejs.biome' },
	{
		candidates: ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs'],
		ext: 'dbaeumer.vscode-eslint',
	},
	{
		candidates: ['prettier.config.js', 'prettier.config.mjs', 'prettier.config.cjs'],
		ext: 'esbenp.prettier-vscode',
	},
	{ candidates: ['.oxlintrc.json', 'oxlintrc.json'], ext: 'oxc.oxc-vscode' },
	{
		candidates: ['vitest.config.ts', 'vitest.config.js', 'vitest.config.mjs'],
		ext: 'vitest.explorer',
	},
	{ candidates: ['playwright.config.ts', 'playwright.config.js'], ext: 'ms-playwright.playwright' },
]

async function checkVscodeExtensions(dir: string): Promise<CheckResult> {
	const wanted: string[] = []
	for (const { candidates, ext } of EXTENSION_SIGNALS) {
		for (const c of candidates) {
			if (await fs.pathExists(path.join(dir, c))) {
				wanted.push(ext)
				break
			}
		}
	}
	if (wanted.length === 0) {
		return {
			check: 'VS Code extensions',
			status: 'ok',
			detail: 'no tool configs that map to an editor extension',
		}
	}

	let recommended: string[] = []
	const extPath = path.join(dir, '.vscode', 'extensions.json')
	if (await fs.pathExists(extPath)) {
		try {
			const json = (await fs.readJson(extPath)) as { recommendations?: unknown }
			if (Array.isArray(json.recommendations)) {
				recommended = json.recommendations.filter((r): r is string => typeof r === 'string')
			}
		} catch {
			recommended = []
		}
	}

	const missing = wanted.filter((ext) => !recommended.includes(ext))
	if (missing.length === 0) {
		return {
			check: 'VS Code extensions',
			status: 'ok',
			detail: '.vscode/extensions.json recommends the matching extensions',
		}
	}
	return {
		check: 'VS Code extensions',
		status: 'optional-missing',
		detail: `enabled tools without a recommended extension: ${missing.join(', ')}`,
		hint: 'Run `npx @rtorcato/js-tooling fix vscode-extensions` to recommend matching editor extensions',
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

interface NodeSignal {
	source: string
	major: number
}

/** First integer in an `engines.node` range (the floor major), or null. */
function enginesFloorMajor(pkg: Pkg | null): number | null {
	const engines = (pkg?.engines as Record<string, string> | undefined) ?? {}
	const raw = engines.node
	if (!raw) return null
	const m = raw.match(/\d+/)
	return m ? Number.parseInt(m[0], 10) : null
}

async function nvmrcMajor(dir: string): Promise<{ file: string; major: number } | null> {
	for (const candidate of ['.nvmrc', '.node-version']) {
		const p = path.join(dir, candidate)
		if (await fs.pathExists(p)) {
			const m = (await fs.readFile(p, 'utf-8')).trim().match(/\d+/)
			if (m) return { file: candidate, major: Number.parseInt(m[0], 10) }
		}
	}
	return null
}

// Matches a hardcoded scalar `node-version: <major>` — a leading digit (after
// an optional quote) is required. This skips matrix arrays (`[22, 24]`),
// `${{ matrix.node-version }}` expressions, bare `node-version:` input keys, and
// `node-version-file:` (a different key entirely) — those aren't drift signals.
const HARDCODED_NODE_VERSION = /node-version:\s*['"]?(\d+)/g

async function workflowNodeMajors(dir: string): Promise<NodeSignal[]> {
	const workflowsDir = path.join(dir, '.github', 'workflows')
	if (!(await fs.pathExists(workflowsDir))) return []
	let files: string[]
	try {
		files = (await fs.readdir(workflowsDir)).filter(
			(f) => f.endsWith('.yml') || f.endsWith('.yaml')
		)
	} catch {
		return []
	}
	const signals: NodeSignal[] = []
	for (const file of files) {
		const contents = await fs.readFile(path.join(workflowsDir, file), 'utf-8')
		const seen = new Set<number>()
		for (const match of contents.matchAll(HARDCODED_NODE_VERSION)) {
			const major = Number.parseInt(match[1] ?? '', 10)
			if (!Number.isNaN(major) && !seen.has(major)) {
				seen.add(major)
				signals.push({ source: `.github/workflows/${file}`, major })
			}
		}
	}
	return signals
}

// Root-cause check for the #94 class: a workflow hardcoding a Node major that
// disagrees with .nvmrc / engines.node (e.g. ci.yml pinned Node 20 while
// .nvmrc said 22 → node:sqlite crash under pnpm). Only flags genuine
// disagreement; a matrix that tests several majors uses arrays/expressions and
// is not counted.
async function checkNodeVersionConsistency(dir: string, pkg: Pkg | null): Promise<CheckResult> {
	const signals: NodeSignal[] = []
	const nvmrc = await nvmrcMajor(dir)
	if (nvmrc) signals.push({ source: nvmrc.file, major: nvmrc.major })
	const eng = enginesFloorMajor(pkg)
	if (eng !== null) signals.push({ source: 'engines.node', major: eng })
	signals.push(...(await workflowNodeMajors(dir)))

	if (signals.length < 2) {
		return {
			check: 'Node version consistency',
			status: 'ok',
			detail:
				signals.length === 0
					? 'no Node version pins to cross-check'
					: `single Node version source (${signals[0]?.source} → ${signals[0]?.major})`,
		}
	}

	const distinct = [...new Set(signals.map((s) => s.major))]
	if (distinct.length === 1) {
		return {
			check: 'Node version consistency',
			status: 'ok',
			detail: `Node ${distinct[0]} agrees across ${signals.length} sources`,
		}
	}

	const summary = signals.map((s) => `${s.source}→${s.major}`).join(', ')
	return {
		check: 'Node version consistency',
		status: 'drift',
		detail: `Node major disagreement: ${summary}`,
		hint: 'Run `npx @rtorcato/js-tooling fix node-version` to point workflows at `node-version-file: .nvmrc` (one source of truth)',
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

/**
 * True when a shell hook has an uncommented line matching `pattern`. A
 * commented-out line (e.g. `# pnpm verify`) doesn't count — the command never
 * runs, so it isn't real wiring.
 */
function hookHasUncommented(contents: string, pattern: RegExp): boolean {
	return contents.split('\n').some((line) => {
		const trimmed = line.trim()
		return trimmed.length > 0 && !trimmed.startsWith('#') && pattern.test(trimmed)
	})
}

async function checkHuskyPrePush(dir: string, pkg: Pkg | null): Promise<CheckResult> {
	const huskyDir = await fs.pathExists(path.join(dir, '.husky'))
	if (!huskyDir) {
		// If husky isn't in use, pre-push is not relevant
		return {
			check: 'Husky pre-push',
			status: 'optional-missing',
			detail: 'husky not configured',
			hint: 'Run `npx @rtorcato/js-tooling fix husky` to enable git hooks (includes pre-push)',
		}
	}
	const hookPath = path.join(dir, '.husky', 'pre-push')
	if (!(await fs.pathExists(hookPath))) {
		return {
			check: 'Husky pre-push',
			status: 'optional-missing',
			detail: 'no .husky/pre-push',
			hint: 'Run `npx @rtorcato/js-tooling fix husky` to scaffold a pre-push hook that runs `pnpm verify`',
		}
	}
	const contents = await fs.readFile(hookPath, 'utf-8')
	if (hookHasUncommented(contents, /\bpnpm\s+verify\b/)) {
		return {
			check: 'Husky pre-push',
			status: 'ok',
			detail: '.husky/pre-push runs `pnpm verify`',
		}
	}
	// Pre-push exists but doesn't call pnpm verify
	const scripts = (pkg?.scripts as Record<string, string> | undefined) ?? {}
	if (!scripts.verify) {
		return {
			check: 'Husky pre-push',
			status: 'drift',
			detail: '.husky/pre-push exists but no `verify` script in package.json',
			hint: 'Run `npx @rtorcato/js-tooling fix verify` to add a verify script, then `fix husky` to align the hook',
		}
	}
	return {
		check: 'Husky pre-push',
		status: 'drift',
		detail: '.husky/pre-push exists but does not call `pnpm verify`',
		hint: 'Run `npx @rtorcato/js-tooling fix husky` to align the hook with `pnpm verify`',
	}
}

async function checkVerifyScript(dir: string, pkg: Pkg | null): Promise<CheckResult> {
	if (!pkg) {
		return {
			check: 'verify script',
			status: 'missing',
			detail: 'no package.json',
		}
	}
	const scripts = (pkg.scripts as Record<string, string> | undefined) ?? {}
	const body = scripts.verify
	if (!body) {
		return {
			check: 'verify script',
			status: 'optional-missing',
			detail: 'no `verify` script in package.json',
			hint: 'Run `npx @rtorcato/js-tooling fix verify` to add a unified `pnpm verify` script',
		}
	}

	// Lenient: only flag drift when an enabled tool is clearly absent from the script body.
	const deps = {
		...((pkg.dependencies as Record<string, string> | undefined) ?? {}),
		...((pkg.devDependencies as Record<string, string> | undefined) ?? {}),
	}
	const missing: string[] = []
	if (scripts.typecheck && !/\btypecheck\b/.test(body)) missing.push('typecheck')
	if ((scripts.check || deps['@biomejs/biome']) && !/\b(check|biome|lint)\b/.test(body)) {
		missing.push('lint/check')
	}
	if ((deps.vitest || scripts.test) && !/(vitest|jest|test:e2e|pnpm\s+test)/.test(body)) {
		missing.push('tests')
	}
	const hasTreeshakeApp = await fs.pathExists(
		path.join(dir, 'apps', 'treeshake-check', 'check.mjs')
	)
	if (hasTreeshakeApp && !/\btreeshake\b/.test(body)) missing.push('treeshake')

	if (missing.length > 0) {
		return {
			check: 'verify script',
			status: 'drift',
			detail: `\`verify\` script is missing: ${missing.join(', ')}`,
			hint: 'Run `npx @rtorcato/js-tooling fix verify` to regenerate the verify chain',
		}
	}
	return {
		check: 'verify script',
		status: 'ok',
		detail: `\`verify\` = ${body}`,
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

/**
 * True when any .husky hook has an uncommented line that invokes lint-staged.
 * A commented-out `# npx lint-staged` line (react-common's repro) does not
 * count — lint-staged never actually runs.
 */
async function huskyHookCallsLintStaged(dir: string): Promise<boolean> {
	const huskyDir = path.join(dir, '.husky')
	if (!(await fs.pathExists(huskyDir))) return false
	for (const name of await fs.readdir(huskyDir)) {
		const hookPath = path.join(huskyDir, name)
		if (!(await fs.stat(hookPath)).isFile()) continue
		const contents = await fs.readFile(hookPath, 'utf-8')
		if (hookHasUncommented(contents, /\blint-staged\b/)) return true
	}
	return false
}

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
		const where = inPkg ? '`lint-staged` field in package.json' : `${inFile} found`
		// Config presence isn't enough — verify a husky hook actually runs it.
		// Only assert wiring when husky is in use; a non-husky setup may invoke
		// lint-staged another way and shouldn't be flagged.
		const huskyInUse = await fs.pathExists(path.join(dir, '.husky'))
		if (huskyInUse && !(await huskyHookCallsLintStaged(dir))) {
			return {
				check: 'lint-staged',
				status: 'drift',
				detail: `${where} but no husky hook runs it`,
				hint: 'Run `npx @rtorcato/js-tooling fix husky` to wire lint-staged into the pre-commit hook',
			}
		}
		return {
			check: 'lint-staged',
			status: 'ok',
			detail: where,
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

const SIZE_LIMIT_FILES = [
	'.size-limit.json',
	'.size-limit.js',
	'.size-limit.cjs',
	'.size-limit.mjs',
	'.size-limit.ts',
]

async function checkSizeLimit(dir: string, pkg: Pkg | null): Promise<CheckResult> {
	const inPkg = pkg ? 'size-limit' in pkg : false
	let inFile: string | null = null
	for (const candidate of SIZE_LIMIT_FILES) {
		if (await fs.pathExists(path.join(dir, candidate))) {
			inFile = candidate
			break
		}
	}

	if (inPkg || inFile) {
		return {
			check: 'size-limit',
			status: 'ok',
			detail: inPkg ? '`size-limit` field in package.json' : `${inFile} found`,
		}
	}
	return {
		check: 'size-limit',
		status: 'optional-missing',
		detail: 'size-limit not configured',
		hint: 'Add `size-limit` to enforce bundle-size budgets in CI for library projects',
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

	const hasChangesets = await fs.pathExists(path.join(dir, '.changeset', 'config.json'))
	const hasReleasePlease = await fs.pathExists(path.join(dir, 'release-please-config.json'))
	const hasSemanticRelease = inPkg || !!configFile

	// Conflict: more than one of {semantic-release, Changesets, Release Please}.
	const configured = [
		hasSemanticRelease && 'semantic-release',
		hasChangesets && 'Changesets',
		hasReleasePlease && 'Release Please',
	].filter((v): v is string => Boolean(v))
	if (configured.length >= 2) {
		return {
			check: 'semantic-release',
			status: 'drift',
			detail: `multiple release tools configured (${configured.join(', ')})`,
			hint: 'Pick one release tool — remove the extra config(s)',
		}
	}

	if (!hasSemanticRelease) {
		// Another release tool is present — treat semantic-release as intentionally unused.
		if (hasChangesets || hasReleasePlease) {
			return {
				check: 'semantic-release',
				status: 'ok',
				detail: `using ${hasChangesets ? 'Changesets' : 'Release Please'} instead`,
			}
		}
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

// Detects the broken-release-on-protected-main footgun: a workflow that runs
// semantic-release but only hands it GITHUB_TOKEN, which can't push the version
// commit + tag past branch protection. The fix is an admin PAT (RELEASE_TOKEN)
// with a GITHUB_TOKEN fallback.
async function checkReleaseToken(dir: string): Promise<CheckResult> {
	const workflowsDir = path.join(dir, '.github', 'workflows')
	if (!(await fs.pathExists(workflowsDir))) {
		return { check: 'Release token', status: 'optional-missing', detail: 'no .github/workflows/' }
	}
	try {
		const files = await fs.readdir(workflowsDir)
		for (const f of files) {
			if (!(f.endsWith('.yml') || f.endsWith('.yaml'))) continue
			const content = await fs.readFile(path.join(workflowsDir, f), 'utf-8')
			if (!/semantic-release/.test(content)) continue
			if (/RELEASE_TOKEN/.test(content)) {
				return {
					check: 'Release token',
					status: 'ok',
					detail: `${f} uses RELEASE_TOKEN (with GITHUB_TOKEN fallback)`,
				}
			}
			return {
				check: 'Release token',
				status: 'drift',
				detail: `${f} runs semantic-release with bare GITHUB_TOKEN`,
				hint: 'GITHUB_TOKEN cannot push to a protected main. Set the checkout `token:` and the semantic-release `GITHUB_TOKEN` env to `${{ secrets.RELEASE_TOKEN || secrets.GITHUB_TOKEN }}` and add a RELEASE_TOKEN admin PAT secret',
			}
		}
		return {
			check: 'Release token',
			status: 'optional-missing',
			detail: 'no semantic-release workflow found',
		}
	} catch {
		return {
			check: 'Release token',
			status: 'optional-missing',
			detail: 'unable to read .github/workflows/',
		}
	}
}

async function checkDependabot(dir: string): Promise<CheckResult> {
	for (const candidate of ['.github/dependabot.yml', '.github/dependabot.yaml']) {
		const candidatePath = path.join(dir, candidate)
		if (await fs.pathExists(candidatePath)) {
			// A config with no `groups:` predates the grouping/ignore defaults — a lone
			// react-dom or TypeScript-major bump can never pass CI. Flag as drift so
			// `fix dependabot` can bring it up to standard.
			const content = await fs.readFile(candidatePath, 'utf8')
			if (!/^\s*groups:/m.test(content)) {
				return {
					check: 'Dependabot',
					status: 'drift',
					detail: `${candidate} missing recommended dependency grouping`,
					hint: 'Run `npx @rtorcato/js-tooling fix dependabot` to add grouping + ignore rules',
				}
			}
			return {
				check: 'Dependabot',
				status: 'ok',
				detail: `${candidate} found`,
			}
		}
	}
	for (const candidate of [
		'renovate.json',
		'renovate.json5',
		'.github/renovate.json',
		'.github/renovate.json5',
		'.renovaterc',
		'.renovaterc.json',
	]) {
		if (await fs.pathExists(path.join(dir, candidate))) {
			return {
				check: 'Dependabot',
				status: 'ok',
				detail: `${candidate} found (Renovate)`,
			}
		}
	}
	return {
		check: 'Dependabot',
		status: 'optional-missing',
		detail: 'no Dependabot or Renovate config',
		hint: 'Run `npx @rtorcato/js-tooling fix dependabot` (or `fix renovate`) to scaffold weekly dep updates',
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

const TYPEDOC_CONFIGS = [
	'typedoc.json',
	'typedoc.config.js',
	'typedoc.config.mjs',
	'typedoc.config.cjs',
	'typedoc.config.ts',
]

async function checkTypedoc(dir: string, pkg: Pkg | null): Promise<CheckResult> {
	if (pkg?.private === true) {
		return {
			check: 'TypeDoc',
			status: 'ok',
			detail: 'not applicable (package is private)',
		}
	}

	let configFile: string | null = null
	let configContent: string | null = null
	for (const candidate of TYPEDOC_CONFIGS) {
		const fp = path.join(dir, candidate)
		if (await fs.pathExists(fp)) {
			configFile = candidate
			try {
				configContent = await fs.readFile(fp, 'utf-8')
			} catch {
				configContent = ''
			}
			break
		}
	}

	const deps = {
		...((pkg?.dependencies as Record<string, string> | undefined) ?? {}),
		...((pkg?.devDependencies as Record<string, string> | undefined) ?? {}),
	}
	const hasDep = !!deps['typedoc']
	const usesPreset = configContent ? /@rtorcato\/js-tooling\/typedoc/.test(configContent) : false

	if (configFile && usesPreset) {
		return {
			check: 'TypeDoc',
			status: 'ok',
			detail: `${configFile} extends the preset`,
		}
	}
	if (configFile && !usesPreset) {
		return {
			check: 'TypeDoc',
			status: 'drift',
			detail: `${configFile} found but does not extend @rtorcato/js-tooling/typedoc`,
			hint: 'Add `"extends": ["@rtorcato/js-tooling/typedoc"]` to typedoc.json',
		}
	}
	if (hasDep && !configFile) {
		return {
			check: 'TypeDoc',
			status: 'drift',
			detail: 'typedoc installed but no typedoc.json found',
			hint: 'Run `npx @rtorcato/js-tooling fix typedoc` to scaffold typedoc.json',
		}
	}
	return {
		check: 'TypeDoc',
		status: 'optional-missing',
		detail: 'TypeDoc not configured',
		hint: 'Run `npx @rtorcato/js-tooling fix typedoc` to scaffold API docs generation',
	}
}

function isPublishableLibrary(pkg: Pkg | null): boolean {
	if (!pkg || pkg.private === true) return false
	return !!(pkg.exports || pkg.main || pkg.module || pkg.files)
}

async function checkAreTheTypesWrong(_dir: string, pkg: Pkg | null): Promise<CheckResult> {
	if (!isPublishableLibrary(pkg)) {
		return {
			check: 'are-the-types-wrong',
			status: 'ok',
			detail: 'not applicable (private or no published exports)',
		}
	}

	const deps = {
		...((pkg?.dependencies as Record<string, string> | undefined) ?? {}),
		...((pkg?.devDependencies as Record<string, string> | undefined) ?? {}),
	}
	const scripts = (pkg?.scripts as Record<string, string> | undefined) ?? {}

	const hasDep = !!deps['@arethetypeswrong/cli']
	const hasScript = Object.values(scripts).some((s) => /\battw\b/.test(s))

	if (hasDep && hasScript) {
		return {
			check: 'are-the-types-wrong',
			status: 'ok',
			detail: '@arethetypeswrong/cli installed and wired into a script',
		}
	}

	if (hasDep) {
		return {
			check: 'are-the-types-wrong',
			status: 'drift',
			detail: '@arethetypeswrong/cli installed but no script runs it',
			hint: 'Run `npx @rtorcato/js-tooling fix attw` to add an `attw` script and wire it into verify',
		}
	}

	return {
		check: 'are-the-types-wrong',
		status: 'optional-missing',
		detail: '@arethetypeswrong/cli not configured',
		hint: 'Run `npx @rtorcato/js-tooling fix attw` to validate TypeScript exports before publishing',
	}
}

async function checkPublint(_dir: string, pkg: Pkg | null): Promise<CheckResult> {
	if (!isPublishableLibrary(pkg)) {
		return {
			check: 'publint',
			status: 'ok',
			detail: 'not applicable (private or no published exports)',
		}
	}

	const deps = {
		...((pkg?.dependencies as Record<string, string> | undefined) ?? {}),
		...((pkg?.devDependencies as Record<string, string> | undefined) ?? {}),
	}
	const scripts = (pkg?.scripts as Record<string, string> | undefined) ?? {}

	const hasDep = !!deps['publint']
	const hasScript = Object.values(scripts).some((s) => /\bpublint\b/.test(s))

	if (hasDep && hasScript) {
		return {
			check: 'publint',
			status: 'ok',
			detail: 'publint installed and wired into a script',
		}
	}

	if (hasDep) {
		return {
			check: 'publint',
			status: 'drift',
			detail: 'publint installed but no script runs it',
			hint: 'Run `npx @rtorcato/js-tooling fix publint` to add a `publint` script and wire it into verify',
		}
	}

	return {
		check: 'publint',
		status: 'optional-missing',
		detail: 'publint not configured',
		hint: 'Run `npx @rtorcato/js-tooling fix publint` to lint your package before publishing',
	}
}

async function checkReadmeBadges(dir: string, pkg: Pkg | null): Promise<CheckResult> {
	const readmePath = path.join(dir, 'README.md')
	const readme = (await fs.pathExists(readmePath)) ? await fs.readFile(readmePath, 'utf8') : ''
	const isPrivate = !pkg || pkg.private === true

	if (isPrivate) {
		// Only a problem if a private/app repo carries badges that would 404.
		if (readme && hasPublicOnlyBadges(readme)) {
			return {
				check: 'README badges',
				status: 'drift',
				detail: 'README has npm/coverage badges but the package is private (they 404)',
				hint: 'Run `npx @rtorcato/js-tooling fix badges` to rebuild badges for a private repo',
			}
		}
		return { check: 'README badges', status: 'ok', detail: 'not applicable (private package)' }
	}

	if (!isPublishableLibrary(pkg)) {
		return { check: 'README badges', status: 'ok', detail: 'not applicable (no published exports)' }
	}

	const hasBadges =
		readme.includes(BADGE_START) ||
		/img\.shields\.io|badge\.svg|badge\.fury\.io|codecov\.io/.test(readme)
	if (hasBadges) {
		return { check: 'README badges', status: 'ok', detail: 'README carries status badges' }
	}
	return {
		check: 'README badges',
		status: 'optional-missing',
		detail: 'no status badges in README',
		hint: 'Run `npx @rtorcato/js-tooling fix badges` to add CI/npm/coverage/license badges',
	}
}

// A README that advertises a Codecov badge but a CI that never uploads coverage
// leaves the badge permanently red. Only flags when the badge is actually present
// (no badge → nothing to back, so it's not applicable).
async function checkCoverageUpload(dir: string): Promise<CheckResult> {
	const readmePath = path.join(dir, 'README.md')
	const readme = (await fs.pathExists(readmePath)) ? await fs.readFile(readmePath, 'utf8') : ''
	if (!/codecov\.io/.test(readme)) {
		return {
			check: 'Coverage upload',
			status: 'ok',
			detail: 'no coverage badge in README (nothing to back)',
		}
	}

	const workflowsDir = path.join(dir, '.github', 'workflows')
	if (await fs.pathExists(workflowsDir)) {
		try {
			const files = (await fs.readdir(workflowsDir)).filter(
				(f) => f.endsWith('.yml') || f.endsWith('.yaml')
			)
			for (const f of files) {
				const content = await fs.readFile(path.join(workflowsDir, f), 'utf-8')
				if (/codecov\/codecov-action/.test(content)) {
					return {
						check: 'Coverage upload',
						status: 'ok',
						detail: `coverage badge backed by codecov-action in .github/workflows/${f}`,
					}
				}
			}
		} catch {
			// fall through to drift
		}
	}

	return {
		check: 'Coverage upload',
		status: 'drift',
		detail: 'README has a Codecov badge but no CI step uploads coverage (badge stays red)',
		hint: 'Run `npx @rtorcato/js-tooling fix github-actions` to regenerate ci.yml with a Codecov upload step',
	}
}

async function checkTreeshakeSetup(dir: string, pkg: Pkg | null): Promise<CheckResult> {
	const appCheckPath = path.join(dir, 'apps', 'treeshake-check', 'check.mjs')
	if (await fs.pathExists(appCheckPath)) {
		return {
			check: 'Tree-shake check',
			status: 'ok',
			detail: 'apps/treeshake-check/check.mjs found',
		}
	}
	// Only nudge libraries that actually claim tree-shaking via multi-subpath exports + sideEffects: false.
	const exports = (pkg?.exports as Record<string, unknown> | undefined) ?? {}
	const subpaths = Object.keys(exports).filter(
		(k) => k !== '.' && k.startsWith('./') && !k.includes('*')
	)
	const sideEffectsFree = pkg?.sideEffects === false
	if (subpaths.length < 2 || !sideEffectsFree) {
		return {
			check: 'Tree-shake check',
			status: 'ok',
			detail: 'not applicable (single-export or has side effects)',
		}
	}
	return {
		check: 'Tree-shake check',
		status: 'optional-missing',
		detail: `package exports ${subpaths.length} subpaths with sideEffects: false but no apps/treeshake-check/`,
		hint: 'Run `npx @rtorcato/js-tooling fix treeshake-check` to scaffold an esbuild metafile assertion',
	}
}

function checkLockfile(lock: Lockfile | null): CheckResult {
	if (!lock) {
		return {
			check: 'lockfile',
			status: 'optional-missing',
			detail: 'no .js-tooling.json — doctor cannot tell intentional opt-outs from drift',
			hint: 'Run `npx @rtorcato/js-tooling fix lockfile` to record current choices',
		}
	}
	if (lock.version > LOCKFILE_VERSION) {
		return {
			check: 'lockfile',
			status: 'drift',
			detail: `.js-tooling.json version ${lock.version} is newer than this CLI supports (v${LOCKFILE_VERSION})`,
			hint: 'Upgrade @rtorcato/js-tooling to a release that supports this lockfile version',
		}
	}
	return {
		check: 'lockfile',
		status: 'ok',
		detail: `.js-tooling.json v${lock.version} (written by ${lock.writtenBy})`,
	}
}

async function checkCodeowners(dir: string): Promise<CheckResult> {
	for (const candidate of ['CODEOWNERS', '.github/CODEOWNERS', 'docs/CODEOWNERS']) {
		if (await fs.pathExists(path.join(dir, candidate))) {
			return {
				check: 'CODEOWNERS',
				status: 'ok',
				detail: `${candidate} found`,
			}
		}
	}
	return {
		check: 'CODEOWNERS',
		status: 'optional-missing',
		detail: 'no CODEOWNERS file',
		hint: 'Run `npx @rtorcato/js-tooling fix codeowners` to scaffold .github/CODEOWNERS',
	}
}

async function checkCommunityHealth(dir: string): Promise<CheckResult> {
	const anchors = ['CONTRIBUTING.md', 'SECURITY.md']
	const present = await Promise.all(anchors.map((f) => fs.pathExists(path.join(dir, f))))
	if (present.every(Boolean)) {
		return {
			check: 'Community health',
			status: 'ok',
			detail: 'CONTRIBUTING.md and SECURITY.md found',
		}
	}
	return {
		check: 'Community health',
		status: 'optional-missing',
		detail: 'missing community-health files (CONTRIBUTING/SECURITY/templates)',
		hint: 'Run `npx @rtorcato/js-tooling fix community-health` to scaffold them',
	}
}

async function checkAiSetup(dir: string): Promise<CheckResult> {
	// Consider AI setup present if AGENTS.md carries the js-tooling block or the
	// Claude skill is installed — the two primary markers `fix ai` writes.
	const agentsPath = path.join(dir, 'AGENTS.md')
	const hasAgentsBlock =
		(await fs.pathExists(agentsPath)) &&
		(await fs.readFile(agentsPath, 'utf8')).includes('<!-- js-tooling:start -->')
	const hasSkill = await fs.pathExists(path.join(dir, '.claude', 'skills', 'js-tooling.md'))
	if (hasAgentsBlock || hasSkill) {
		return {
			check: 'AI setup',
			status: 'ok',
			detail: hasAgentsBlock ? 'AGENTS.md has the js-tooling block' : '.claude skill installed',
		}
	}
	return {
		check: 'AI setup',
		status: 'optional-missing',
		detail: 'no AI agent files (AGENTS.md, CLAUDE.md, Cursor/Copilot rules, Claude skill)',
		hint: 'Run `npx @rtorcato/js-tooling fix ai` to scaffold agent rules for every AI tool',
	}
}

// Only called for pnpm-workspace monorepos (see runDoctor) — a single-package
// repo has no use for turbo.json, so the check would be noise there.
async function checkTurborepo(dir: string): Promise<CheckResult> {
	if (await fs.pathExists(path.join(dir, 'turbo.json'))) {
		return { check: 'Turborepo', status: 'ok', detail: 'turbo.json found' }
	}
	return {
		check: 'Turborepo',
		status: 'optional-missing',
		detail: 'pnpm workspace without turbo.json',
		hint: 'Run `npx @rtorcato/js-tooling fix turborepo` to scaffold a task pipeline',
	}
}

// Only called when `tailwindcss` is a dependency (see runDoctor) — Tailwind is
// opt-in per project, so nudging repos that don't use it would be noise. v4 is
// CSS-first: the wiring is a PostCSS plugin (or the Vite plugin), not a config
// file, so that's what we look for.
async function checkTailwind(dir: string, pkg: Pkg | null): Promise<CheckResult> {
	const hasVitePlugin = '@tailwindcss/vite' in allDeps(pkg)
	let postcssWired = false
	for (const candidate of ['postcss.config.mjs', 'postcss.config.js', 'postcss.config.cjs']) {
		const p = path.join(dir, candidate)
		if (
			(await fs.pathExists(p)) &&
			(await fs.readFile(p, 'utf8')).includes('@tailwindcss/postcss')
		) {
			postcssWired = true
			break
		}
	}

	if (hasVitePlugin || postcssWired) {
		return {
			check: 'Tailwind',
			status: 'ok',
			detail: hasVitePlugin ? '@tailwindcss/vite configured' : '@tailwindcss/postcss configured',
		}
	}
	return {
		check: 'Tailwind',
		status: 'optional-missing',
		detail: 'tailwindcss installed without a PostCSS (or Vite) plugin',
		hint: 'Run `npx @rtorcato/js-tooling fix tailwind` to scaffold the v4 PostCSS wiring',
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
		hint: 'Run `npx @rtorcato/js-tooling fix gitlab-ci` to scaffold a starter GitLab pipeline',
	}
}

export async function runDoctor(dir: string): Promise<CheckResult[]> {
	const targetDir = path.resolve(dir)

	// Seam: gate the whole JS check suite by detected language. A Swift/Perl/
	// Python repo gets a single informative result instead of ~26 JS "missing"
	// findings. 'unknown' (bare dir) still runs the JS suite — that's a fresh
	// repo mid-setup. ponytail: per-check language tagging is the umbrella (#139)
	// follow-up; today the whole suite is JS, so a top-level guard is enough.
	const language = await detectLanguage(targetDir)
	if (language !== 'js' && language !== 'unknown') {
		return [
			{
				check: 'language',
				status: 'ok',
				detail: `detected ${language} project — ${PACKAGE} checks are JavaScript-focused and were skipped`,
			},
		]
	}

	const pkg = await readPackageJson(targetDir)
	const lock = await readLockfile(targetDir)
	const results: CheckResult[] = []

	results.push(evaluateNodeVersion(process.version))
	results.push(checkPackageJson(pkg))
	results.push(checkLockfile(lock))
	results.push(checkEnginesNode(pkg))
	results.push(await checkEditorConfig(targetDir))
	results.push(await checkVscodeExtensions(targetDir))
	results.push(await checkNodeVersionPin(targetDir))
	results.push(await checkNodeVersionConsistency(targetDir, pkg))
	for (const spec of FILE_CHECKS) {
		results.push(await checkFile(targetDir, spec))
	}
	results.push(await checkHusky(targetDir, pkg))
	results.push(await checkLintStaged(targetDir, pkg))
	results.push(await checkVerifyScript(targetDir, pkg))
	results.push(await checkHuskyPrePush(targetDir, pkg))
	results.push(await checkSemanticRelease(targetDir, pkg))
	results.push(await checkKnip(targetDir, pkg))
	results.push(await checkSizeLimit(targetDir, pkg))
	results.push(await checkGitHubActions(targetDir))
	results.push(await checkReleaseToken(targetDir))
	results.push(await checkDependabot(targetDir))
	results.push(await checkCodeQL(targetDir))
	// GitHub repo-settings drift (branch protection, merge settings, workflow
	// permissions). Read-only; self-skips as `ok` outside a live GitHub repo.
	results.push(...(await checkGitHubSettings(targetDir)))
	results.push(await checkGitLabCI(targetDir))
	results.push(await checkCodeowners(targetDir))
	results.push(await checkCommunityHealth(targetDir))
	results.push(await checkAiSetup(targetDir))
	results.push(await checkTypedoc(targetDir, pkg))
	results.push(await checkAreTheTypesWrong(targetDir, pkg))
	results.push(await checkPublint(targetDir, pkg))
	results.push(await checkReadmeBadges(targetDir, pkg))
	results.push(await checkCoverageUpload(targetDir))
	results.push(await checkTreeshakeSetup(targetDir, pkg))
	// Turborepo is monorepo-only — only surface the check when a workspace exists.
	if (await fs.pathExists(path.join(targetDir, 'pnpm-workspace.yaml'))) {
		results.push(await checkTurborepo(targetDir))
	}
	// Tailwind is opt-in — only surface the check when the repo actually depends on it.
	if ('tailwindcss' in allDeps(pkg)) {
		results.push(await checkTailwind(targetDir, pkg))
	}

	// Lockfile-driven demotion: if the lock records an intentional opt-out for a
	// check that's currently optional-missing, demote it to ok with a clear detail.
	if (lock) {
		return results.map((r) => {
			if (r.status !== 'optional-missing') return r
			if (!declinedInLock(lock, r.check)) return r
			return {
				check: r.check,
				status: 'ok',
				detail: 'intentionally declined (.js-tooling.json)',
			}
		})
	}

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
