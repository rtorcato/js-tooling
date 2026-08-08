import fs from 'fs-extra'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runDoctor } from '../../../src/cli/commands/doctor.js'
import { BASE_FIXERS } from '../../../src/base/fixers.js'
import { FIXERS } from '../../../src/languages/js/fixers.js'
import { checkSwiftGitignore, checkSwiftRelease } from '../../../src/languages/swift/checks.js'
import { SWIFT_FIXERS } from '../../../src/languages/swift/fixers.js'
import { ensureSwiftGitignore } from '../../../src/languages/swift/gitignore.js'
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

	it('uses target names that do not collide with the JS or base fixer sets', () => {
		// `fix --list` shows every language's fixers in one list.
		const taken = new Set([...FIXERS, ...BASE_FIXERS].map((f) => f.target))
		for (const f of SWIFT_FIXERS) expect(taken).not.toContain(f.target)
	})

	// The bug behind #303: doctor reported the base findings on a Swift repo but
	// `fix` returned `unsupported` for every one of them, because only the Swift
	// module's fixers were in play.
	it('base + Swift fixers cover every check doctor emits for a Swift repo', async () => {
		const dir = newTmpDir()
		await fs.writeFile(join(dir, 'Package.swift'), '// swift-tools-version: 5.9\n')
		const fixable = new Set([...BASE_FIXERS, ...SWIFT_FIXERS].flatMap((f) => f.appliesTo))
		const uncovered = (await runDoctor(dir))
			.map((r) => r.check)
			.filter((check) => !fixable.has(check))
		// `language` and `Package.swift` are informational (scaffolding a manifest
		// is `setup`'s job); `Coverage upload` is a base check only the JS CI
		// generator satisfies; `README badges` needs a package.json name/repository
		// to build the block from, which a Swift repo hasn't got (#309).
		// `Git identity` is unfixable by design (#328) — only the operator knows
		// their own address, so there is nothing for a fixer to write.
		expect(uncovered).toEqual([
			'language',
			'Git identity',
			'README badges',
			'Coverage upload',
			'Package.swift',
		])
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

	it('swift-release writes a workflow the Release automation check accepts', async () => {
		const dir = newTmpDir()
		const { filesWritten } = await fixer('swift-release').run(ctx(dir))
		expect(filesWritten).toEqual(['.github/workflows/release.yml'])
		expect((await checkSwiftRelease(dir)).status).toBe('ok')
	})

	// #309: the checks moved to src/base, so a Swift repo now gets them — but
	// husky is an npm package, so the fixer scaffolds plain .githooks instead.
	it('swift-git-hooks writes hooks the base Git hooks / Pre-push checks accept', async () => {
		const dir = newTmpDir()
		await fs.writeFile(join(dir, 'Package.swift'), '// swift-tools-version: 5.9\n')
		const { filesWritten } = await fixer('swift-git-hooks').run(ctx(dir))
		expect(filesWritten).toEqual(['.githooks/pre-commit', '.githooks/pre-push'])
		expect(await fs.readFile(join(dir, '.githooks/pre-push'), 'utf-8')).toContain('swift test')
		// Executable, or git silently ignores the hook.
		expect((await fs.stat(join(dir, '.githooks/pre-commit'))).mode & 0o111).toBeTruthy()

		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'Git hooks')?.status).toBe('ok')
		expect(results.find((r) => r.check === 'Pre-push hook')?.status).toBe('ok')
	})

	// No .git in the temp dir: an unguarded `git config` would walk up and
	// rewrite whatever repo the tmp dir happens to sit inside.
	it('swift-git-hooks does not touch git config outside a repo', async () => {
		const dir = newTmpDir()
		await expect(fixer('swift-git-hooks').run(ctx(dir))).resolves.toBeTruthy()
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
