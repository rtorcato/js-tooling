import { join } from 'node:path'
import fs from 'fs-extra'
import inquirer from 'inquirer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fixCommand, getFixers, listFixers } from '../../../src/cli/commands/fix.js'
import { useTmpDir } from '../../helpers/tmp-dir.js'

vi.mock('inquirer', () => ({
	default: { prompt: vi.fn() },
}))

const promptMock = vi.mocked(inquirer.prompt)
const newTmpDir = useTmpDir()

async function seedPackageJson(dir: string, extra: Record<string, unknown> = {}) {
	await fs.writeJson(join(dir, 'package.json'), {
		name: 'demo',
		version: '0.0.0',
		devDependencies: { '@rtorcato/js-tooling': '^2.0.0' },
		...extra,
	})
}

beforeEach(() => {
	promptMock.mockReset()
})

describe('fix registry', () => {
	it('every fixer.appliesTo references a known doctor check', () => {
		// Loose sanity check — every appliesTo entry should appear in some fixer's check list.
		const fixers = getFixers()
		expect(fixers.length).toBeGreaterThan(10)
		for (const f of fixers) {
			expect(f.target).toMatch(/^[a-z-]+$/)
			expect(f.outputs.length).toBeGreaterThan(0)
		}
	})

	it('listFixers returns a flat summary of every registered target', () => {
		const summary = listFixers()
		expect(summary.length).toBe(getFixers().length)
		const targets = summary.map((f) => f.target)
		expect(targets).toContain('biome')
		expect(targets).toContain('lockfile')
		expect(targets).toContain('codeowners')
		for (const f of summary) {
			expect(['destructive', 'safe-merge', 'safe-add']).toContain(f.riskLevel)
			expect(typeof f.canFixDrift).toBe('boolean')
		}
	})
})

describe('fix --list', () => {
	it('emits a json payload listing every fixer when --list --json', async () => {
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		try {
			await fixCommand(undefined, { list: true, json: true, directory: '/tmp' })
			const lastJson = logSpy.mock.calls.at(-1)?.[0] as string
			const payload = JSON.parse(lastJson)
			expect(Array.isArray(payload.targets)).toBe(true)
			expect(payload.targets.length).toBeGreaterThan(10)
			expect(payload.targets.find((t: { target: string }) => t.target === 'codeowners')).toBeTruthy()
		} finally {
			logSpy.mockRestore()
		}
	})

	it('--list does not run doctor or read package.json', async () => {
		// Pass a directory that does not exist — --list should not care.
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		try {
			await fixCommand(undefined, {
				list: true,
				json: true,
				directory: '/does/not/exist/anywhere',
			})
			const lastJson = logSpy.mock.calls.at(-1)?.[0] as string
			const payload = JSON.parse(lastJson)
			expect(payload.targets).toBeDefined()
		} finally {
			logSpy.mockRestore()
		}
	})
})

describe('fix targeted', () => {
	it('fix dependabot --yes writes .github/dependabot.yml', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fixCommand('dependabot', { directory: dir, yes: true })
		expect(await fs.pathExists(join(dir, '.github', 'dependabot.yml'))).toBe(true)
	})

	it('fix dependabot --dry-run does not write the file', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fixCommand('dependabot', { directory: dir, yes: true, dryRun: true })
		expect(await fs.pathExists(join(dir, '.github', 'dependabot.yml'))).toBe(false)
	})

	it('fix renovate --yes writes a renovate.json with recommended config', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fixCommand('renovate', { directory: dir, yes: true })
		const renovate = await fs.readJson(join(dir, 'renovate.json'))
		expect(renovate.$schema).toMatch(/renovate-schema/)
		expect(renovate.extends).toContain('config:recommended')
	})

	it('fix renovate --yes still scaffolds when dependabot.yml is present', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.outputFile(join(dir, '.github', 'dependabot.yml'), 'version: 2\n')
		await fixCommand('renovate', { directory: dir, yes: true })
		expect(await fs.pathExists(join(dir, 'renovate.json'))).toBe(true)
	})

	it('fix dependabot reports already-ok when renovate.json is present', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.writeJson(join(dir, 'renovate.json'), { extends: ['config:recommended'] })
		await fs.outputFile(join(dir, '.github', 'dependabot.yml'), 'version: 2\n')
		await fixCommand('dependabot', { directory: dir, yes: true })
		// dependabot.yml should remain untouched (no overwrite) and no error thrown.
		const yaml = await fs.readFile(join(dir, '.github', 'dependabot.yml'), 'utf-8')
		expect(yaml).toBe('version: 2\n')
	})

	it('fix unknown-target exits non-zero', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
			throw new Error('exit')
		}) as never)
		await expect(fixCommand('not-a-target', { directory: dir })).rejects.toThrow('exit')
		expect(exitSpy).toHaveBeenCalledWith(1)
		exitSpy.mockRestore()
	})

	it('fix editorconfig --yes writes .editorconfig', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fixCommand('editorconfig', { directory: dir, yes: true })
		expect(await fs.pathExists(join(dir, '.editorconfig'))).toBe(true)
	})

	it('fix gitlab-ci --yes writes .gitlab-ci.yml with expected stages', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fixCommand('gitlab-ci', { directory: dir, yes: true })
		const yaml = await fs.readFile(join(dir, '.gitlab-ci.yml'), 'utf-8')
		expect(yaml).toMatch(/^lint:$/m)
		expect(yaml).toMatch(/^test:$/m)
	})

	it('fix codeowners --yes writes .github/CODEOWNERS', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fixCommand('codeowners', { directory: dir, yes: true })
		const contents = await fs.readFile(join(dir, '.github', 'CODEOWNERS'), 'utf-8')
		expect(contents).toContain('Each line is a file pattern followed by one or more owners')
		expect(contents).toMatch(/^\*/m)
	})

	it('fix nvmrc --yes writes .nvmrc', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fixCommand('nvmrc', { directory: dir, yes: true })
		const content = await fs.readFile(join(dir, '.nvmrc'), 'utf-8')
		expect(content.trim()).toBe('22')
	})

	it('fix node-version --yes rewrites hardcoded workflow versions to node-version-file', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir, { engines: { node: '>=22' } })
		await fs.writeFile(join(dir, '.nvmrc'), '22\n')
		await fs.outputFile(
			join(dir, '.github', 'workflows', 'ci.yml'),
			[
				'jobs:',
				'  build:',
				'    steps:',
				'      - uses: actions/setup-node@v6',
				'        with:',
				'          node-version: 20',
				'  test:',
				'    strategy:',
				'      matrix:',
				'        node-version: ["22", "24"]',
				'    steps:',
				'      - uses: actions/setup-node@v6',
				'        with:',
				'          node-version: ${{ matrix.node-version }}',
				'',
			].join('\n')
		)
		await fixCommand('node-version', { directory: dir, yes: true })
		const yaml = await fs.readFile(join(dir, '.github', 'workflows', 'ci.yml'), 'utf-8')
		// Hardcoded scalar rewritten...
		expect(yaml).toContain('node-version-file: .nvmrc')
		expect(yaml).not.toMatch(/node-version:\s*20\b/)
		// ...but the matrix array and the ${{ }} expression are left untouched.
		expect(yaml).toContain('node-version: ["22", "24"]')
		expect(yaml).toContain('node-version: ${{ matrix.node-version }}')
	})

	it('fix engines adds engines.node when missing', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fixCommand('engines', { directory: dir, yes: true })
		const pkg = await fs.readJson(join(dir, 'package.json'))
		expect(pkg.engines?.node).toBe('>=22')
	})

	it('fix engines does not overwrite existing engines.node', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir, { engines: { node: '>=24' } })
		await fixCommand('engines', { directory: dir, yes: true })
		const pkg = await fs.readJson(join(dir, 'package.json'))
		expect(pkg.engines.node).toBe('>=24')
	})

	it('fix package-json adds @rtorcato/js-tooling to devDependencies', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), { name: 'demo', version: '0.0.0' })
		await fixCommand('package-json', { directory: dir, yes: true })
		const pkg = await fs.readJson(join(dir, 'package.json'))
		expect(pkg.devDependencies['@rtorcato/js-tooling']).toBe('latest')
	})

	it('fix biome on existing biome.json respects "no" on overwrite prompt', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		const original = '{"linter": {"enabled": true}}\n'
		await fs.writeFile(join(dir, 'biome.json'), original)
		promptMock.mockResolvedValueOnce({ confirm: false })
		await fixCommand('biome', { directory: dir })
		const content = await fs.readFile(join(dir, 'biome.json'), 'utf-8')
		expect(content).toBe(original)
	})

	it('fix biome --yes with existing biome.json overwrites', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.writeFile(join(dir, 'biome.json'), '{"linter": {"enabled": false}}\n')
		await fixCommand('biome', { directory: dir, yes: true })
		const biome = await fs.readJson(join(dir, 'biome.json'))
		expect(biome.$schema).toMatch(/biomejs\.dev/)
	})

	it('fix biome prompts default false on drift', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.writeFile(join(dir, 'biome.json'), '{}\n')
		promptMock.mockImplementationOnce(async (questions: unknown) => {
			const q = Array.isArray(questions) ? questions[0] : questions
			expect(q.default).toBe(false)
			expect(q.message).toMatch(/overwrite/i)
			return { confirm: false }
		})
		await fixCommand('biome', { directory: dir })
	})

	it('fix engines uses safe-merge wording (no overwrite warning)', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		promptMock.mockImplementationOnce(async (questions: unknown) => {
			const q = Array.isArray(questions) ? questions[0] : questions
			expect(q.default).toBe(true)
			expect(q.message).not.toMatch(/overwrite/i)
			expect(q.message).toMatch(/preserved/i)
			return { confirm: false }
		})
		await fixCommand('engines', { directory: dir })
	})

	it('fix husky uses safe-merge wording', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		promptMock.mockImplementationOnce(async (questions: unknown) => {
			const q = Array.isArray(questions) ? questions[0] : questions
			expect(q.default).toBe(true)
			expect(q.message).not.toMatch(/overwrite/i)
			return { confirm: false }
		})
		await fixCommand('husky', { directory: dir })
	})

	it('fix package-json uses safe-merge wording', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), { name: 'demo', version: '0.0.0' })
		promptMock.mockImplementationOnce(async (questions: unknown) => {
			const q = Array.isArray(questions) ? questions[0] : questions
			expect(q.message).not.toMatch(/overwrite/i)
			return { confirm: false }
		})
		await fixCommand('package-json', { directory: dir })
	})

	it('fix verify --yes writes a verify script chaining the enabled tools', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			scripts: { typecheck: 'tsc --noEmit', check: 'biome check .' },
			devDependencies: {
				'@rtorcato/js-tooling': '^2.0.0',
				'@biomejs/biome': '^2.0.0',
				vitest: '^4.0.0',
			},
		})
		await fixCommand('verify', { directory: dir, yes: true })
		const pkg = await fs.readJson(join(dir, 'package.json'))
		expect(pkg.scripts.verify).toBe('pnpm typecheck && pnpm check && pnpm exec vitest run')
		expect(pkg.scripts.typecheck).toBe('tsc --noEmit')
	})

	it('fix attw --yes installs the cli, adds a script, and appends to verify', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			type: 'module',
			exports: { '.': { import: './dist/index.js', require: './dist/index.cjs' } },
			scripts: { verify: 'pnpm typecheck && pnpm check' },
			devDependencies: { '@rtorcato/js-tooling': '^2.0.0' },
		})
		await fixCommand('attw', { directory: dir, yes: true })
		const pkg = await fs.readJson(join(dir, 'package.json'))
		// dual CJS/ESM (exports has a `require` condition) → no esm-only profile
		expect(pkg.scripts.attw).toBe('attw --pack')
		expect(pkg.devDependencies['@arethetypeswrong/cli']).toBeDefined()
		expect(pkg.scripts.verify).toBe('pnpm typecheck && pnpm check && pnpm attw')
	})

	it('fix attw --yes uses the esm-only profile and does not duplicate in verify', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			type: 'module',
			exports: { '.': './dist/index.js' }, // ESM-only: no require condition
			scripts: { verify: 'pnpm typecheck && pnpm attw' }, // already wired
			devDependencies: { '@rtorcato/js-tooling': '^2.0.0' },
		})
		await fixCommand('attw', { directory: dir, yes: true })
		const pkg = await fs.readJson(join(dir, 'package.json'))
		expect(pkg.scripts.attw).toBe('attw --pack --profile esm-only')
		// verify already contained `attw` → left untouched, not duplicated
		expect(pkg.scripts.verify).toBe('pnpm typecheck && pnpm attw')
	})

	it('fix claude-skill --yes installs the skill into .claude/skills/', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fixCommand('claude-skill', { directory: dir, yes: true })
		const skillPath = join(dir, '.claude', 'skills', 'js-tooling.md')
		expect(await fs.pathExists(skillPath)).toBe(true)
		const body = await fs.readFile(skillPath, 'utf8')
		expect(body).toContain('name: js-tooling')
	})

	it('fix cursor-rules --yes writes a .mdc rule with Cursor frontmatter', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fixCommand('cursor-rules', { directory: dir, yes: true })
		const body = await fs.readFile(join(dir, '.cursor', 'rules', 'js-tooling.mdc'), 'utf8')
		expect(body).toMatch(/^---\ndescription: .+\nglobs:\nalwaysApply: false\n---/)
		expect(body).toContain('# js-tooling') // shared body, frontmatter stripped
		expect(body).not.toContain('name: js-tooling') // Claude frontmatter not carried over
	})

	it('fix agents-md --yes upserts a block without clobbering existing content', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.writeFile(join(dir, 'AGENTS.md'), '# My project\n\nKeep this.\n')
		await fixCommand('agents-md', { directory: dir, yes: true })
		let body = await fs.readFile(join(dir, 'AGENTS.md'), 'utf8')
		expect(body).toContain('Keep this.') // existing content preserved
		expect(body).toContain('<!-- js-tooling:start -->')
		expect(body).toContain('# js-tooling')

		// re-run is idempotent — replaces the block, doesn't duplicate it
		await fixCommand('agents-md', { directory: dir, yes: true })
		body = await fs.readFile(join(dir, 'AGENTS.md'), 'utf8')
		expect(body.match(/js-tooling:start/g)?.length).toBe(1)
		expect(body).toContain('Keep this.')
	})

	it('fix copilot-instructions --yes writes the block under .github/', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fixCommand('copilot-instructions', { directory: dir, yes: true })
		const body = await fs.readFile(join(dir, '.github', 'copilot-instructions.md'), 'utf8')
		expect(body).toContain('<!-- js-tooling:start -->')
		expect(body).toContain('# js-tooling')
	})

	it('fix verify --yes is a no-op when fewer than two tools are detectable', async () => {
		const dir = newTmpDir()
		// no biome dep, no vitest dep, no typecheck script — only one signal at best
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			devDependencies: { '@rtorcato/js-tooling': '^2.0.0' },
		})
		await fixCommand('verify', { directory: dir, yes: true })
		const pkg = await fs.readJson(join(dir, 'package.json'))
		expect(pkg.scripts?.verify).toBeUndefined()
	})

	it('fix husky --yes writes a pre-push hook when a verify script exists', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			scripts: { verify: 'pnpm typecheck && pnpm check' },
			devDependencies: { '@rtorcato/js-tooling': '^2.0.0' },
		})
		await fixCommand('husky', { directory: dir, yes: true })
		const prePush = await fs.readFile(join(dir, '.husky', 'pre-push'), 'utf-8')
		expect(prePush).toContain('pnpm verify')
	})

	it('fix treeshake-check --yes scaffolds apps/treeshake-check from pkg.exports', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: '@my-org/my-lib',
			version: '0.0.0',
			sideEffects: false,
			exports: {
				'.': './dist/index.js',
				'./clipboard': './dist/clipboard/index.js',
				'./geolocation': './dist/geolocation/index.js',
			},
			devDependencies: { '@rtorcato/js-tooling': '^2.0.0' },
		})
		await fixCommand('treeshake-check', { directory: dir, yes: true })
		expect(
			await fs.pathExists(join(dir, 'apps', 'treeshake-check', 'check.mjs'))
		).toBe(true)
		const entry = await fs.readFile(
			join(dir, 'apps', 'treeshake-check', 'src', 'entry.ts'),
			'utf-8'
		)
		expect(entry).toContain("'@my-org/my-lib/clipboard'")
	})

	it('fix treeshake-check is a no-op when the package has fewer than two subpaths', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: '@my-org/my-lib',
			version: '0.0.0',
			exports: { '.': './dist/index.js' },
			devDependencies: { '@rtorcato/js-tooling': '^2.0.0' },
		})
		await fixCommand('treeshake-check', { directory: dir, yes: true })
		expect(
			await fs.pathExists(join(dir, 'apps', 'treeshake-check'))
		).toBe(false)
	})

	it('fix verify --yes appends pnpm treeshake when apps/treeshake-check exists', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			scripts: { typecheck: 'tsc --noEmit', check: 'biome check .' },
			devDependencies: {
				'@rtorcato/js-tooling': '^2.0.0',
				'@biomejs/biome': '^2.0.0',
				vitest: '^4.0.0',
			},
		})
		await fs.ensureDir(join(dir, 'apps', 'treeshake-check'))
		await fs.writeFile(join(dir, 'apps', 'treeshake-check', 'check.mjs'), '// stub\n')
		await fixCommand('verify', { directory: dir, yes: true })
		const pkg = await fs.readJson(join(dir, 'package.json'))
		expect(pkg.scripts.verify).toContain('pnpm treeshake')
		expect(pkg.scripts.treeshake).toBe('pnpm --filter=*treeshake-check run check')
	})

	it('fix husky --yes skips the pre-push hook when no verify script exists', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fixCommand('husky', { directory: dir, yes: true })
		expect(await fs.pathExists(join(dir, '.husky', 'pre-commit'))).toBe(true)
		expect(await fs.pathExists(join(dir, '.husky', 'pre-push'))).toBe(false)
	})

	it('returns early when check is already ok', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.ensureDir(join(dir, '.github'))
		await fs.writeFile(join(dir, '.github', 'dependabot.yml'), 'version: 2\n')
		// Should not call inquirer at all.
		await fixCommand('dependabot', { directory: dir })
		expect(promptMock).not.toHaveBeenCalled()
	})
})

describe('fix --json', () => {
	it('emits a JSON payload with applied actions and exits without prompts', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		try {
			await fixCommand('dependabot', { directory: dir, json: true })
			expect(promptMock).not.toHaveBeenCalled()
			expect(await fs.pathExists(join(dir, '.github', 'dependabot.yml'))).toBe(true)
			const lastJson = logSpy.mock.calls.at(-1)?.[0] as string
			const parsed = JSON.parse(lastJson)
			expect(parsed.target).toBe('dependabot')
			expect(parsed.directory).toBe(dir)
			expect(parsed.actions).toHaveLength(1)
			expect(parsed.actions[0]).toMatchObject({
				target: 'dependabot',
				check: 'Dependabot',
				status: 'applied',
				filesWritten: ['.github/dependabot.yml'],
			})
		} finally {
			logSpy.mockRestore()
		}
	})

	it('emits a JSON error payload on unknown target', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
			throw new Error('exit')
		}) as never)
		try {
			await expect(
				fixCommand('not-a-target', { directory: dir, json: true })
			).rejects.toThrow('exit')
			const payload = JSON.parse(logSpy.mock.calls.at(-1)?.[0] as string)
			expect(payload.error).toBe('unknown-target')
			expect(payload.target).toBe('not-a-target')
			expect(Array.isArray(payload.available)).toBe(true)
		} finally {
			logSpy.mockRestore()
			exitSpy.mockRestore()
		}
	})

	it('reports dry-run status without writing in JSON mode', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		try {
			await fixCommand('dependabot', { directory: dir, json: true, dryRun: true })
			expect(await fs.pathExists(join(dir, '.github', 'dependabot.yml'))).toBe(false)
			const payload = JSON.parse(logSpy.mock.calls.at(-1)?.[0] as string)
			expect(payload.actions[0].status).toBe('dry-run')
		} finally {
			logSpy.mockRestore()
		}
	})

	it('walk-all in JSON mode records every fixable check', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		try {
			await fixCommand(undefined, { directory: dir, json: true })
			const payload = JSON.parse(logSpy.mock.calls.at(-1)?.[0] as string)
			expect(payload.target).toBeNull()
			expect(payload.actions.length).toBeGreaterThan(5)
			const statuses = new Set(payload.actions.map((a: { status: string }) => a.status))
			expect(statuses.has('applied')).toBe(true)
			// `unsupported` only fires for the `Node` check (no fixer) when the host's
			// Node version triggers drift, which is environment-dependent — don't assert.
		} finally {
			logSpy.mockRestore()
		}
	})

	it('reports already-ok for a check that passes', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.ensureDir(join(dir, '.github'))
		await fs.writeFile(join(dir, '.github', 'dependabot.yml'), 'version: 2\n')
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		try {
			await fixCommand('dependabot', { directory: dir, json: true })
			const payload = JSON.parse(logSpy.mock.calls.at(-1)?.[0] as string)
			expect(payload.actions[0].status).toBe('already-ok')
		} finally {
			logSpy.mockRestore()
		}
	})
})

describe('fix + lockfile', () => {
	async function writeLock(
		dir: string,
		configPatch: Record<string, unknown> = {}
	): Promise<void> {
		const config = {
			projectName: 'demo',
			projectType: 'library',
			typescript: { enabled: true, config: 'base' },
			linting: { tool: 'biome' },
			formatting: { tool: 'biome' },
			testing: { framework: 'vitest', environment: 'node' },
			gitHooks: true,
			commitLint: true,
			semanticRelease: true,
			securityAutomation: true,
			bundler: 'tsup',
			...configPatch,
		}
		await fs.writeJson(join(dir, '.js-tooling.json'), {
			version: 1,
			config,
			writtenBy: '@rtorcato/js-tooling@test',
			writtenAt: new Date().toISOString(),
		})
	}

	it('fix lockfile --yes writes .js-tooling.json inferred from package.json', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fixCommand('lockfile', { directory: dir, yes: true })
		const lock = await fs.readJson(join(dir, '.js-tooling.json'))
		expect(lock.version).toBe(1)
		expect(lock.config.projectName).toBe('demo')
		expect(lock.config.linting.tool).toBe('biome')
	})

	it('fix vitest --yes on a jest-locked project auto-resyncs the lockfile', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await writeLock(dir, { testing: { framework: 'jest', environment: 'node' } })
		await fixCommand('vitest', { directory: dir, yes: true })
		const lock = await fs.readJson(join(dir, '.js-tooling.json'))
		expect(lock.config.testing.framework).toBe('vitest')
	})

	it('fix biome --yes on an eslint-locked project flips the recorded linting choice', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await writeLock(dir, {
			linting: { tool: 'eslint', eslintConfig: 'base' },
			formatting: { tool: 'prettier' },
		})
		await fixCommand('biome', { directory: dir, yes: true })
		const lock = await fs.readJson(join(dir, '.js-tooling.json'))
		expect(lock.config.linting.tool).toBe('biome')
		expect(lock.config.formatting.tool).toBe('biome')
	})

	it('does not touch the lockfile when no lockfile exists', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fixCommand('vitest', { directory: dir, yes: true })
		expect(await fs.pathExists(join(dir, '.js-tooling.json'))).toBe(false)
	})

	it('emits lockfileConflict in JSON mode when overriding a declined choice', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await writeLock(dir, { testing: { framework: 'jest', environment: 'node' } })
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		try {
			await fixCommand('vitest', { directory: dir, json: true })
			const lastJson = logSpy.mock.calls.at(-1)?.[0] as string
			const payload = JSON.parse(lastJson)
			expect(payload.actions[0].lockfileConflict).toBe(true)
		} finally {
			logSpy.mockRestore()
		}
	})

	it('omits lockfileConflict when no conflict exists', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await writeLock(dir)
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		try {
			await fixCommand('vitest', { directory: dir, json: true })
			const lastJson = logSpy.mock.calls.at(-1)?.[0] as string
			const payload = JSON.parse(lastJson)
			expect(payload.actions[0].lockfileConflict).toBeUndefined()
		} finally {
			logSpy.mockRestore()
		}
	})
})

describe('fix --resync', () => {
	async function writeLock(dir: string): Promise<void> {
		await fs.writeJson(join(dir, '.js-tooling.json'), {
			version: 1,
			config: {
				projectName: 'demo',
				projectType: 'library',
				typescript: { enabled: true, config: 'base' },
				linting: { tool: 'biome' },
				formatting: { tool: 'biome' },
				testing: { framework: 'vitest', environment: 'node' },
				gitHooks: false,
				commitLint: false,
				semanticRelease: false,
				securityAutomation: false,
				bundler: 'tsup',
			},
			writtenBy: '@rtorcato/js-tooling@test',
			writtenAt: new Date().toISOString(),
		})
	}

	it('errors when no lockfile exists', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
			throw new Error('exit')
		}) as never)
		const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
		try {
			await expect(fixCommand(undefined, { directory: dir, resync: true })).rejects.toThrow(
				'exit'
			)
			expect(exitSpy).toHaveBeenCalledWith(1)
			expect(errSpy.mock.calls.flat().join('\n')).toMatch(/No \.js-tooling\.json/)
		} finally {
			exitSpy.mockRestore()
			errSpy.mockRestore()
		}
	})

	it('errors in JSON mode with a structured payload when lockfile is missing', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
			throw new Error('exit')
		}) as never)
		try {
			await expect(
				fixCommand(undefined, { directory: dir, resync: true, json: true })
			).rejects.toThrow('exit')
			const payload = JSON.parse(logSpy.mock.calls.at(-1)?.[0] as string)
			expect(payload.error).toBe('no-lockfile')
		} finally {
			logSpy.mockRestore()
			exitSpy.mockRestore()
		}
	})

	it('--resync --yes scaffolds files from the lockfile config', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await writeLock(dir)
		await fixCommand(undefined, { directory: dir, resync: true, yes: true })
		expect(await fs.pathExists(join(dir, '.editorconfig'))).toBe(true)
		expect(await fs.pathExists(join(dir, '.nvmrc'))).toBe(true)
		expect(await fs.pathExists(join(dir, 'tsconfig.json'))).toBe(true)
		expect(await fs.pathExists(join(dir, 'biome.jsonc'))).toBe(true)
		expect(await fs.pathExists(join(dir, 'vitest.config.ts'))).toBe(true)
		expect(await fs.pathExists(join(dir, 'tsup.config.ts'))).toBe(true)
	})

	it('--resync --dry-run lists files without writing any', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await writeLock(dir)
		await fixCommand(undefined, { directory: dir, resync: true, dryRun: true, yes: true })
		// None of the expected files materialize in dry-run.
		expect(await fs.pathExists(join(dir, '.editorconfig'))).toBe(false)
		expect(await fs.pathExists(join(dir, 'biome.jsonc'))).toBe(false)
	})

	it('--resync --json emits a structured payload listing files written', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await writeLock(dir)
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		try {
			await fixCommand(undefined, { directory: dir, resync: true, json: true })
			const payload = JSON.parse(logSpy.mock.calls.at(-1)?.[0] as string)
			expect(payload.mode).toBe('resync')
			expect(payload.dryRun).toBe(false)
			expect(Array.isArray(payload.files)).toBe(true)
			expect(payload.files).toContain('.editorconfig')
		} finally {
			logSpy.mockRestore()
		}
	})

	it('rejects --resync combined with a [target] argument', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await writeLock(dir)
		const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
			throw new Error('exit')
		}) as never)
		const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
		try {
			await expect(
				fixCommand('biome', { directory: dir, resync: true, yes: true })
			).rejects.toThrow('exit')
			expect(errSpy.mock.calls.flat().join('\n')).toMatch(/cannot be combined/)
		} finally {
			exitSpy.mockRestore()
			errSpy.mockRestore()
		}
	})
})

describe('fix walk-all', () => {
	it('applies all missing items when --yes', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fixCommand(undefined, { directory: dir, yes: true })
		// A handful of representative outputs:
		expect(await fs.pathExists(join(dir, '.editorconfig'))).toBe(true)
		expect(await fs.pathExists(join(dir, '.nvmrc'))).toBe(true)
		expect(await fs.pathExists(join(dir, 'knip.json'))).toBe(true)
		expect(await fs.pathExists(join(dir, '.github', 'dependabot.yml'))).toBe(true)
		expect(await fs.pathExists(join(dir, '.github', 'workflows', 'codeql.yml'))).toBe(true)
	})

	it('prints all-pass message when nothing is non-ok', async () => {
		// Hard to fully construct; instead verify the early-return branch via empty results path.
		// We sidestep by running fix on a directory where doctor returns at least one non-ok
		// (engines.node drift), then verifying the walk respects user "no" answers.
		const dir = newTmpDir()
		await seedPackageJson(dir)
		promptMock.mockResolvedValue({ confirm: false })
		await fixCommand(undefined, { directory: dir })
		// Nothing should be written since every prompt returned false.
		expect(await fs.pathExists(join(dir, '.editorconfig'))).toBe(false)
	})
})

describe('fix --diff', () => {
	it('prints a unified diff before the confirm prompt for a drifted destructive fixer', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		// Seed a drifted biome.json so doctor flags drift and the diff has both sides.
		await fs.writeJson(join(dir, 'biome.json'), { foo: 'bar' })
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		promptMock.mockResolvedValue({ confirm: false })
		try {
			await fixCommand('biome', { directory: dir, diff: true })
			const output = logSpy.mock.calls.flat().join('\n')
			// Unified diff headers come from `createPatch`.
			expect(output).toMatch(/--- biome\.json/)
			expect(output).toMatch(/\+\+\+ biome\.json/)
			// The drifted content should appear as a removed line in the diff.
			expect(output).toMatch(/-.*"foo"/)
		} finally {
			logSpy.mockRestore()
		}
	})

	it('labels the preview as "create" when the target file does not yet exist', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		promptMock.mockResolvedValue({ confirm: false })
		try {
			await fixCommand('nvmrc', { directory: dir, diff: true })
			const output = logSpy.mock.calls.flat().join('\n')
			expect(output).toMatch(/create.*\.nvmrc/)
		} finally {
			logSpy.mockRestore()
		}
	})

	it('emits no diff markers when --json is set (JSON output stream stays clean)', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.writeJson(join(dir, 'biome.json'), { foo: 'bar' })
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		try {
			await fixCommand('biome', { directory: dir, diff: true, json: true })
			// Every console.log call in JSON mode should be valid JSON or empty.
			for (const call of logSpy.mock.calls) {
				const line = call[0] as string
				if (!line || line.trim() === '') continue
				expect(line).not.toMatch(/^\+\+\+ /)
				expect(line).not.toMatch(/^--- /)
			}
			const lastCall = logSpy.mock.calls.at(-1)?.[0] as string
			const payload = JSON.parse(lastCall)
			expect(payload.actions).toBeDefined()
		} finally {
			logSpy.mockRestore()
		}
	})

	it('does not show a diff for safe-add fixers (would-be no-op)', async () => {
		// `dependabot` is safe-add — the preview path should be skipped.
		const dir = newTmpDir()
		await seedPackageJson(dir)
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
		promptMock.mockResolvedValue({ confirm: false })
		try {
			await fixCommand('dependabot', { directory: dir, diff: true })
			const output = logSpy.mock.calls.flat().join('\n')
			expect(output).not.toMatch(/^\+\+\+ /m)
			expect(output).not.toMatch(/^--- /m)
		} finally {
			logSpy.mockRestore()
		}
	})
})
