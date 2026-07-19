import { join } from 'node:path'
import fs from 'fs-extra'
import { describe, expect, it } from 'vitest'
import { runDoctor } from '../../src/cli/commands/doctor.js'
import { generateDocsSite } from '../../src/cli/generators/docs-site.js'
import { useTmpDir } from '../helpers/tmp-dir.js'

const newTmpDir = useTmpDir()

const PKG = {
	name: '@rtorcato/js-tooling',
	description: 'JS/TS tooling.',
	repository: 'git+https://github.com/rtorcato/js-tooling.git',
}

describe('generateDocsSite', () => {
	it('scaffolds a full site, inferring name/org/repo from package.json', async () => {
		const dir = newTmpDir()
		const written = await generateDocsSite(PKG, dir)

		// The whole file set lands.
		for (const rel of [
			'apps/docs/package.json',
			'apps/docs/docusaurus.config.ts',
			'apps/docs/sidebars.ts',
			'apps/docs/tsconfig.json',
			'apps/docs/src/css/custom.css',
			'apps/docs/src/css/_jt-tokens.css',
			'apps/docs/docs/intro.md',
			'scripts/sync-changelog.mjs',
			'.github/workflows/docs.yml',
			'pnpm-workspace.yaml',
		]) {
			expect(written).toContain(rel)
			expect(await fs.pathExists(join(dir, rel))).toBe(true)
		}

		// Docs package name = <name>-docs; build chains sync-changelog.
		const docsPkg = await fs.readJson(join(dir, 'apps/docs/package.json'))
		expect(docsPkg.name).toBe('@rtorcato/js-tooling-docs')
		expect(docsPkg.scripts.build).toMatch(/sync-changelog/)

		// Config infers org/repo → GitHub Pages url + baseUrl.
		const config = await fs.readFile(join(dir, 'apps/docs/docusaurus.config.ts'), 'utf-8')
		expect(config).toContain("url: 'https://rtorcato.github.io'")
		expect(config).toContain("baseUrl: '/js-tooling/'")

		// Workflow drives the shared reusable deploy with the docs package filter.
		const wf = await fs.readFile(join(dir, '.github/workflows/docs.yml'), 'utf-8')
		expect(wf).toContain('rtorcato/js-tooling/.github/workflows/docs-deploy.yml@main')
		expect(wf).toContain("build-filter: '@rtorcato/js-tooling-docs'")

		// custom.css imports the shared tokens, then overrides the accent.
		const css = await fs.readFile(join(dir, 'apps/docs/src/css/custom.css'), 'utf-8')
		expect(css).toContain('@import "./_jt-tokens.css"')
		expect(css).toMatch(/--ifm-color-primary/)
	})

	it('honours a primary-color override', async () => {
		const dir = newTmpDir()
		await generateDocsSite(PKG, dir, { primaryColor: { light: '#F38020', dark: '#ff9a4d' } })
		const css = await fs.readFile(join(dir, 'apps/docs/src/css/custom.css'), 'utf-8')
		expect(css).toContain('#F38020')
		expect(css).toContain('#ff9a4d')
	})

	it('is idempotent — a second run writes nothing and preserves edits', async () => {
		const dir = newTmpDir()
		await generateDocsSite(PKG, dir)
		// Hand-edit a generated file; the re-run must not clobber it.
		const configPath = join(dir, 'apps/docs/docusaurus.config.ts')
		await fs.writeFile(configPath, '// edited by hand\n')

		const second = await generateDocsSite(PKG, dir)
		expect(second).toEqual([])
		expect(await fs.readFile(configPath, 'utf-8')).toBe('// edited by hand\n')
	})

	it('adds apps/* to an existing pnpm-workspace without duplicating', async () => {
		const dir = newTmpDir()
		await fs.writeFile(join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n')
		await generateDocsSite(PKG, dir)
		const ws = await fs.readFile(join(dir, 'pnpm-workspace.yaml'), 'utf-8')
		expect(ws).toMatch(/apps\/\*/)
		expect(ws).toMatch(/packages\/\*/)

		// Re-running does not add a second apps/* entry.
		await generateDocsSite(PKG, dir)
		const ws2 = await fs.readFile(join(dir, 'pnpm-workspace.yaml'), 'utf-8')
		expect(ws2.match(/apps\/\*/g)?.length).toBe(1)
	})

	it('produces a site the doctor Docs site check reports as ok', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), PKG)
		await generateDocsSite(PKG, dir)
		const docs = (await runDoctor(dir)).find((r) => r.check === 'Docs site')
		expect(docs?.status).toBe('ok')
	})
})
