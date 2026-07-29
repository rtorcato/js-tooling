import fs from 'fs-extra'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
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
	it('every fixer resolves a check the Swift module actually emits', () => {
		const emitted = ['SwiftLint', 'Periphery', 'Swift .gitignore']
		for (const f of SWIFT_FIXERS) {
			for (const check of f.appliesTo) expect(emitted).toContain(check)
		}
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
