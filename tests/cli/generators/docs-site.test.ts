import { join } from 'node:path'
import fs from 'fs-extra'
import { describe, expect, it } from 'vitest'
import { runDoctor } from '../../../src/cli/commands/doctor.js'
import { generateDocsSite, inferDocsIdentity } from '../../../src/cli/generators/docs-site.js'
import { useTmpDir } from '../../helpers/tmp-dir.js'

const newTmpDir = useTmpDir()

const PKG = {
	name: '@rtorcato/js-tooling',
	description: 'JS/TS tooling',
	repository: { url: 'https://github.com/rtorcato/js-tooling.git' },
}

describe('inferDocsIdentity', () => {
	it('derives docs name, owner, and repo from package.json', () => {
		const id = inferDocsIdentity(PKG)
		expect(id.docsName).toBe('@rtorcato/js-tooling-docs')
		expect(id.owner).toBe('rtorcato')
		expect(id.repo).toBe('js-tooling')
	})

	it('falls back gracefully with no repository', () => {
		const id = inferDocsIdentity({ name: '@x/foo' })
		expect(id.owner).toBe('your-org')
		expect(id.repo).toBe('foo')
	})
})

describe('generateDocsSite', () => {
	it('scaffolds a config with inferred url/baseUrl, workspace, and workflow', async () => {
		const dir = newTmpDir()
		const written = await generateDocsSite(dir, PKG)
		expect(written).toContain(join('apps', 'docs', 'docusaurus.config.ts'))
		expect(written).toContain('pnpm-workspace.yaml')

		const cfg = await fs.readFile(join(dir, 'apps/docs/docusaurus.config.ts'), 'utf8')
		expect(cfg).toContain("url: 'https://rtorcato.github.io'")
		expect(cfg).toContain("baseUrl: '/js-tooling/'")

		const ws = await fs.readFile(join(dir, 'pnpm-workspace.yaml'), 'utf8')
		expect(ws).toMatch(/apps\/\*/)

		const wf = await fs.readFile(join(dir, '.github/workflows/docs.yml'), 'utf8')
		expect(wf).toMatch(/actions\/deploy-pages/)

		const docsPkg = await fs.readJson(join(dir, 'apps/docs/package.json'))
		expect(docsPkg.name).toBe('@rtorcato/js-tooling-docs')
	})

	it('is safe-add and idempotent — a second run writes nothing and keeps the workspace', async () => {
		const dir = newTmpDir()
		await generateDocsSite(dir, PKG)
		const second = await generateDocsSite(dir, PKG)
		expect(second).toEqual([])
	})

	it('preserves an existing pnpm-workspace.yaml, adding apps/* once', async () => {
		const dir = newTmpDir()
		await fs.writeFile(join(dir, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n")
		await generateDocsSite(dir, PKG)
		const ws = await fs.readFile(join(dir, 'pnpm-workspace.yaml'), 'utf8')
		expect(ws).toMatch(/packages\/\*/)
		expect(ws).toMatch(/apps\/\*/)
	})
})

describe('doctor Docs site check', () => {
	it('reports optional-missing without a docs site', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), { name: 'demo' })
		const r = (await runDoctor(dir)).find((x) => x.check === 'Docs site')
		expect(r?.status).toBe('optional-missing')
	})

	it('reports ok once a docs site is scaffolded', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), PKG)
		await generateDocsSite(dir, PKG)
		const r = (await runDoctor(dir)).find((x) => x.check === 'Docs site')
		expect(r?.status).toBe('ok')
	})
})
