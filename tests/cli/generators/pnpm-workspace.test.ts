import { join } from 'node:path'
import fs from 'fs-extra'
import { describe, expect, it } from 'vitest'
import { checkPnpmWorkspace } from '../../../src/languages/js/checks.js'
import {
	ensurePnpmSettings,
	missingPnpmSettings,
	upsertPnpmSettings,
} from '../../../src/cli/generators/pnpm-workspace.js'
import { useTmpDir } from '../../helpers/tmp-dir.js'

const newTmpDir = useTmpDir()

describe('upsertPnpmSettings', () => {
	it('writes every managed setting into an empty file', () => {
		const yaml = upsertPnpmSettings('', true)
		expect(yaml).toContain('verifyDepsBeforeRun: false')
		expect(yaml).toContain("- '@rtorcato/*'")
		expect(yaml).toContain('esbuild: true')
		expect(missingPnpmSettings(yaml, true)).toEqual([])
	})

	// The whole point of #314's "merge, don't overwrite" note: the file also
	// carries the repo's own globs and hand-vetted build approvals.
	it('keeps existing keys and merges into the lists already there', () => {
		const before = `packages:
  - 'apps/*'

allowBuilds:
  core-js: false
  esbuild: true

minimumReleaseAgeExclude:
  - tinyglobby
`
		const after = upsertPnpmSettings(before, true)
		expect(after).toContain("- 'apps/*'")
		expect(after).toContain('core-js: false')
		expect(after).toContain('- tinyglobby')
		expect(after).toContain("- '@rtorcato/*'")
		// esbuild was already approved, so allowBuilds is left exactly as found.
		expect(after.match(/esbuild: true/g)).toHaveLength(1)
	})

	it('respects an explicit verifyDepsBeforeRun rather than resetting it', () => {
		const after = upsertPnpmSettings('verifyDepsBeforeRun: true\n', false)
		expect(after).toContain('verifyDepsBeforeRun: true')
		expect(after).not.toContain('verifyDepsBeforeRun: false')
	})

	it('leaves allowBuilds alone when no bundler needs esbuild', () => {
		expect(upsertPnpmSettings('', false)).not.toContain('allowBuilds')
	})

	it('is idempotent', () => {
		const once = upsertPnpmSettings('', true)
		expect(upsertPnpmSettings(once, true)).toBe(once)
	})
})

describe('checkPnpmWorkspace', () => {
	it('stays quiet on a repo that does not use pnpm', async () => {
		const dir = newTmpDir()
		expect((await checkPnpmWorkspace(dir, {})).status).toBe('ok')
	})

	it('flags an existing workspace file that is missing the settings', async () => {
		const dir = newTmpDir()
		await fs.writeFile(join(dir, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n")
		const before = await checkPnpmWorkspace(dir, {})
		expect(before.status).toBe('drift')
		expect(before.detail).toContain('@rtorcato/*')

		await ensurePnpmSettings(dir, false)
		expect((await checkPnpmWorkspace(dir, {})).status).toBe('ok')
	})

	// A pnpm repo with no workspace file hasn't drifted — it never opted in — so
	// this is a gray suggestion, not a CI-failing finding.
	it('only suggests the file when a pnpm repo has none', async () => {
		const dir = newTmpDir()
		await fs.writeFile(join(dir, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n')
		expect((await checkPnpmWorkspace(dir, {})).status).toBe('optional-missing')
	})
})
