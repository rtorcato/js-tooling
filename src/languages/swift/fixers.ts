/**
 * Swift language module — fixers (#286). One per check in ./checks.ts.
 */
import path from 'node:path'
import fs from 'fs-extra'
import type { Fixer } from '../../base/fixers.js'
import { buildPresetConfig } from '../../cli/commands/setup-presets.js'
import { copyPreset } from '../../cli/utils/copy-preset.js'
import { LOCKFILE_NAME, writeLockfile } from '../../cli/utils/lockfile.js'
import { readSwiftPackage, renderSwiftGitLabCI, renderSwiftWorkflow } from './ci.js'
import { ensureSwiftGitignore } from './gitignore.js'

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
		target: 'swift-lockfile',
		description: `Scaffold ${LOCKFILE_NAME} recording the Swift tool choices`,
		appliesTo: ['lockfile'],
		outputs: [LOCKFILE_NAME],
		riskLevel: 'safe-add',
		canFixDrift: false,
		async run({ targetDir }) {
			// A Swift repo has no package.json to infer from, so record what `setup
			// --preset swift-library` would have written — the same config, minus the
			// scaffolding.
			await writeLockfile(targetDir, buildPresetConfig('swift-library', path.basename(targetDir)))
			return { filesWritten: [LOCKFILE_NAME] }
		},
	},
]
