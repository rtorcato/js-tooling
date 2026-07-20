import { join } from 'node:path'
import fs from 'fs-extra'
import { describe, expect, it } from 'vitest'
import { runDoctor } from '../../src/cli/commands/doctor.js'
import { copyPreset } from '../../src/cli/utils/copy-preset.js'
import { useTmpDir } from '../helpers/tmp-dir.js'

const newTmpDir = useTmpDir()

describe('copy docusaurus helpers', () => {
	it('copies the canonical sync-changelog script', async () => {
		const dir = newTmpDir()
		const result = await copyPreset('docusaurus-sync-changelog', dir)
		expect(result.target).toBe('scripts/sync-changelog.mjs')
		const content = await fs.readFile(join(dir, 'scripts/sync-changelog.mjs'), 'utf-8')
		expect(content).toContain('apps/docs/docs/changelog.md')
	})

	it('copies the shared theme tokens', async () => {
		const dir = newTmpDir()
		const result = await copyPreset('docusaurus-theme-tokens', dir)
		expect(result.target).toBe('apps/docs/src/css/_jt-tokens.css')
		const content = await fs.readFile(join(dir, 'apps/docs/src/css/_jt-tokens.css'), 'utf-8')
		expect(content).toContain('--jt-accent')
		expect(content).toMatch(/Geist/)
	})

	it('copies the shared component theme, and it defines no accent colours', async () => {
		const dir = newTmpDir()
		const result = await copyPreset('docusaurus-theme', dir)
		expect(result.target).toBe('apps/docs/src/css/theme.css')
		const content = await fs.readFile(join(dir, 'apps/docs/src/css/theme.css'), 'utf-8')
		// Component overrides present…
		expect(content).toMatch(/\.theme-doc-card-container/)
		expect(content).toMatch(/\.markdown table/)
		// …and it references tokens rather than hardcoding an accent (so it's
		// safe to share across the family — each repo owns its accent block).
		expect(content).toMatch(/var\(--jt-accent\)/)
		// No hardcoded accent hex (js-tooling's green) leaked into the shared sheet.
		expect(content).not.toMatch(/#10b981|#34d399/i)
	})
})

describe('doctor Docs site check', () => {
	const findDocs = (results: { check: string }[]) => results.find((r) => r.check === 'Docs site')

	/** A repo with a Docusaurus site; `wired` chains sync-changelog into build. */
	async function seedDocsRepo(wired: boolean): Promise<string> {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), { name: 'demo', version: '0.0.0' })
		await fs.outputFile(join(dir, 'apps/docs/docusaurus.config.ts'), 'export default {}\n')
		await fs.writeJson(join(dir, 'apps/docs/package.json'), {
			name: '@rtorcato/demo-docs',
			scripts: wired
				? { build: 'pnpm run sync-changelog && docusaurus build' }
				: { build: 'docusaurus build' },
		})
		await fs.outputFile(join(dir, 'scripts/sync-changelog.mjs'), '// sync\n')
		return dir
	}

	it('is not surfaced in a repo without a docs site', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), { name: 'demo' })
		expect(findDocs(await runDoctor(dir))).toBeUndefined()
	})

	it('reports ok when sync-changelog is wired and no dist workflow', async () => {
		const dir = await seedDocsRepo(true)
		expect(findDocs(await runDoctor(dir))?.status).toBe('ok')
	})

	it('drifts when the docs app build does not chain sync-changelog', async () => {
		const dir = await seedDocsRepo(false)
		const docs = findDocs(await runDoctor(dir))
		expect(docs?.status).toBe('drift')
		expect(docs?.detail).toMatch(/sync-changelog/)
	})

	it('drifts when the deploy workflow uses the dist artifact path', async () => {
		const dir = await seedDocsRepo(true)
		await fs.outputFile(
			join(dir, '.github/workflows/docs.yml'),
			'jobs:\n  deploy:\n    steps:\n      - uses: actions/upload-pages-artifact@v3\n        with:\n          path: apps/docs/dist\n'
		)
		const docs = findDocs(await runDoctor(dir))
		expect(docs?.status).toBe('drift')
		expect(docs?.detail).toMatch(/dist/)
	})
})
