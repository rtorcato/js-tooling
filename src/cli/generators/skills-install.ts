// Documents the one-command `npx skills add` install for every agent skill a
// repo ships under `skills/<name>/SKILL.md`. All values are derived from the
// repo (its skills dir + package.json `repository`) so it works for any consumer.

import path from 'node:path'
import fs from 'fs-extra'
import { upsertBlock } from './agent-rules.js'
import { parseRepository } from './badges.js'

export const SKILLS_DOCS_START = '<!-- js-tooling:skills:start -->'
export const SKILLS_DOCS_END = '<!-- js-tooling:skills:end -->'

/** Names of `skills/<name>/` directories that actually contain a SKILL.md. */
export async function findSkills(targetDir: string): Promise<string[]> {
	const skillsDir = path.join(targetDir, 'skills')
	if (!(await fs.pathExists(skillsDir))) return []
	const entries = await fs.readdir(skillsDir, { withFileTypes: true })
	const names: string[] = []
	for (const entry of entries) {
		if (!entry.isDirectory()) continue
		if (await fs.pathExists(path.join(skillsDir, entry.name, 'SKILL.md'))) names.push(entry.name)
	}
	return names.sort()
}

/**
 * Build the README section body (inner content, no delimiters) listing one
 * `npx skills add` command per skill. Returns '' when there are no skills.
 */
export function buildSkillsInstallBody(owner: string, repo: string, skills: string[]): string {
	if (skills.length === 0) return ''
	const commands = skills
		.map((s) => `npx skills add https://github.com/${owner}/${repo} --skill ${s}`)
		.join('\n')
	const plural = skills.length > 1 ? 's' : ''
	return [
		`## Install the skill${plural} (\`npx skills\`)`,
		'',
		`Any agent that supports the [\`skills\`](https://www.npmjs.com/package/skills) CLI can install this repo's skill${plural} straight from GitHub — no clone, no package install:`,
		'',
		'```bash',
		commands,
		'```',
	].join('\n')
}

/**
 * Add or refresh a "Install the skill" block in README.md. No-op (returns null)
 * when the repo ships no skills or package.json has no GitHub `repository` to
 * build the URL from. Merge-safe: only the delimited block is touched.
 */
export async function installSkillsInstallDocs(targetDir: string): Promise<string | null> {
	const skills = await findSkills(targetDir)
	if (skills.length === 0) return null
	const pkgPath = path.join(targetDir, 'package.json')
	const pkg = (await fs.pathExists(pkgPath))
		? ((await fs.readJson(pkgPath).catch(() => null)) as Record<string, unknown> | null)
		: null
	const parsed = parseRepository(pkg?.repository)
	if (!parsed) return null
	const body = buildSkillsInstallBody(parsed.owner, parsed.repo, skills)
	if (!body) return null
	await upsertBlock(path.join(targetDir, 'README.md'), body, {
		start: SKILLS_DOCS_START,
		end: SKILLS_DOCS_END,
	})
	return 'README.md'
}
