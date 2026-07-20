import { join } from 'node:path'
import fs from 'fs-extra'
import { describe, expect, it } from 'vitest'
import {
	generateCodeQLWorkflow,
	generateDependabotConfig,
	generateSecurityConfigs,
} from '../../../src/cli/generators/security.js'
import { useTmpDir } from '../../helpers/tmp-dir.js'

const newTmpDir = useTmpDir()

describe('generateDependabotConfig', () => {
	it('writes .github/dependabot.yml with npm and github-actions ecosystems', async () => {
		const dir = newTmpDir()
		await generateDependabotConfig(dir)
		const filepath = join(dir, '.github', 'dependabot.yml')
		expect(await fs.pathExists(filepath)).toBe(true)
		const content = await fs.readFile(filepath, 'utf-8')
		expect(content).toMatch(/package-ecosystem: npm/)
		expect(content).toMatch(/package-ecosystem: github-actions/)
		expect(content).toMatch(/interval: monthly/)
		expect(content).toMatch(/open-pull-requests-limit: 5/)
		// `schedule.day` is weekly-only and must be a weekday name — invalid under
		// monthly, which already runs on the 1st. Guard against it regressing.
		expect(content).not.toMatch(/^\s*day:/m)
		// cooldown lets fresh releases settle so a same-day bump can't trip the
		// minimumReleaseAge supply-chain check in CI.
		expect(content).toMatch(/cooldown:\s*\n\s*default-days: 7/)
	})

	it('uses the canonical safe-tier + major-tier grouping', async () => {
		const dir = newTmpDir()
		await generateDependabotConfig(dir)
		const content = await fs.readFile(join(dir, '.github', 'dependabot.yml'), 'utf-8')
		expect(content).toMatch(/^\s*production-minor:/m)
		expect(content).toMatch(/^\s*dev-minor:/m)
		expect(content).toMatch(/^\s*major-updates:/m)
	})

	it('also scaffolds the auto-merge workflow and returns both paths', async () => {
		const dir = newTmpDir()
		const written = await generateDependabotConfig(dir)
		const workflow = join(dir, '.github', 'workflows', 'dependabot-automerge.yml')
		expect(await fs.pathExists(workflow)).toBe(true)
		const content = await fs.readFile(workflow, 'utf-8')
		expect(content).toMatch(/dependabot\/fetch-metadata/)
		expect(content).toMatch(/gh pr merge --auto --squash/)
		expect(written).toEqual([
			'.github/dependabot.yml',
			'.github/workflows/dependabot-automerge.yml',
		])
	})
})

describe('generateCodeQLWorkflow', () => {
	it('writes .github/workflows/codeql.yml referencing codeql-action', async () => {
		const dir = newTmpDir()
		await generateCodeQLWorkflow(dir)
		const filepath = join(dir, '.github', 'workflows', 'codeql.yml')
		expect(await fs.pathExists(filepath)).toBe(true)
		const content = await fs.readFile(filepath, 'utf-8')
		expect(content).toMatch(/github\/codeql-action\/init/)
		expect(content).toMatch(/github\/codeql-action\/analyze/)
		expect(content).toMatch(/javascript-typescript/)
	})
})

describe('generateSecurityConfigs', () => {
	it('writes both dependabot and codeql configs', async () => {
		const dir = newTmpDir()
		await generateSecurityConfigs(dir)
		expect(await fs.pathExists(join(dir, '.github', 'dependabot.yml'))).toBe(true)
		expect(await fs.pathExists(join(dir, '.github', 'workflows', 'codeql.yml'))).toBe(true)
	})
})
