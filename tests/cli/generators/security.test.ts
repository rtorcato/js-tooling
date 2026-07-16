import { join } from 'node:path'
import fs from 'fs-extra'
import { describe, expect, it } from 'vitest'
import {
	generateCodeQLWorkflow,
	generateDependabotAutomerge,
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
	})

	it('uses the canonical groups and monthly cadence with a 5-PR ceiling', async () => {
		const dir = newTmpDir()
		await generateDependabotConfig(dir)
		const content = await fs.readFile(join(dir, '.github', 'dependabot.yml'), 'utf-8')
		expect(content).toMatch(/production-minor/)
		expect(content).toMatch(/dev-minor/)
		expect(content).toMatch(/major-updates/)
		expect(content).toMatch(/open-pull-requests-limit: 5/)
		// dependency-type split (prod vs dev) is what makes the auto-merge tier safe.
		expect(content).toMatch(/dependency-type: production/)
		expect(content).toMatch(/dependency-type: development/)
	})
})

describe('generateDependabotAutomerge', () => {
	it('writes the auto-merge workflow gated to patch + minor', async () => {
		const dir = newTmpDir()
		await generateDependabotAutomerge(dir)
		const content = await fs.readFile(
			join(dir, '.github', 'workflows', 'dependabot-automerge.yml'),
			'utf-8'
		)
		expect(content).toMatch(/dependabot\/fetch-metadata/)
		expect(content).toMatch(/version-update:semver-patch/)
		expect(content).toMatch(/version-update:semver-minor/)
		expect(content).toMatch(/gh pr merge --auto --squash/)
		// majors must NOT be auto-merged.
		expect(content).not.toMatch(/semver-major/)
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
	it('writes dependabot config, auto-merge workflow, and codeql config', async () => {
		const dir = newTmpDir()
		await generateSecurityConfigs(dir)
		expect(await fs.pathExists(join(dir, '.github', 'dependabot.yml'))).toBe(true)
		expect(await fs.pathExists(join(dir, '.github', 'workflows', 'dependabot-automerge.yml'))).toBe(
			true
		)
		expect(await fs.pathExists(join(dir, '.github', 'workflows', 'codeql.yml'))).toBe(true)
	})
})
