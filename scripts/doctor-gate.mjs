// Gate + human summary for the composite action in action.yml (#315).
//
// `doctor --json` prints only JSON, so the action renders the findings as job
// annotations itself and then decides whether they should fail the step. The
// severity threshold is the one thing doctor's own exit code can't express: it
// fails on drift-or-missing, and a repo adopting the audit needs to be able to
// report first (`fail-on: none`) or gate on missing config alone.
import { readFileSync } from 'node:fs'

const FAIL_ON = {
	drift: ['drift', 'missing'],
	missing: ['missing'],
	none: [],
}

export function gate(results, failOn) {
	const blocking = FAIL_ON[failOn]
	if (!blocking) {
		throw new Error(`fail-on must be one of ${Object.keys(FAIL_ON).join(', ')} — got "${failOn}"`)
	}
	const findings = results.filter((r) => r.status === 'drift' || r.status === 'missing')
	return {
		findings,
		blocking: findings.filter((r) => blocking.includes(r.status)),
	}
}

// `node scripts/doctor-gate.mjs <report.json> <fail-on>` — the action's entry.
if (process.argv[1] === import.meta.filename) {
	const [reportPath, failOn = 'drift'] = process.argv.slice(2)
	const { results } = JSON.parse(readFileSync(reportPath, 'utf8'))

	let outcome
	try {
		outcome = gate(results, failOn)
	} catch (err) {
		console.error(`::error::${err.message}`)
		process.exit(1)
	}

	for (const r of outcome.findings) {
		const level = outcome.blocking.includes(r) ? 'error' : 'warning'
		console.log(`::${level}::${r.check} (${r.status}) — ${r.detail}`)
	}
	console.log(
		`doctor: ${results.length} checks, ${outcome.findings.length} finding(s), ` +
			`${outcome.blocking.length} blocking at fail-on=${failOn}`
	)

	if (outcome.blocking.length > 0) process.exit(1)
}
