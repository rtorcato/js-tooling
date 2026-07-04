import path from 'node:path'
import fs from 'fs-extra'
import { copyPreset, getPackageRoot } from '../utils/copy-preset.js'

/**
 * All agent rule files are generated from one source of truth — the shipped
 * Claude skill — so the guidance never drifts between agents. Only the
 * location and the frontmatter differ per agent.
 */
const SOURCE = 'tooling/claude/js-tooling.md'
const BLOCK_START = '<!-- js-tooling:start -->'
const BLOCK_END = '<!-- js-tooling:end -->'

export type AgentTarget = 'cursor' | 'copilot' | 'agents-md'

interface Skill {
	description: string
	body: string
}

/** Read the shipped skill and split its frontmatter from the markdown body. */
async function readSkill(): Promise<Skill> {
	const raw = await fs.readFile(path.join(getPackageRoot(), SOURCE), 'utf8')
	const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
	if (!match) return { description: '', body: raw.trim() }
	const description = (match[1].match(/^description:\s*(.+)$/m)?.[1] ?? '').trim()
	return { description, body: match[2].trim() }
}

/**
 * Upsert a delimited js-tooling block into a file that may already hold the
 * consumer's own content (AGENTS.md, copilot-instructions). Replaces an
 * existing block, appends if the file exists without one, creates otherwise.
 * Never clobbers surrounding content.
 */
export async function upsertBlock(filePath: string, body: string): Promise<void> {
	const block = `${BLOCK_START}\n${body}\n${BLOCK_END}`
	if (await fs.pathExists(filePath)) {
		const existing = await fs.readFile(filePath, 'utf8')
		const start = existing.indexOf(BLOCK_START)
		const end = existing.indexOf(BLOCK_END)
		if (start !== -1 && end !== -1) {
			const next = existing.slice(0, start) + block + existing.slice(end + BLOCK_END.length)
			await fs.writeFile(filePath, next)
			return
		}
		await fs.writeFile(filePath, `${existing.trimEnd()}\n\n${block}\n`)
		return
	}
	await fs.ensureDir(path.dirname(filePath))
	await fs.writeFile(filePath, `${block}\n`)
}

/**
 * Write CLAUDE.md as a thin pointer to AGENTS.md rather than duplicating the
 * guidance — Claude Code reads both, and `@AGENTS.md` keeps a single source of
 * truth. Merge-safe: only the delimited block is touched.
 */
export async function installClaudeMd(targetDir: string): Promise<string> {
	const rel = 'CLAUDE.md'
	const body =
		'See @AGENTS.md for project and agent guidance (kept in sync by `js-tooling fix ai`).'
	await upsertBlock(path.join(targetDir, rel), body)
	return rel
}

/**
 * Umbrella: install every AI agent file in one pass — AGENTS.md, the CLAUDE.md
 * pointer, Cursor + Copilot rules, the Claude skill, and the commented MCP
 * template. All are merge-safe or `.example`, so re-running is idempotent.
 * Returns the written paths (relative to targetDir).
 */
export async function installAiSetup(targetDir: string): Promise<string[]> {
	const written: string[] = []
	written.push(await installAgentRules(targetDir, 'agents-md'))
	written.push(await installClaudeMd(targetDir))
	written.push(await installAgentRules(targetDir, 'cursor'))
	written.push(await installAgentRules(targetDir, 'copilot'))
	written.push((await copyPreset('claude-skill', targetDir)).target)
	written.push((await copyPreset('mcp-example', targetDir)).target)
	return written
}

/** Install the js-tooling rules for one agent. Returns the written path (relative). */
export async function installAgentRules(targetDir: string, agent: AgentTarget): Promise<string> {
	const { description, body } = await readSkill()
	switch (agent) {
		case 'cursor': {
			const rel = path.join('.cursor', 'rules', 'js-tooling.mdc')
			const file = path.join(targetDir, rel)
			const frontmatter = `---\ndescription: ${description}\nglobs:\nalwaysApply: false\n---\n\n`
			await fs.ensureDir(path.dirname(file))
			await fs.writeFile(file, `${frontmatter}${body}\n`)
			return rel
		}
		case 'copilot': {
			const rel = path.join('.github', 'copilot-instructions.md')
			await upsertBlock(path.join(targetDir, rel), body)
			return rel
		}
		case 'agents-md': {
			const rel = 'AGENTS.md'
			await upsertBlock(path.join(targetDir, rel), body)
			return rel
		}
	}
}
