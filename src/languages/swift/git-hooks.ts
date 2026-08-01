/**
 * Swift git hooks (#309). Husky is an npm package, so a SwiftPM repo can't use
 * it without dragging node into a toolchain that otherwise has none. The
 * node-free equivalent is a committed `.githooks/` directory that git is pointed
 * at with `core.hooksPath`.
 *
 * The hooks run the tools directly rather than a `verify` indirection: SwiftPM
 * has no scripts field, and inventing a Makefile target would be a third place
 * to keep the CI commands in sync (they already live in .github/workflows/ci.yml
 * and .swiftlint.yml).
 */
import { execFile } from 'node:child_process'
import path from 'node:path'
import fs from 'fs-extra'

export const SWIFT_HOOKS_DIR = '.githooks'

// SwiftLint's --fix is the formatter (see ./checks.ts), so pre-commit formats
// then lints. --quiet keeps a clean commit from printing a wall of nothing.
export const SWIFT_PRE_COMMIT = `#!/bin/sh
set -e
swiftlint --fix --quiet
swiftlint lint --quiet
`

export const SWIFT_PRE_PUSH = `#!/bin/sh
set -e
echo "🔍 Running pre-push verify..."
swift build
swift test
swiftlint lint --strict
echo "✅ Verify passed — pushing."
`

/** Best-effort `git config` — a missing git or a non-repo dir is not a failure. */
function gitConfig(cwd: string, key: string, value: string): Promise<boolean> {
	return new Promise((resolve) => {
		execFile('git', ['-C', cwd, 'config', key, value], (err) => resolve(!err))
	})
}

/**
 * Writes both hooks and points git at them. Returns the files written —
 * `core.hooksPath` is per-clone local config, not a file, so it's reported
 * separately rather than pretending to be a repo change.
 */
export async function installSwiftGitHooks(
	targetDir: string
): Promise<{ filesWritten: string[]; hooksPathSet: boolean }> {
	const hooksDir = path.join(targetDir, SWIFT_HOOKS_DIR)
	await fs.ensureDir(hooksDir)

	const filesWritten: string[] = []
	for (const [name, content] of [
		['pre-commit', SWIFT_PRE_COMMIT],
		['pre-push', SWIFT_PRE_PUSH],
	] as const) {
		const hookPath = path.join(hooksDir, name)
		await fs.writeFile(hookPath, content)
		await fs.chmod(hookPath, 0o755)
		filesWritten.push(`${SWIFT_HOOKS_DIR}/${name}`)
	}

	// Guard on .git: `fix --diff` shadow-runs fixers in a temp copy that excludes
	// .git, and that copy can land inside another repo — an unguarded `git config`
	// there would rewrite the *parent* repo's hooksPath during a mere preview.
	const isRepo = await fs.pathExists(path.join(targetDir, '.git'))
	const hooksPathSet = isRepo
		? await gitConfig(targetDir, 'core.hooksPath', SWIFT_HOOKS_DIR)
		: false

	return { filesWritten, hooksPathSet }
}
