import fs from 'fs-extra'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runDoctor } from '../../../src/cli/commands/doctor.js'
import { FIXERS } from '../../../src/languages/js/fixers.js'
import { checkSwiftGitignore } from '../../../src/languages/swift/checks.js'
import { SWIFT_FIXERS, ensureSwiftGitignore } from '../../../src/languages/swift/fixers.js'
import { useTmpDir } from '../../helpers/tmp-dir.js'

const newTmpDir = useTmpDir()

function fixer(target: string) {
	const found = SWIFT_FIXERS.find((f) => f.target === target)
	if (!found) throw new Error(`no swift fixer: ${target}`)
	return found
}

const ctx = (targetDir: string) => ({
	targetDir,
	pkg: null,
	result: { check: 'x', status: 'missing' as const, detail: '' },
	lock: null,
})

describe('swift fixers', () => {
	// A fixer whose appliesTo doesn't match a real check name is dead code: `fix`
	// looks fixers up by check, so it would simply never run. Derive the valid
	// names from doctor itself rather than hardcoding them.
	it('every fixer resolves a check doctor actually emits for a Swift repo', async () => {
		const dir = newTmpDir()
		await fs.writeFile(join(dir, 'Package.swift'), '// swift-tools-version: 5.9\n')
		const emitted = new Set((await runDoctor(dir)).map((r) => r.check))
		for (const f of SWIFT_FIXERS) {
			for (const check of f.appliesTo) {
				expect(emitted, `${f.target} → ${check}`).toContain(check)
			}
		}
	})

	it('uses target names that do not collide with the JS fixer set', () => {
		// `fix --list` shows every language's fixers in one list.
		const jsTargets = new Set(FIXERS.map((f) => f.target))
		for (const f of SWIFT_FIXERS) expect(jsTargets).not.toContain(f.target)
	})

	it('swiftlint writes a config the SwiftLint check accepts', async () => {
		const dir = newTmpDir()
		const { filesWritten } = await fixer('swiftlint').run(ctx(dir))
		expect(filesWritten).toEqual(['.swiftlint.yml'])
		const contents = await fs.readFile(join(dir, '.swiftlint.yml'), 'utf-8')
		expect(contents).toContain('disabled_rules:')
		expect(contents).toContain('force_unwrapping')
	})

	it('periphery writes a config that retains the public API', async () => {
		const dir = newTmpDir()
		await fixer('periphery').run(ctx(dir))
		expect(await fs.readFile(join(dir, '.periphery.yml'), 'utf-8')).toContain('retain_public: true')
	})
})

describe('ensureSwiftGitignore', () => {
	it('creates the file when absent and satisfies the check', async () => {
		const dir = newTmpDir()
		expect(await ensureSwiftGitignore(dir)).toEqual(['.gitignore'])
		expect((await checkSwiftGitignore(dir)).status).toBe('ok')
	})

	it('appends to an existing .gitignore without dropping its entries', async () => {
		const dir = newTmpDir()
		await fs.writeFile(join(dir, '.gitignore'), 'secrets.env\n')
		await ensureSwiftGitignore(dir)
		const contents = await fs.readFile(join(dir, '.gitignore'), 'utf-8')
		expect(contents).toContain('secrets.env')
		expect((await checkSwiftGitignore(dir)).status).toBe('ok')
	})

	it('does not duplicate an entry the repo already ignores', async () => {
		const dir = newTmpDir()
		await fs.writeFile(join(dir, '.gitignore'), '/.build\nnotes.md\n')
		await ensureSwiftGitignore(dir)
		const contents = await fs.readFile(join(dir, '.gitignore'), 'utf-8')
		expect(contents.match(/^\/\.build$/gm)).toHaveLength(1)
		expect((await checkSwiftGitignore(dir)).status).toBe('ok')
	})

	it('is a no-op when everything is already covered', async () => {
		const dir = newTmpDir()
		await fs.writeFile(join(dir, '.gitignore'), '/.build\nDerivedData/\nxcuserdata/\n')
		expect(await ensureSwiftGitignore(dir)).toEqual([])
	})
})
