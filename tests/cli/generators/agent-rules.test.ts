import { join } from 'node:path'
import fs from 'fs-extra'
import { describe, expect, it } from 'vitest'
import { installAiSetup, installClaudeMd } from '../../../src/cli/generators/agent-rules.js'
import { useTmpDir } from '../../helpers/tmp-dir.js'

const newTmpDir = useTmpDir()

const AI_FILES = [
	'AGENTS.md',
	'CLAUDE.md',
	'.cursor/rules/js-tooling.mdc',
	'.github/copilot-instructions.md',
	'.claude/skills/js-tooling.md',
	'.mcp.json.example',
]

describe('installAiSetup', () => {
	it('writes every AI agent file and returns their paths', async () => {
		const dir = newTmpDir()
		const written = await installAiSetup(dir)
		expect(written).toEqual(AI_FILES)
		for (const rel of AI_FILES) {
			expect(await fs.pathExists(join(dir, rel))).toBe(true)
		}
	})

	it('makes CLAUDE.md a pointer to AGENTS.md, not a duplicate', async () => {
		const dir = newTmpDir()
		await installAiSetup(dir)
		const claude = await fs.readFile(join(dir, 'CLAUDE.md'), 'utf8')
		expect(claude).toContain('@AGENTS.md')
		expect(claude).toContain('<!-- js-tooling:start -->')
	})

	it('ships the MCP template as .example and never an active .mcp.json', async () => {
		const dir = newTmpDir()
		await installAiSetup(dir)
		expect(await fs.pathExists(join(dir, '.mcp.json.example'))).toBe(true)
		expect(await fs.pathExists(join(dir, '.mcp.json'))).toBe(false)
		// The active file must be strict JSON, so the template keeps servers empty.
		const example = await fs.readFile(join(dir, '.mcp.json.example'), 'utf8')
		expect(example).toContain('"mcpServers": {}')
	})

	it('preserves existing user content and is idempotent (single block)', async () => {
		const dir = newTmpDir()
		await fs.writeFile(join(dir, 'AGENTS.md'), '# My project rules\n\nKeep these.\n')
		await installAiSetup(dir)
		await installAiSetup(dir) // run twice
		const agents = await fs.readFile(join(dir, 'AGENTS.md'), 'utf8')
		expect(agents).toContain('# My project rules')
		expect(agents).toContain('Keep these.')
		// exactly one delimited block, not duplicated by the second run
		expect(agents.match(/<!-- js-tooling:start -->/g)).toHaveLength(1)
	})
})

describe('installClaudeMd', () => {
	it('does not clobber an existing CLAUDE.md, only upserts the block', async () => {
		const dir = newTmpDir()
		await fs.writeFile(join(dir, 'CLAUDE.md'), '# Existing\n\nUser notes.\n')
		await installClaudeMd(dir)
		const claude = await fs.readFile(join(dir, 'CLAUDE.md'), 'utf8')
		expect(claude).toContain('# Existing')
		expect(claude).toContain('User notes.')
		expect(claude).toContain('@AGENTS.md')
	})
})
