import path from 'node:path'
import chalk from 'chalk'
import fs from 'fs-extra'
import { resolveLanguageModule } from '../../languages/registry.js'
import { detectLanguage } from '../utils/detect-language.js'
import { checkGitHubSettings } from '../../base/github-settings.js'
import { type Lockfile, LOCKFILE_VERSION, readLockfile } from '../utils/lockfile.js'
import { declinedInLock, getFixTargetForCheck } from './fix-targets.js'
import {
	checkAiSetup,
	checkCodeowners,
	checkCodeQL,
	checkCommunityHealth,
	checkCoverageUpload,
	checkDependabot,
	checkEditorConfig,
	checkGitHubActions,
	checkGitLabCI,
} from '../../base/checks.js'
import type { CheckResult, CheckStatus } from '../../base/types.js'
import {
	allDeps,
	checkAreTheTypesWrong,
	checkDocsSite,
	checkEnginesNode,
	checkFile,
	checkHusky,
	checkHuskyPrePush,
	checkKnip,
	checkLintStaged,
	checkNodeVersionConsistency,
	checkNodeVersionPin,
	checkPackageJson,
	checkPublint,
	checkReadmeBadges,
	checkSemanticRelease,
	checkSizeLimit,
	checkTailwind,
	checkTreeshakeSetup,
	checkTurborepo,
	checkTypedoc,
	checkVerifyScript,
	checkVscodeExtensions,
	evaluateNodeVersion,
	FILE_CHECKS,
	findDocsAppDir,
	type Pkg,
	readPackageJson,
} from '../../languages/js/checks.js'

export type { CheckResult, CheckStatus }
export { evaluateNodeVersion }

export interface DoctorOptions {
	directory?: string
	json?: boolean
}

const PACKAGE = '@rtorcato/repo-tooling'

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

// Flags a release workflow still authenticating npm publish with a long-lived
// NPM_TOKEN secret instead of OIDC trusted publishing (#201). npm is deprecating
// 2FA-bypass tokens; OIDC needs no secret and adds provenance for free. Only
// relevant for public packages that actually publish to npm.
async function checkNpmOidcPublish(dir: string, pkg: Pkg | null): Promise<CheckResult> {
	const check = 'npm OIDC publish'
	if (!pkg || pkg.private === true) {
		return { check, status: 'optional-missing', detail: 'private package — no npm publish' }
	}
	const workflowsDir = path.join(dir, '.github', 'workflows')
	if (!(await fs.pathExists(workflowsDir))) {
		return { check, status: 'optional-missing', detail: 'no .github/workflows/' }
	}
	try {
		const files = await fs.readdir(workflowsDir)
		for (const f of files) {
			if (!(f.endsWith('.yml') || f.endsWith('.yaml'))) continue
			const content = await fs.readFile(path.join(workflowsDir, f), 'utf-8')
			if (!/semantic-release/.test(content)) continue
			if (/secrets\.NPM_TOKEN/.test(content)) {
				return {
					check,
					status: 'drift',
					detail: `${f} authenticates npm publish with NPM_TOKEN`,
					hint: 'Migrate to OIDC trusted publishing: add a Trusted Publisher for each published package on npmjs.com (Settings → Trusted Publisher), then run `fix github-actions` to drop NPM_TOKEN (the release job keeps `id-token: write`). npm is deprecating 2FA-bypass tokens.',
				}
			}
			return { check, status: 'ok', detail: `${f} publishes via OIDC (no NPM_TOKEN)` }
		}
		return { check, status: 'optional-missing', detail: 'no semantic-release workflow found' }
	} catch {
		return { check, status: 'optional-missing', detail: 'unable to read .github/workflows/' }
	}
}

function checkLockfile(lock: Lockfile | null): CheckResult {
	if (!lock) {
		return {
			check: 'lockfile',
			status: 'optional-missing',
			detail: 'no .repo-tooling.json — doctor cannot tell intentional opt-outs from drift',
			hint: 'Run `npx @rtorcato/repo-tooling fix lockfile` to record current choices',
		}
	}
	if (lock.version > LOCKFILE_VERSION) {
		return {
			check: 'lockfile',
			status: 'drift',
			detail: `.repo-tooling.json version ${lock.version} is newer than this CLI supports (v${LOCKFILE_VERSION})`,
			hint: 'Upgrade @rtorcato/repo-tooling to a release that supports this lockfile version',
		}
	}
	return {
		check: 'lockfile',
		status: 'ok',
		detail: `.repo-tooling.json v${lock.version} (written by ${lock.writtenBy})`,
	}
}

export async function runDoctor(dir: string): Promise<CheckResult[]> {
	const targetDir = path.resolve(dir)

	// Seam: gate the whole JS check suite by detected language via the language
	// registry (#280). An unsupported (Swift/Perl/Python) repo gets a single
	// informative result instead of ~26 JS "missing" findings. 'unknown' (bare
	// dir) resolves to JS — a fresh repo mid-setup still runs the full suite.
	// ponytail: this is still the coarse gate; per-module dispatch is #285.
	const language = await detectLanguage(targetDir)
	const languageModule = resolveLanguageModule(language)
	if (!languageModule.supported) {
		return [
			{
				check: 'language',
				status: 'ok',
				detail: `detected ${languageModule.label} project — ${PACKAGE} checks are JavaScript-focused and were skipped`,
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
	results.push(await checkNpmOidcPublish(targetDir, pkg))
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
	// Docs site is opt-in — only surface the check when a Docusaurus site exists.
	const docsAppDir = await findDocsAppDir(targetDir)
	if (docsAppDir) {
		results.push(await checkDocsSite(targetDir, docsAppDir))
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
				detail: 'intentionally declined (.repo-tooling.json)',
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
		lines.push(`Run \`npx @rtorcato/repo-tooling fix ${target}\` to ${verb} ${r.check}`)
	}
	if (overflow > 0) {
		lines.push(
			`...and ${overflow} more — run \`npx @rtorcato/repo-tooling fix\` to walk all findings`
		)
	} else if (lines.length > 0) {
		lines.push('Run `npx @rtorcato/repo-tooling fix` to walk all findings interactively')
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
