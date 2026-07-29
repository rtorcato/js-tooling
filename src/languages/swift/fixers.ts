/**
 * Swift language module — fixers (#286). One per check in ./checks.ts.
 */
import path from 'node:path'
import fs from 'fs-extra'
import type { Fixer } from '../../base/fixers.js'
import { generateCodeQLWorkflow } from '../../cli/generators/security.js'
import { copyPreset } from '../../cli/utils/copy-preset.js'
import { LANGUAGES } from '../registry.js'
import { readSwiftPackage, renderSwiftGitLabCI, renderSwiftWorkflow } from './ci.js'

/**
 * The Swift build artefacts that must stay out of git. Appended to an existing
 * .gitignore rather than replacing it — a Swift repo's ignore file usually
 * carries project-specific entries worth keeping.
 */
const SWIFT_GITIGNORE_BLOCK = `# Swift / SwiftPM
.DS_Store
/.build
/Packages
/*.xcodeproj
xcuserdata/
DerivedData/
.swiftpm/config/registries.json
.swiftpm/xcode/package.xcworkspace/contents.xcworkspacedata
.netrc
`

/** Entries whose presence means the block (or an equivalent) is already there. */
const SENTINELS = ['.build', 'DerivedData', 'xcuserdata']

export async function ensureSwiftGitignore(targetDir: string): Promise<string[]> {
	const filepath = path.join(targetDir, '.gitignore')
	if (!(await fs.pathExists(filepath))) {
		await fs.writeFile(filepath, SWIFT_GITIGNORE_BLOCK)
		return ['.gitignore']
	}

	const existing = await fs.readFile(filepath, 'utf-8')
	const missing = SENTINELS.filter((entry) => !existing.includes(entry))
	if (missing.length === 0) return []

	// Append only what's absent, so a repo that already ignores .build doesn't
	// get a duplicate entry for it.
	const additions = SWIFT_GITIGNORE_BLOCK.split('\n').filter(
		(line) => line.length > 0 && !existing.includes(line)
	)
	const separator = existing.endsWith('\n') ? '' : '\n'
	await fs.writeFile(filepath, `${existing}${separator}\n${additions.join('\n')}\n`)
	return ['.gitignore']
}

export const SWIFT_FIXERS: Fixer[] = [
	{
		target: 'swiftlint',
		description: 'Scaffold .swiftlint.yml (the SwiftLint config swift-common runs)',
		appliesTo: ['SwiftLint'],
		outputs: ['.swiftlint.yml'],
		canFixDrift: true,
		async run({ targetDir }) {
			const result = await copyPreset('swiftlint', targetDir)
			return { filesWritten: [result.target] }
		},
	},
	{
		target: 'periphery',
		description: 'Scaffold .periphery.yml (dead-code scan config, retains public API)',
		appliesTo: ['Periphery'],
		outputs: ['.periphery.yml'],
		canFixDrift: true,
		async run({ targetDir }) {
			const result = await copyPreset('periphery', targetDir)
			return { filesWritten: [result.target] }
		},
	},
	{
		target: 'swift-gitignore',
		description:
			'Add the Swift/SwiftPM build artefacts (.build, DerivedData, xcuserdata) to .gitignore',
		appliesTo: ['Swift .gitignore'],
		// Appends what's missing; never clobbers a project's own entries.
		riskLevel: 'safe-merge',
		outputs: ['.gitignore'],
		canFixDrift: true,
		async run({ targetDir }) {
			return { filesWritten: await ensureSwiftGitignore(targetDir) }
		},
	},
	{
		target: 'swift-ci',
		description:
			'Scaffold .github/workflows/ci.yml for Swift (macOS runners: swift build/test, SwiftLint, xcodebuild per platform)',
		appliesTo: ['GitHub Actions'],
		outputs: ['.github/workflows/ci.yml'],
		canFixDrift: true,
		async run({ targetDir }) {
			const workflowsDir = path.join(targetDir, '.github', 'workflows')
			await fs.ensureDir(workflowsDir)
			const workflow = renderSwiftWorkflow(await readSwiftPackage(targetDir))
			await fs.writeFile(path.join(workflowsDir, 'ci.yml'), workflow)
			return { filesWritten: ['.github/workflows/ci.yml'] }
		},
	},
	{
		target: 'swift-gitlab-ci',
		description: 'Scaffold .gitlab-ci.yml for Swift (swift build + test on the Linux Swift image)',
		appliesTo: ['GitLab CI'],
		outputs: ['.gitlab-ci.yml'],
		canFixDrift: true,
		async run({ targetDir }) {
			await fs.writeFile(path.join(targetDir, '.gitlab-ci.yml'), renderSwiftGitLabCI())
			return { filesWritten: ['.gitlab-ci.yml'] }
		},
	},
	{
		target: 'swift-codeql',
		description: 'Scaffold .github/workflows/codeql.yml with `language: swift`',
		appliesTo: ['CodeQL'],
		outputs: ['.github/workflows/codeql.yml'],
		async run({ targetDir }) {
			const filesWritten = await generateCodeQLWorkflow(targetDir, LANGUAGES.swift.codeqlLanguages)
			return { filesWritten }
		},
	},
]
