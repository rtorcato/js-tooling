/**
 * Swift language module — checks (#286).
 *
 * The standard encoded here is the one `swift-common` actually runs: SwiftLint
 * (lint + `--fix` in pre-commit, `--strict` in CI) and Periphery for dead code.
 * Deliberately *not* checked:
 *
 * - SwiftFormat — SwiftLint's `--fix` does the formatting; a second formatter
 *   would fight it.
 * - `.swift-version` — the toolchain is pinned in CI (`setup-xcode`) and the
 *   package declares `// swift-tools-version:`, so a root file would be a third
 *   place to keep in sync.
 */
import path from 'node:path'
import fs from 'fs-extra'
import { type FileCheck, checkFile } from '../../base/checks.js'
import type { CheckResult } from '../../base/types.js'

const SWIFT_FILE_CHECKS: FileCheck[] = [
	{
		check: 'SwiftLint',
		candidates: ['.swiftlint.yml', '.swiftlint.yaml'],
		// SwiftLint configs are project-owned — there's no `extends` mechanism to
		// point at ours, so any file declaring real config counts as ok.
		expected: 'is a valid SwiftLint configuration',
		matcher: /^(disabled_rules|opt_in_rules|only_rules|included|excluded|analyzer_rules):/m,
		hint: 'Run `npx @rtorcato/repo-tooling fix swiftlint` to scaffold',
	},
	{
		check: 'Periphery',
		candidates: ['.periphery.yml', '.periphery.yaml'],
		expected: 'is a valid Periphery configuration',
		matcher: /^(retain_public|project|schemes|targets|index_exclude):/m,
		optional: true,
		hint: 'Run `npx @rtorcato/repo-tooling fix periphery` to scaffold a dead-code scan config',
	},
]

/**
 * Build artefacts that must never be committed. `.build` and `DerivedData` are
 * the expensive ones — a single stray commit of either adds hundreds of MB.
 */
const REQUIRED_GITIGNORE_ENTRIES = ['.build', 'DerivedData', 'xcuserdata']

export async function checkSwiftGitignore(dir: string): Promise<CheckResult> {
	const filepath = path.join(dir, '.gitignore')
	if (!(await fs.pathExists(filepath))) {
		return {
			check: 'Swift .gitignore',
			status: 'missing',
			detail: 'no .gitignore',
			hint: 'Run `npx @rtorcato/repo-tooling fix swift-gitignore` to scaffold the Swift template',
		}
	}

	const contents = await fs.readFile(filepath, 'utf-8')
	const missing = REQUIRED_GITIGNORE_ENTRIES.filter((entry) => !contents.includes(entry))
	if (missing.length > 0) {
		return {
			check: 'Swift .gitignore',
			status: 'drift',
			detail: `.gitignore missing Swift build artefacts: ${missing.join(', ')}`,
			hint: 'Run `npx @rtorcato/repo-tooling fix swift-gitignore` to append the missing entries',
		}
	}

	return {
		check: 'Swift .gitignore',
		status: 'ok',
		detail: '.gitignore covers .build, DerivedData and xcuserdata',
	}
}

/**
 * Package.swift hygiene. Both signals are things SwiftPM will not infer for
 * you: without a tools-version comment the manifest doesn't parse at all, and
 * without `platforms:` SwiftPM assumes the oldest deployment target it supports,
 * which silently rejects modern APIs at build time.
 */
export async function checkPackageSwift(dir: string): Promise<CheckResult> {
	const filepath = path.join(dir, 'Package.swift')
	if (!(await fs.pathExists(filepath))) {
		return {
			check: 'Package.swift',
			status: 'missing',
			detail: 'no Package.swift',
			hint: 'Run `swift package init` to create a SwiftPM manifest',
		}
	}

	const contents = await fs.readFile(filepath, 'utf-8')
	const toolsVersion = contents.match(/^\/\/\s*swift-tools-version:\s*([\d.]+)/m)?.[1]
	if (!toolsVersion) {
		return {
			check: 'Package.swift',
			status: 'drift',
			detail: 'Package.swift has no `// swift-tools-version:` comment',
			hint: 'Add `// swift-tools-version: 5.9` as the first line — SwiftPM requires it',
		}
	}

	if (!/\bplatforms:\s*\[/.test(contents)) {
		return {
			check: 'Package.swift',
			status: 'drift',
			detail: `Package.swift (tools ${toolsVersion}) declares no \`platforms:\``,
			hint: 'Add a `platforms:` clause — without it SwiftPM assumes the oldest supported deployment target',
		}
	}

	return {
		check: 'Package.swift',
		status: 'ok',
		detail: `Package.swift declares tools ${toolsVersion} and explicit platforms`,
	}
}

/** The Swift module's suite, layered on top of the base checks by doctor. */
export async function runSwiftChecks(dir: string): Promise<CheckResult[]> {
	return [
		await checkPackageSwift(dir),
		...(await Promise.all(SWIFT_FILE_CHECKS.map((spec) => checkFile(dir, spec)))),
		await checkSwiftGitignore(dir),
	]
}
