import { join } from 'node:path'
import fs from 'fs-extra'
import { describe, expect, it, vi } from 'vitest'
import { checkGitHubSettings, type GhExec, type GhResult } from '../../../src/cli/utils/github-settings.js'
import { useTmpDir } from '../../helpers/tmp-dir.js'

const newTmpDir = useTmpDir()

/** A git repo (doctor's cheap .git gate must pass before gh runs). */
function gitRepo(): string {
	const dir = newTmpDir()
	fs.ensureDirSync(join(dir, '.git'))
	return dir
}

const ok = (stdout: string): GhResult => ({ ok: true, stdout, stderr: '', code: 0 })
const fail = (stderr: string, code: number | null = 1): GhResult => ({
	ok: false,
	stdout: '',
	stderr,
	code,
})

const COMPLIANT_PROBE = JSON.stringify({
	nameWithOwner: 'owner/repo',
	defaultBranchRef: { name: 'main' },
	autoMergeAllowed: true,
	squashMergeAllowed: true,
	deleteBranchOnMerge: true,
})
const COMPLIANT_PROTECTION = JSON.stringify({
	required_status_checks: { strict: false, contexts: ['lint', 'typecheck', 'build', 'test'] },
	enforce_admins: { enabled: false },
	allow_force_pushes: { enabled: false },
	allow_deletions: { enabled: false },
	required_pull_request_reviews: null,
})
const COMPLIANT_WORKFLOW = JSON.stringify({
	default_workflow_permissions: 'read',
	can_approve_pull_request_reviews: false,
})

/** Route canned responses by which gh subcommand is invoked. */
function fakeGh(overrides: { probe?: GhResult; protection?: GhResult; workflow?: GhResult } = {}): GhExec {
	return vi.fn(async (args: string[]) => {
		if (args[0] === 'repo') return overrides.probe ?? ok(COMPLIANT_PROBE)
		if (args[1]?.includes('/protection')) return overrides.protection ?? ok(COMPLIANT_PROTECTION)
		if (args[1]?.includes('/actions/permissions/workflow'))
			return overrides.workflow ?? ok(COMPLIANT_WORKFLOW)
		return fail('unexpected call')
	})
}

const byName = (results: { check: string }[], name: string) =>
	results.find((r) => r.check === name)

describe('checkGitHubSettings — skip paths', () => {
	it('never spawns gh outside a git repo', async () => {
		const exec = fakeGh()
		const results = await checkGitHubSettings(newTmpDir(), exec)
		expect(exec).not.toHaveBeenCalled()
		expect(results).toHaveLength(3)
		expect(results.every((r) => r.status === 'ok' && r.detail.includes('skipped'))).toBe(true)
	})

	it('skips all three when gh is not installed', async () => {
		const exec = fakeGh({ probe: fail('spawn gh ENOENT', null) })
		const results = await checkGitHubSettings(gitRepo(), exec)
		expect(results.every((r) => r.status === 'ok')).toBe(true)
		expect(byName(results, 'Branch protection')?.detail).toContain('gh not installed')
	})

	it('skips when the probe fails (no GitHub remote / not authed)', async () => {
		const exec = fakeGh({ probe: fail('gh auth login required') })
		const results = await checkGitHubSettings(gitRepo(), exec)
		expect(results.every((r) => r.status === 'ok' && r.detail.includes('skipped'))).toBe(true)
	})
})

describe('checkGitHubSettings — compliant repo', () => {
	it('reports all three ok when settings match the standard', async () => {
		const results = await checkGitHubSettings(gitRepo(), fakeGh())
		expect(results).toHaveLength(3)
		expect(results.every((r) => r.status === 'ok')).toBe(true)
		expect(byName(results, 'Branch protection')?.detail).toContain('protected per standard')
	})
})

describe('checkGitHubSettings — drift', () => {
	it('flags an unprotected default branch as optional-missing on 404', async () => {
		const exec = fakeGh({ protection: fail('gh: Not Found (HTTP 404)') })
		const results = await checkGitHubSettings(gitRepo(), exec)
		const bp = byName(results, 'Branch protection')
		expect(bp?.status).toBe('optional-missing')
		expect(bp?.detail).toContain('unprotected')
	})

	it('skips branch protection (not drift) when the token lacks admin (403)', async () => {
		const exec = fakeGh({ protection: fail('gh: Must have admin rights (HTTP 403)') })
		const bp = byName(await checkGitHubSettings(gitRepo(), exec), 'Branch protection')
		expect(bp?.status).toBe('ok')
		expect(bp?.detail).toContain('skipped')
	})

	it('drifts when a required status check is missing', async () => {
		const protection = ok(
			JSON.stringify({
				required_status_checks: { strict: false, contexts: ['lint', 'build', 'test'] },
				enforce_admins: { enabled: false },
				allow_force_pushes: { enabled: false },
				allow_deletions: { enabled: false },
			})
		)
		const bp = byName(await checkGitHubSettings(gitRepo(), fakeGh({ protection })), 'Branch protection')
		expect(bp?.status).toBe('drift')
		expect(bp?.detail).toContain('typecheck')
	})

	it('drifts when merge settings are off (from the probe)', async () => {
		const probe = ok(
			JSON.stringify({
				nameWithOwner: 'owner/repo',
				defaultBranchRef: { name: 'main' },
				autoMergeAllowed: false,
				squashMergeAllowed: true,
				deleteBranchOnMerge: true,
			})
		)
		const ms = byName(await checkGitHubSettings(gitRepo(), fakeGh({ probe })), 'Merge settings')
		expect(ms?.status).toBe('drift')
		expect(ms?.detail).toContain('auto-merge disabled')
	})

	it('drifts when default workflow permissions are write', async () => {
		const workflow = ok(
			JSON.stringify({
				default_workflow_permissions: 'write',
				can_approve_pull_request_reviews: false,
			})
		)
		const wp = byName(await checkGitHubSettings(gitRepo(), fakeGh({ workflow })), 'Workflow permissions')
		expect(wp?.status).toBe('drift')
		expect(wp?.detail).toContain('write')
	})
})
