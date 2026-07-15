import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'fs-extra'
import type { CheckResult } from '../commands/doctor.js'

/**
 * Machine-checks the GitHub side of the js-tooling standard — branch
 * protection, merge settings, workflow permissions — which doctor's
 * file-on-disk checks can't see (#137). Read-only. Shells out to `gh` via an
 * injectable seam (no octokit, zero deps, auth for free), modeled on
 * install.ts's resolve-never-reject style. The applying fixer is a follow-up
 * (#138); these checks only report.
 */

export interface GhResult {
	ok: boolean
	stdout: string
	stderr: string
	/** Process exit code, or null when gh never ran / timed out. */
	code: number | null
}

export type GhExec = (args: string[]) => Promise<GhResult>

const GH_TIMEOUT_MS = 10_000

/** Real `gh` runner — never rejects; a missing/failing gh resolves ok:false. */
export const realGhExec: GhExec = (args) =>
	new Promise((resolve) => {
		let settled = false
		const done = (r: GhResult) => {
			if (settled) return
			settled = true
			clearTimeout(timer)
			resolve(r)
		}
		// gh args are internal/derived from gh itself (never user free-text), so
		// shell:false + an args array keeps this injection-safe.
		const child = spawn('gh', args, { stdio: ['ignore', 'pipe', 'pipe'] })
		let stdout = ''
		let stderr = ''
		const timer = setTimeout(() => {
			child.kill()
			done({ ok: false, stdout: '', stderr: 'gh timed out', code: null })
		}, GH_TIMEOUT_MS)
		child.stdout.on('data', (d) => {
			stdout += d
		})
		child.stderr.on('data', (d) => {
			stderr += d
		})
		child.on('close', (code) => done({ ok: code === 0, stdout, stderr, code }))
		child.on('error', (err) => done({ ok: false, stdout: '', stderr: String(err), code: null }))
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
				hint: `Protect ${branch}: require checks ${GITHUB_STANDARD.requiredContexts.join(', ')}, no force-push/deletions`,
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
			hint: `Align ${branch} protection with the standard`,
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
			hint: 'Enable auto-merge, squash-merge, and delete-branch-on-merge in repo settings',
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
			hint: 'Set default workflow permissions to read-only and disable workflow PR approvals',
		}
	return { check, status: 'ok', detail: 'read-only default, no workflow PR approvals' }
}
