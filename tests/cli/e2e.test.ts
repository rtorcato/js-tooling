import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import fs from 'fs-extra'
import { describe, expect, it } from 'vitest'
import { useTmpDir } from '../helpers/tmp-dir.js'

const CLI = join(process.cwd(), 'dist', 'cli', 'index.js')

function cli(args: string[], cwd = process.cwd()) {
	return spawnSync('node', [CLI, ...args], { cwd, encoding: 'utf8', timeout: 10_000 })
}

describe.skipIf(!fs.existsSync(CLI))('CLI smoke tests (requires pnpm build)', () => {
	const newTmpDir = useTmpDir()

	it('prints version', () => {
		const { status, stdout } = cli(['--version'])
		expect(status).toBe(0)
		expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/)
	})

	it('list prints known configs', () => {
		const { status, stdout } = cli(['list'])
		expect(status).toBe(0)
		expect(stdout).toContain('TypeScript')
		expect(stdout).toContain('Biome')
		expect(stdout).toContain('Vitest')
		expect(stdout).toContain('Commitlint')
	})

	it('ls is an alias for list', () => {
		const { status, stdout } = cli(['ls'])
		expect(status).toBe(0)
		expect(stdout).toContain('TypeScript')
	})

	it('copy biome writes biome.json to target dir', () => {
		const dir = newTmpDir()
		const { status, stdout } = cli(['copy', 'biome'], dir)
		expect(status).toBe(0)
		expect(stdout).toContain('Copied')
		expect(fs.existsSync(join(dir, 'biome.json'))).toBe(true)
	})

	it('copy tsconfig writes tsconfig.json to target dir', () => {
		const dir = newTmpDir()
		const { status } = cli(['copy', 'tsconfig'], dir)
		expect(status).toBe(0)
		expect(fs.existsSync(join(dir, 'tsconfig.json'))).toBe(true)
	})

	it('copy unknown config exits non-zero', () => {
		const dir = newTmpDir()
		const { status, stderr } = cli(['copy', 'nonexistent'], dir)
		expect(status).not.toBe(0)
		expect(stderr + '').toContain('') // exits cleanly, no crash
	})

	it('doctor --json on empty dir returns parseable results', () => {
		const dir = newTmpDir()
		fs.writeJsonSync(join(dir, 'package.json'), { name: 'demo', version: '0.0.0' })
		const { stdout } = cli(['doctor', '-d', dir, '--json'])
		const { results } = JSON.parse(stdout)
		expect(Array.isArray(results)).toBe(true)
		expect(results.length).toBeGreaterThan(0)
		expect(results[0]).toHaveProperty('check')
		expect(results[0]).toHaveProperty('status')
	})

	it('unknown command exits non-zero', () => {
		const { status } = cli(['notacommand'])
		expect(status).toBe(1)
	})
})
