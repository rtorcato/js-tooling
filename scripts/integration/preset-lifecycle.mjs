#!/usr/bin/env node
// Integration test: scaffold a preset with the CURRENT working tree, then run
// the full consumer lifecycle (install → build → verify) against it. Catches
// scaffold defects that only surface on a real install/build — the class of
// bug tracked in #91–#99 that no unit test exercises.
//
// The scaffold's `@rtorcato/js-tooling` dep is repointed at a `pnpm pack`
// tarball of this repo, so the test validates THIS branch's generated output +
// presets, not whatever `latest` is on npm.
//
// Usage: node scripts/integration/preset-lifecycle.mjs [preset]   (default: library)
// Requires: `pnpm build-cli` first, and network access to the npm registry.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const REPO = process.cwd()
const CLI = path.join(REPO, 'dist', 'cli', 'index.js')
const PRESET = process.argv[2] ?? 'library'

// Only `library` is wired end-to-end today; other presets join once green (#99).
const SUPPORTED = new Set(['library'])

function run(cmd, args, cwd) {
	console.log(`\n$ ${cmd} ${args.join(' ')}${cwd && cwd !== REPO ? `  (cwd=${cwd})` : ''}`)
	execFileSync(cmd, args, { stdio: 'inherit', cwd: cwd ?? REPO })
}

function fail(msg) {
	console.error(`\n❌ ${msg}`)
	process.exit(1)
}

if (!SUPPORTED.has(PRESET))
	fail(`preset "${PRESET}" is not wired for integration yet (have: ${[...SUPPORTED].join(', ')})`)
if (!fs.existsSync(CLI)) fail(`CLI not built at ${CLI} — run "pnpm build-cli" first`)

const packDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jst-pack-'))
const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), `jst-${PRESET}-`))

try {
	// 1. Pack the working tree so the scaffold tests local code, not npm's latest.
	run('pnpm', ['pack', '--pack-destination', packDir])
	const tgz = fs.readdirSync(packDir).find((f) => f.endsWith('.tgz'))
	if (!tgz) fail('pnpm pack produced no tarball')
	const tarball = path.join(packDir, tgz)

	// 2. Scaffold the preset (files only; we install ourselves after repointing the dep).
	run('node', [CLI, 'setup', '--preset', PRESET, '--directory', projectDir, '--skip-install'])

	// 3. Repoint @rtorcato/js-tooling at the local tarball.
	const pkgPath = path.join(projectDir, 'package.json')
	const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
	if (!pkg.devDependencies?.['@rtorcato/js-tooling'])
		fail('scaffold has no @rtorcato/js-tooling devDependency')
	pkg.devDependencies['@rtorcato/js-tooling'] = `file:${tarball}`
	fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)

	// 4. Seed what a real consumer writes: an entry module + one test. The base
	// tsconfig excludes *.test.ts, so the test is exercised by vitest, not tsc.
	const srcDir = path.join(projectDir, 'src')
	fs.mkdirSync(srcDir, { recursive: true })
	fs.writeFileSync(
		path.join(srcDir, 'index.ts'),
		'export const greet = (name: string): string => `hello ${name}`\n'
	)
	fs.writeFileSync(
		path.join(srcDir, 'index.test.ts'),
		"import { expect, it } from 'vitest'\nimport { greet } from './index'\n\nit('greets', () => {\n\texpect(greet('world')).toBe('hello world')\n})\n"
	)

	// 5. git init so husky's `prepare` hook has a repo to attach to.
	run('git', ['init', '-q'], projectDir)

	// 6. Install (fresh scaffold has no lockfile, so not --frozen).
	run('pnpm', ['install'], projectDir)

	// 7. Format generated files — mirrors what `setup` does post-install (the
	//    scaffold's biome/prettier config; templates are hand-written).
	run('pnpm', ['exec', 'biome', 'check', '--write', '.'], projectDir)

	// 8. Build.
	run('pnpm', ['build'], projectDir)

	// 9. Every path the package advertises (main/module/types/exports) must exist
	//    on disk after the build — the #92 exports/output mismatch class.
	const built = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
	const advertised = new Set()
	for (const field of ['main', 'module', 'types']) {
		if (typeof built[field] === 'string') advertised.add(built[field])
	}
	const collect = (v) => {
		if (typeof v === 'string') {
			if (v.startsWith('./')) advertised.add(v)
		} else if (v && typeof v === 'object') {
			for (const inner of Object.values(v)) collect(inner)
		}
	}
	collect(built.exports)
	const missing = [...advertised].filter((rel) => !fs.existsSync(path.join(projectDir, rel)))
	if (missing.length > 0)
		fail(`package.json points at files that don't exist after build:\n  ${missing.join('\n  ')}`)
	console.log(`\n✅ all ${advertised.size} advertised entry paths exist`)

	// 10. Full verify chain (typecheck + lint + test + publint for the library preset).
	run('pnpm', ['verify'], projectDir)

	console.log(`\n✅ ${PRESET} preset lifecycle passed`)
	fs.rmSync(packDir, { recursive: true, force: true })
	fs.rmSync(projectDir, { recursive: true, force: true })
} catch (err) {
	// Leave the throwaway dirs in place on failure for debugging.
	console.error(`\n❌ ${PRESET} preset lifecycle failed. Inspect: ${projectDir}`)
	console.error(err instanceof Error ? err.message : err)
	process.exit(1)
}
