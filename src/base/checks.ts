import path from 'node:path'
import fs from 'fs-extra'
import type { CheckResult } from './types.js'

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
