/**
 * Swift project scaffolding (#288) — what `setup --preset swift-library` writes.
 *
 * The JS generators in `src/cli/generators/` are all package.json-rooted, so a
 * Swift repo shares almost none of them: no package.json, no tsconfig, no
 * bundler, no pnpm. What it *does* share is the language-agnostic half —
 * .editorconfig, Dependabot, CodeQL, the AI agent files — which is imported
 * from there rather than re-templated here.
 *
 * The CI workflow comes from ./ci.ts (#287), which derives its jobs from
 * Package.swift. That's why the manifest is written before the workflow: the
 * platform matrix reads the `platforms:` clause we just emitted.
 */
import path from 'node:path'
import fs from 'fs-extra'
import type { ProjectConfig } from '../../cli/commands/setup.js'
import { installAiSetup } from '../../cli/generators/agent-rules.js'
import { generateEditorConfig } from '../../cli/generators/misc.js'
import { generateCodeQLWorkflow, generateDependabotConfig } from '../../cli/generators/security.js'
import { copyPreset } from '../../cli/utils/copy-preset.js'
import { LANGUAGES } from '../registry.js'
import { readSwiftPackage, renderSwiftWorkflow } from './ci.js'
import { ensureSwiftGitignore } from './gitignore.js'

/**
 * Turn a repo name into a Swift module name: `my-swift-lib` → `MySwiftLib`.
 * SwiftPM target names are type identifiers, so hyphens, dots and spaces have
 * to go, and a leading digit has to be prefixed. Falls back to `Package` when
 * nothing usable survives (e.g. a directory named `123`).
 */
export function swiftModuleName(projectName: string): string {
	const upperCamel = projectName
		.split(/[^A-Za-z0-9]+/)
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join('')
	if (upperCamel.length === 0) return 'Package'
	return /^\d/.test(upperCamel) ? `Package${upperCamel}` : upperCamel
}

/**
 * Deployment targets baked into the manifest. `doctor` requires *some*
 * `platforms:` clause (without one SwiftPM silently assumes its oldest
 * supported target), and these also become the xcodebuild matrix in CI.
 *
 * No trailing commas in the collection literals: the .swiftlint.yml written
 * alongside leaves `trailing_comma` enabled, so a manifest with them fails the
 * `swiftlint lint --strict` job in the CI this same scaffold generates.
 */
function packageSwift(module: string): string {
	return `// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "${module}",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .library(name: "${module}", targets: ["${module}"])
    ],
    targets: [
        .target(name: "${module}"),
        .testTarget(name: "${module}Tests", dependencies: ["${module}"])
    ]
)
`
}

/**
 * A real (if tiny) source + test pair, not an empty directory. `swift build`
 * fails outright on a package whose target directory doesn't exist, so a
 * scaffold without these produces a repo whose own CI is red on the first push.
 */
function sourceFile(module: string): string {
	return `/// The public surface of ${module}.
public enum ${module} {
    /// Current version of the package. Replace this enum with your own API.
    public static let version = "0.1.0"
}
`
}

/** XCTest rather than Swift Testing: it works on every toolchain, Linux included. */
function testFile(module: string): string {
	return `import XCTest

@testable import ${module}

final class ${module}Tests: XCTestCase {
    func testVersionIsNotEmpty() {
        XCTAssertFalse(${module}.version.isEmpty)
    }
}
`
}

/**
 * Swift is 4-space by convention while the shared .editorconfig is tab-first,
 * so the baseline gets a Swift override appended rather than a separate file.
 */
const SWIFT_EDITORCONFIG_SECTION = `
[*.swift]
indent_style = space
indent_size = 4
`

function readme(config: ProjectConfig, module: string): string {
	return `# ${config.projectName}

> Generated with [@rtorcato/repo-tooling](https://www.npmjs.com/package/@rtorcato/repo-tooling)

## Description

Your package description here.

## Installation

Add the package to your \`Package.swift\`:

\`\`\`swift
dependencies: [
    .package(url: "https://github.com/OWNER/${config.projectName}.git", from: "0.1.0"),
]
\`\`\`

Then add \`${module}\` to your target's dependencies.

## Development

\`\`\`bash
swift build            # Build the package
swift test             # Run the test suite
swiftlint --fix        # Format and autocorrect
swiftlint lint --strict # Lint the way CI does
periphery scan         # Report unused declarations
\`\`\`

SwiftLint is the formatter *and* the linter here — SwiftFormat is deliberately
not part of the standard, because a second formatter fights the first.

## Project Structure

\`\`\`
${config.projectName}/
├── Sources/${module}/          # Library source
├── Tests/${module}Tests/       # XCTest suite
├── Package.swift               # SwiftPM manifest
├── .swiftlint.yml              # SwiftLint configuration
├── .periphery.yml              # Dead-code scan configuration
└── README.md
\`\`\`

## Tooling

- **SwiftPM** — build, test, and dependency resolution
- **SwiftLint** — linting and formatting
- **Periphery** — dead-code detection
- **GitHub Actions** — \`swift build\`/\`swift test\` on macOS, plus \`xcodebuild\` per declared platform

Run \`npx @rtorcato/repo-tooling doctor\` any time to audit this repo against the standard.

## Contributing

1. Fork the repository
2. Create your feature branch (\`git checkout -b feature/amazing-feature\`)
3. Commit your changes (\`git commit -m 'feat: add amazing feature'\`)
4. Push to the branch (\`git push origin feature/amazing-feature\`)
5. Open a Pull Request

## License

[Add your license here]
`
}

/**
 * Relative paths `setup --dry-run` reports for a Swift config, in write order.
 * Kept beside the writer so the two can't drift.
 */
export function swiftFileList(config: ProjectConfig): string[] {
	const module = swiftModuleName(config.projectName)
	const files = [
		'.repo-tooling.json',
		'Package.swift',
		`Sources/${module}/${module}.swift`,
		`Tests/${module}Tests/${module}Tests.swift`,
		'.swiftlint.yml',
		'.periphery.yml',
		'.gitignore',
		'.editorconfig',
		'.github/workflows/ci.yml',
	]
	if (config.securityAutomation) {
		files.push(
			'.github/dependabot.yml',
			'.github/workflows/dependabot-automerge.yml',
			'.github/workflows/codeql.yml'
		)
	}
	if (config.aiSetup) {
		files.push(
			'AGENTS.md',
			'CLAUDE.md',
			'.cursor/rules/repo-tooling.mdc',
			'.github/copilot-instructions.md',
			'.claude/skills/repo-tooling.md',
			'.mcp.json.example'
		)
	}
	files.push('README.md')
	return files
}

/** Scaffold a SwiftPM library. The Swift arm of `generateConfigs`. */
export async function generateSwiftProject(config: ProjectConfig, targetDir: string) {
	const module = swiftModuleName(config.projectName)

	await fs.writeFile(path.join(targetDir, 'Package.swift'), packageSwift(module))
	await fs.outputFile(
		path.join(targetDir, 'Sources', module, `${module}.swift`),
		sourceFile(module)
	)
	await fs.outputFile(
		path.join(targetDir, 'Tests', `${module}Tests`, `${module}Tests.swift`),
		testFile(module)
	)

	await copyPreset('swiftlint', targetDir)
	await copyPreset('periphery', targetDir)
	await ensureSwiftGitignore(targetDir)

	await generateEditorConfig(targetDir)
	await fs.appendFile(path.join(targetDir, '.editorconfig'), SWIFT_EDITORCONFIG_SECTION)

	// After Package.swift: the workflow's platform matrix is read back off the
	// manifest written above.
	const workflowsDir = path.join(targetDir, '.github', 'workflows')
	await fs.ensureDir(workflowsDir)
	await fs.writeFile(
		path.join(workflowsDir, 'ci.yml'),
		renderSwiftWorkflow(await readSwiftPackage(targetDir))
	)

	if (config.securityAutomation) {
		await generateDependabotConfig(targetDir, LANGUAGES.swift.dependabotEcosystem)
		await generateCodeQLWorkflow(targetDir, LANGUAGES.swift.codeqlLanguages)
	}

	if (config.aiSetup) {
		await installAiSetup(targetDir)
	}

	await fs.writeFile(path.join(targetDir, 'README.md'), readme(config, module))
}
