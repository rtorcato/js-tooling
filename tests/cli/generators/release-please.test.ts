import { join } from 'node:path'
import fs from 'fs-extra'
import { describe, expect, it } from 'vitest'
import { runDoctor } from '../../../src/cli/commands/doctor.js'
import { generateReleasePlease } from '../../../src/cli/generators/release-please.js'
import { useTmpDir } from '../../helpers/tmp-dir.js'

const newTmpDir = useTmpDir()

describe('generateReleasePlease', () => {
	it('writes config, manifest, and the workflow', async () => {
		const dir = newTmpDir()
		const written = await generateReleasePlease(dir)
		expect(written).toEqual([
			'release-please-config.json',
			'.release-please-manifest.json',
			join('.github', 'workflows', 'release-please.yml'),
		])

		const config = await fs.readJson(join(dir, 'release-please-config.json'))
		expect(config.packages['.']['release-type']).toBe('node')
		const manifest = await fs.readJson(join(dir, '.release-please-manifest.json'))
		expect(manifest['.']).toBe('0.0.0')
		const workflow = await fs.readFile(join(dir, '.github/workflows/release-please.yml'), 'utf8')
		expect(workflow).toContain('googleapis/release-please-action@v4')
	})

	it('is safe-add — never clobbers existing files', async () => {
		const dir = newTmpDir()
		await fs.writeFile(join(dir, 'release-please-config.json'), '{ "mine": true }\n')
		const written = await generateReleasePlease(dir)
		expect(written).not.toContain('release-please-config.json')
		expect(await fs.readFile(join(dir, 'release-please-config.json'), 'utf8')).toBe(
			'{ "mine": true }\n'
		)
	})
})

describe('doctor release-tool conflict', () => {
	const findRelease = (results: { check: string }[]) =>
		results.find((r) => r.check === 'semantic-release')

	it('reports ok "using Release Please" when only release-please is configured', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), { name: 'demo', private: false })
		await generateReleasePlease(dir)
		const r = findRelease(await runDoctor(dir))
		expect(r?.status).toBe('ok')
		expect(r?.detail).toMatch(/Release Please/)
	})

	it('flags drift when both semantic-release and release-please are configured', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			private: false,
			release: { extends: '@rtorcato/js-tooling/semantic-release/github' },
		})
		await generateReleasePlease(dir)
		const r = findRelease(await runDoctor(dir))
		expect(r?.status).toBe('drift')
		expect(r?.detail).toMatch(/multiple release tools/)
	})
})
