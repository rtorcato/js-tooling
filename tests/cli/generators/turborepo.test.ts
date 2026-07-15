import { join } from 'node:path'
import fs from 'fs-extra'
import { describe, expect, it } from 'vitest'
import { runDoctor } from '../../../src/cli/commands/doctor.js'
import { generateTurborepo } from '../../../src/cli/generators/turborepo.js'
import { useTmpDir } from '../../helpers/tmp-dir.js'

const newTmpDir = useTmpDir()

describe('generateTurborepo', () => {
	it('writes a valid turbo.json with a task pipeline', async () => {
		const dir = newTmpDir()
		const written = await generateTurborepo(dir)
		expect(written).toBe('turbo.json')

		const turbo = await fs.readJson(join(dir, 'turbo.json'))
		expect(turbo.$schema).toContain('turborepo')
		expect(turbo.tasks.build.dependsOn).toEqual(['^build'])
		expect(turbo.tasks.build.outputs).toContain('dist/**')
		expect(turbo.tasks.dev).toEqual({ cache: false, persistent: true })
	})
})

describe('doctor Turborepo check', () => {
	const findTurbo = (results: { check: string }[]) =>
		results.find((r) => r.check === 'Turborepo')

	it('does not surface the check in a single-package repo', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), { name: 'demo' })
		expect(findTurbo(await runDoctor(dir))).toBeUndefined()
	})

	it('flags optional-missing in a workspace without turbo.json', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), { name: 'demo' })
		await fs.writeFile(join(dir, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n")
		expect(findTurbo(await runDoctor(dir))?.status).toBe('optional-missing')
	})

	it('reports ok in a workspace with turbo.json', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), { name: 'demo' })
		await fs.writeFile(join(dir, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n")
		await generateTurborepo(dir)
		expect(findTurbo(await runDoctor(dir))?.status).toBe('ok')
	})
})
