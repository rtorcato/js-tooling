import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'fs-extra'
import type { CheckResult } from '../commands/doctor.js'

/**
 * Machine-checks the GitHub side of the js-tooling standard — branch
 * protection, merge settings, workflow permissions — which doctor's
 * file-on-disk checks can't see (#137). Read-only. Shells out to `gh` via an
 * injectable seam (no octokit, zero deps, auth for free), modeled on
 * install.ts's resolve-never-reject style. checkGitHubSettings reports drift;
 * applyGitHubSettings (#138) writes the same standard back via `fix
 * github-settings`.
 */

export interface GhResult {
	ok: boolean
	stdout: string
	stderr: string
	/** Process exit code, or null when gh never ran / timed out. */
	code: number | null
}

/** `input`, when set, is written to gh's stdin (used for JSON request bodies). */
export type GhExec = (args: string[], input?: string) => Promise<GhResult>

const GH_TIMEOUT_MS = 10_000

/** Real `gh` runner — never rejects; a missing/failing gh resolves ok:false. */
export const realGhExec: GhExec = (args, input) =>
	new Promise((resolve) => {
		let settled = false
		const done = (r: GhResult) => {
			if (settled) return
			settled = true
			clearTimeout(timer)
			resolve(r)
		}
		// gh args are internal/derived from gh itself (never user free-text), so
		// shell:false + an args array keeps this injection-safe. stdin is piped
		// only when we have a body to send (e.g. the branch-protection JSON).
		const child = spawn('gh', args, {
			stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
		})
		let stdout = ''
		let stderr = ''
		const timer = setTimeout(() => {
			child.kill()
			done({ ok: false, stdout: '', stderr: 'gh timed out', code: null })
		}, GH_TIMEOUT_MS)
		child.stdout?.on('data', (d) => {
			stdout += d
		})
		child.stderr?.on('data', (d) => {
			stderr += d
		})
		child.on('close', (code) => done({ ok: code === 0, stdout, stderr, code }))
		child.on('error', (err) => done({ ok: false, stdout: '', stderr: String(err), code: null }))
		if (input !== undefined) {
			child.stdin?.end(input)
		}
	})

/** The standard doctor checks these settings against. */
export const GITHUB_STANDARD = {
	// Required status contexts on the default branch (strict off — see below).
	requiredContexts: ['lint', 'typecheck', 'build', 'test'],
} as const

const CHECK_NAMES = ['Branch protection', 'Merge settings', 'Workflow permissions'] as const

/** All three checks as an `ok` skip — keeps them out of next-steps and exit code. */
function skipAll(reason: string): CheckResult[] {
	return CHECK_NAMES.map((check) => ({ check, status: 'ok', detail: `skipped — ${reason}` }))
}

function skip(check: string, reason: string): CheckResult {
	return { check, status: 'ok', detail: `skipped — ${reason}` }
}

interface RepoProbe {
	nameWithOwner?: string
	defaultBranchRef?: { name?: string } | null
	autoMergeAllowed?: boolean
	squashMergeAllowed?: boolean
	deleteBranchOnMerge?: boolean
}

export async function checkGitHubSettings(
	dir: string,
	exec: GhExec = realGhExec
): Promise<CheckResult[]> {
	// Cheap gate first: no .git → never spawn (keeps tmp-dir doctor runs offline).
	if (!(await fs.pathExists(path.join(dir, '.git')))) return skipAll('not a git repository')

	// One combined probe: proves gh is installed + authed + has a GitHub remote
	// + online, and carries the merge settings in the same call.
	const probe = await exec([
		'repo',
		'view',
		'--json',
		'nameWithOwner,defaultBranchRef,autoMergeAllowed,squashMergeAllowed,deleteBranchOnMerge',
	])
	if (!probe.ok) return skipAll(probeFailureReason(probe))

	let meta: RepoProbe
	try {
		meta = JSON.parse(probe.stdout) as RepoProbe
	} catch {
		return skipAll('could not parse gh output')
	}
	const nwo = meta.nameWithOwner
	if (!nwo) return skipAll('no GitHub remote')
	const branch = meta.defaultBranchRef?.name ?? 'main'

	return [
		await checkBranchProtection(exec, nwo, branch),
		checkMergeSettings(meta),
		await checkWorkflowPermissions(exec, nwo),
	]
}

function probeFailureReason(probe: GhResult): string {
	if (probe.code === null) return 'gh not installed'
	if (/not logged|gh auth login|authentication/i.test(probe.stderr)) return 'gh not authenticated'
	return 'not a GitHub repo or gh unavailable'
}

async function checkBranchProtection(
	exec: GhExec,
	nwo: string,
	branch: string
): Promise<CheckResult> {
	const check = 'Branch protection'
	const r = await exec(['api', `repos/${nwo}/branches/${branch}/protection`])
	if (!r.ok) {
		if (/404|not found/i.test(r.stderr)) {
			return {
				check,
				status: 'optional-missing',
				detail: `${branch} is unprotected`,
				hint: 'Run `npx @rtorcato/js-tooling fix github-settings` to apply branch protection',
			}
		}
		if (/403|forbidden/i.test(r.stderr)) return skip(check, 'token lacks admin access')
		return skip(check, 'could not read branch protection')
	}

	let p: Record<string, any>
	try {
		p = JSON.parse(r.stdout)
	} catch {
		return skip(check, 'could not parse protection response')
	}

	const deltas: string[] = []
	const contexts: string[] = p.required_status_checks?.contexts ?? []
	const missing = GITHUB_STANDARD.requiredContexts.filter((c) => !contexts.includes(c))
	if (missing.length) deltas.push(`missing required checks: ${missing.join(', ')}`)
	if (p.required_status_checks?.strict === true)
		deltas.push('strict status checks on (should be off)')
	// enforce_admins must stay off so the App/RELEASE_TOKEN can bypass protection
	// to push semantic-release's version commit (see Release-token doctor check).
	if (p.enforce_admins?.enabled === true) deltas.push('enforce_admins on (blocks release bypass)')
	if (p.allow_force_pushes?.enabled === true) deltas.push('force pushes allowed')
	if (p.allow_deletions?.enabled === true) deltas.push('branch deletions allowed')
	// Required human review deadlocks solo Dependabot auto-merge.
	if (p.required_pull_request_reviews) deltas.push('required PR reviews on (deadlocks auto-merge)')

	if (deltas.length)
		return {
			check,
			status: 'drift',
			detail: deltas.join('; '),
			hint: 'Run `npx @rtorcato/js-tooling fix github-settings` to align branch protection',
		}
	return { check, status: 'ok', detail: `${branch} protected per standard` }
}

function checkMergeSettings(meta: RepoProbe): CheckResult {
	const check = 'Merge settings'
	const deltas: string[] = []
	if (!meta.autoMergeAllowed) deltas.push('auto-merge disabled')
	if (!meta.squashMergeAllowed) deltas.push('squash-merge disabled')
	if (!meta.deleteBranchOnMerge) deltas.push('delete-branch-on-merge disabled')
	if (deltas.length)
		return {
			check,
			status: 'drift',
			detail: deltas.join('; '),
			hint: 'Run `npx @rtorcato/js-tooling fix github-settings` to enable auto-merge, squash-merge, and delete-branch-on-merge',
		}
	return { check, status: 'ok', detail: 'auto-merge, squash-merge, delete-on-merge all on' }
}

async function checkWorkflowPermissions(exec: GhExec, nwo: string): Promise<CheckResult> {
	const check = 'Workflow permissions'
	const r = await exec(['api', `repos/${nwo}/actions/permissions/workflow`])
	if (!r.ok) {
		if (/403|forbidden/i.test(r.stderr)) return skip(check, 'token lacks admin access')
		return skip(check, 'could not read workflow permissions')
	}
	let p: Record<string, any>
	try {
		p = JSON.parse(r.stdout)
	} catch {
		return skip(check, 'could not parse permissions response')
	}
	const deltas: string[] = []
	if (p.default_workflow_permissions !== 'read')
		deltas.push(`default permissions '${p.default_workflow_permissions}' (should be read)`)
	if (p.can_approve_pull_request_reviews === true)
		deltas.push('workflows can approve PRs (should be off)')
	if (deltas.length)
		return {
			check,
			status: 'drift',
			detail: deltas.join('; '),
			hint: 'Run `npx @rtorcato/js-tooling fix github-settings` to set read-only workflow permissions',
		}
	return { check, status: 'ok', detail: 'read-only default, no workflow PR approvals' }
}

// ---------------------------------------------------------------------------
// Apply side (#138): write the same standard the checks above read. Mirrors
// checkGitHubSettings — one probe to prove gh/auth/remote, then PUT/PATCH each
// setting. Never throws; a missing/unauthed gh or a failed call resolves to a
// `skipped`/`failed` result so the fixer degrades gracefully.
// ---------------------------------------------------------------------------

export interface ApplyResult {
	setting: (typeof CHECK_NAMES)[number]
	status: 'applied' | 'skipped' | 'failed'
	detail: string
}

/** The branch-protection body encoding the standard checkBranchProtection reads. */
function branchProtectionBody(): string {
	return JSON.stringify({
		required_status_checks: { strict: false, contexts: GITHUB_STANDARD.requiredContexts },
		// enforce_admins off so the App/RELEASE_TOKEN can bypass to push the
		// semantic-release version commit (see checkBranchProtection).
		enforce_admins: false,
		required_pull_request_reviews: null,
		restrictions: null,
		allow_force_pushes: false,
		allow_deletions: false,
	})
}

export async function applyGitHubSettings(
	dir: string,
	exec: GhExec = realGhExec
): Promise<ApplyResult[]> {
	if (!(await fs.pathExists(path.join(dir, '.git')))) {
		return skippedApply('not a git repository')
	}
	const probe = await exec(['repo', 'view', '--json', 'nameWithOwner,defaultBranchRef'])
	if (!probe.ok) return skippedApply(probeFailureReason(probe))

	let meta: RepoProbe
	try {
		meta = JSON.parse(probe.stdout) as RepoProbe
	} catch {
		return skippedApply('could not parse gh output')
	}
	const nwo = meta.nameWithOwner
	if (!nwo) return skippedApply('no GitHub remote')
	const branch = meta.defaultBranchRef?.name ?? 'main'

	return [
		await applyBranchProtection(exec, nwo, branch),
		await applyMergeSettings(exec, nwo),
		await applyWorkflowPermissions(exec, nwo),
	]
}

function skippedApply(reason: string): ApplyResult[] {
	return CHECK_NAMES.map((setting) => ({
		setting,
		status: 'skipped',
		detail: `skipped — ${reason}`,
	}))
}

/** Map a failed gh write to a friendly result; 403 → skipped (no admin), else failed. */
function applyFailure(setting: ApplyResult['setting'], r: GhResult): ApplyResult {
	if (/403|forbidden/i.test(r.stderr)) {
		return { setting, status: 'skipped', detail: 'skipped — token lacks admin access' }
	}
	return { setting, status: 'failed', detail: r.stderr.trim() || 'gh call failed' }
}

async function applyBranchProtection(
	exec: GhExec,
	nwo: string,
	branch: string
): Promise<ApplyResult> {
	const r = await exec(
		['api', '--method', 'PUT', `repos/${nwo}/branches/${branch}/protection`, '--input', '-'],
		branchProtectionBody()
	)
	if (!r.ok) return applyFailure('Branch protection', r)
	return {
		setting: 'Branch protection',
		status: 'applied',
		detail: `${branch}: require ${GITHUB_STANDARD.requiredContexts.join(', ')}; no force-push/deletions/reviews`,
	}
}

async function applyMergeSettings(exec: GhExec, nwo: string): Promise<ApplyResult> {
	const r = await exec([
		'api',
		'--method',
		'PATCH',
		`repos/${nwo}`,
		'-F',
		'allow_auto_merge=true',
		'-F',
		'allow_squash_merge=true',
		'-F',
		'delete_branch_on_merge=true',
	])
	if (!r.ok) return applyFailure('Merge settings', r)
	return {
		setting: 'Merge settings',
		status: 'applied',
		detail: 'auto-merge, squash-merge, delete-branch-on-merge enabled',
	}
}

async function applyWorkflowPermissions(exec: GhExec, nwo: string): Promise<ApplyResult> {
	const r = await exec([
		'api',
		'--method',
		'PUT',
		`repos/${nwo}/actions/permissions/workflow`,
		'-f',
		'default_workflow_permissions=read',
		'-F',
		'can_approve_pull_request_reviews=false',
	])
	if (!r.ok) return applyFailure('Workflow permissions', r)
	return {
		setting: 'Workflow permissions',
		status: 'applied',
		detail: 'read-only default, workflow PR approvals disabled',
	}
}
