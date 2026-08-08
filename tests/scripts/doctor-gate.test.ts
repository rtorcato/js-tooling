import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The gate the composite action (`action.yml`, #315) puts in front of a CI job.
 * Run as a subprocess because the exit code *is* the feature — an assertion on
 * the returned object alone would pass while the step silently stopped failing.
 */
const script = path.resolve(import.meta.dirname, '../../scripts/doctor-gate.mjs')

const report = (...results: Array<{ status: string }>) => {
	const file = path.join(mkdtempSync(path.join(tmpdir(), 'doctor-gate-')), 'doctor.json')
	writeFileSync(
		file,
		JSON.stringify({
			results: results.map((r, i) => ({ check: `check-${i}`, detail: 'detail', ...r })),
		})
	)
	return file
}

const run = (file: string, failOn: string) =>
	spawnSync(process.execPath, [script, file, failOn], { encoding: 'utf8' })

describe('doctor-gate', () => {
	const findings = report({ status: 'ok' }, { status: 'drift' }, { status: 'missing' })

	it('fails on drift or missing with fail-on=drift', () => {
		const { status, stdout } = run(findings, 'drift')
		expect(status).toBe(1)
		expect(stdout).toContain('2 finding(s), 2 blocking')
	})

	it('ignores drift with fail-on=missing but still annotates it', () => {
		const { status, stdout } = run(findings, 'missing')
		expect(status).toBe(1)
		expect(stdout).toContain('2 finding(s), 1 blocking')
		expect(stdout).toContain('::warning::check-1 (drift)')
	})

	it('never fails with fail-on=none', () => {
		const { status, stdout } = run(findings, 'none')
		expect(status).toBe(0)
		expect(stdout).toContain('2 finding(s), 0 blocking')
	})

	it('passes a clean report', () => {
		expect(run(report({ status: 'ok' }), 'drift').status).toBe(0)
	})

	it('rejects an unknown fail-on rather than passing the job', () => {
		const { status, stderr } = run(findings, 'warn')
		expect(status).toBe(1)
		expect(stderr).toContain('fail-on must be one of')
	})
})
