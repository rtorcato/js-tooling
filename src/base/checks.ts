import path from 'node:path'
import fs from 'fs-extra'
import type { CheckResult } from './types.js'

/**
 * "Is one of these files present, and does it look like ours?" — the shape most
 * config checks take, in any language. Lives in base so the JS and Swift modules
 * share one implementation instead of two regex-and-fs loops (#286).
 */
export interface FileCheck {
	check: string
	candidates: string[]
	/** Phrased to read after the filename: `.swiftlint.yml ${expected}`. */
	expected: string
	matcher: RegExp
	optional?: boolean
	hint?: string
}

export async function checkFile(dir: string, spec: FileCheck): Promise<CheckResult> {
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

export async function checkEditorConfig(dir: string): Promise<CheckResult> {
	const exists = await fs.pathExists(path.join(dir, '.editorconfig'))
	return {
		check: 'EditorConfig',
		status: exists ? 'ok' : 'optional-missing',
		detail: exists ? '.editorconfig found' : 'no .editorconfig',
		hint: exists ? undefined : 'Add an .editorconfig for cross-editor formatting consistency',
	}
}

export async function checkCodeowners(dir: string): Promise<CheckResult> {
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
		hint: 'Run `npx @rtorcato/repo-tooling fix codeowners` to scaffold .github/CODEOWNERS',
	}
}

export async function checkCommunityHealth(dir: string): Promise<CheckResult> {
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
		hint: 'Run `npx @rtorcato/repo-tooling fix community-health` to scaffold them',
	}
}

export async function checkGitHubActions(dir: string): Promise<CheckResult> {
	const workflowsDir = path.join(dir, '.github', 'workflows')
	if (!(await fs.pathExists(workflowsDir))) {
		return {
			check: 'GitHub Actions',
			status: 'optional-missing',
			detail: 'no .github/workflows/',
			hint: 'Run `npx @rtorcato/repo-tooling setup` to scaffold a CI workflow',
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

export async function checkDependabot(dir: string): Promise<CheckResult> {
	for (const candidate of ['.github/dependabot.yml', '.github/dependabot.yaml']) {
		const candidatePath = path.join(dir, candidate)
		if (await fs.pathExists(candidatePath)) {
			// The canonical standard (apps/docs/docs/guides/dependabot-strategy.md) is
			// the safe-tier + major-tier grouping plus the auto-merge workflow that
			// depends on it. Flag any config that predates it so `fix dependabot` can
			// bring the pair up to standard.
			const content = await fs.readFile(candidatePath, 'utf8')
			const deltas: string[] = []
			for (const group of ['production-minor', 'dev-minor', 'major-updates']) {
				if (!new RegExp(`^\\s*${group}:`, 'm').test(content)) {
					deltas.push(`missing \`${group}\` group`)
				}
			}
			const automergePath = path.join(dir, '.github', 'workflows', 'dependabot-automerge.yml')
			if (!(await fs.pathExists(automergePath))) {
				deltas.push('missing dependabot-automerge workflow')
			}
			if (deltas.length > 0) {
				return {
					check: 'Dependabot',
					status: 'drift',
					detail: `${candidate} drifts from canonical (${deltas.join('; ')})`,
					hint: 'Run `npx @rtorcato/repo-tooling fix dependabot` to apply the canonical grouping + auto-merge workflow',
				}
			}
			return {
				check: 'Dependabot',
				status: 'ok',
				detail: `${candidate} + auto-merge workflow`,
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
		hint: 'Run `npx @rtorcato/repo-tooling fix dependabot` (or `fix renovate`) to scaffold weekly dep updates',
	}
}

export async function checkCodeQL(dir: string): Promise<CheckResult> {
	const workflowsDir = path.join(dir, '.github', 'workflows')
	if (!(await fs.pathExists(workflowsDir))) {
		return {
			check: 'CodeQL',
			status: 'optional-missing',
			detail: 'no .github/workflows/',
			hint: 'Run `npx @rtorcato/repo-tooling fix codeql` to scaffold CodeQL security scanning',
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
		hint: 'Run `npx @rtorcato/repo-tooling fix codeql` to scaffold CodeQL security scanning',
	}
}

// A README that advertises a Codecov badge but a CI that never uploads coverage
// leaves the badge permanently red. Only flags when the badge is actually present
// (no badge → nothing to back, so it's not applicable).
export async function checkCoverageUpload(dir: string): Promise<CheckResult> {
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
		hint: 'Run `npx @rtorcato/repo-tooling fix github-actions` to regenerate ci.yml with a Codecov upload step',
	}
}

export async function checkAiSetup(dir: string): Promise<CheckResult> {
	// Consider AI setup present if AGENTS.md carries the js-tooling block or the
	// Claude skill is installed — the two primary markers `fix ai` writes.
	const agentsPath = path.join(dir, 'AGENTS.md')
	const hasAgentsBlock =
		(await fs.pathExists(agentsPath)) &&
		(await fs.readFile(agentsPath, 'utf8')).includes('<!-- js-tooling:start -->')
	const hasSkill =
		(await fs.pathExists(path.join(dir, '.claude', 'skills', 'repo-tooling.md'))) ||
		// Pre-rename name — still counts as present until `fix` migrates it.
		(await fs.pathExists(path.join(dir, '.claude', 'skills', 'js-tooling.md')))
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
		hint: 'Run `npx @rtorcato/repo-tooling fix ai` to scaffold agent rules for every AI tool',
	}
}

export async function checkGitLabCI(dir: string): Promise<CheckResult> {
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
		hint: 'Run `npx @rtorcato/repo-tooling fix gitlab-ci` to scaffold a starter GitLab pipeline',
	}
}
