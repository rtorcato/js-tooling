import { describe, expect, it } from 'vitest'
import {
	parsePackageSwift,
	renderSwiftGitLabCI,
	renderSwiftWorkflow,
	swiftGithubJobs,
} from '../../../src/languages/swift/ci.js'

const MANIFEST = `// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "MatrixSwiftBase",
    platforms: [.iOS(.v16), .macOS(.v13), .tvOS(.v16), .watchOS(.v9)],
    products: [
        .library(name: "MatrixSwiftBaseCore", targets: ["MatrixSwiftBaseCore"]),
        .library(name: "MatrixSwiftBaseUI", targets: ["MatrixSwiftBaseUI"])
    ],
    targets: [.target(name: "MatrixSwiftBaseCore")]
)
`

describe('parsePackageSwift', () => {
	it('reads products and platforms', () => {
		const pkg = parsePackageSwift(MANIFEST)
		expect(pkg.products).toEqual(['MatrixSwiftBaseCore', 'MatrixSwiftBaseUI'])
		expect(pkg.platforms).toEqual(['iOS', 'macOS', 'tvOS', 'watchOS'])
	})

	it('returns empties for a manifest with neither', () => {
		expect(parsePackageSwift('// swift-tools-version: 5.9\n')).toEqual({
			products: [],
			platforms: [],
		})
	})

	// `.iOS` also appears in target conditionals — only the platforms: clause
	// declares deployment targets.
	it('ignores platform references outside the platforms clause', () => {
		const pkg = parsePackageSwift(
			`platforms: [.macOS(.v13)],\ntargets: [.target(name: "A", condition: .when(platforms: [.iOS]))]`
		)
		expect(pkg.platforms).toEqual(['macOS'])
	})

	it('de-duplicates a platform listed twice', () => {
		expect(parsePackageSwift('platforms: [.iOS(.v16), .iOS(.v17)]').platforms).toEqual(['iOS'])
	})
})

describe('swiftGithubJobs', () => {
	const pkg = parsePackageSwift(MANIFEST)

	it('has no Node or pnpm anywhere in the workflow', () => {
		expect(renderSwiftWorkflow(pkg)).not.toMatch(/setup-node|pnpm|node_modules|\.nvmrc/)
	})

	it('runs every job on macOS', () => {
		for (const job of swiftGithubJobs(pkg)) expect(job.runsOn).toBe('macos-latest')
	})

	it('builds and tests with SwiftPM', () => {
		const yaml = renderSwiftWorkflow(pkg)
		expect(yaml).toContain('run: swift build')
		expect(yaml).toContain('run: swift test')
		expect(yaml).toContain('swiftlint lint --strict')
	})

	// Gating this on .periphery.yml existing lost the job on a fresh repo: `fix`
	// walks doctor's findings in order and writes ci.yml before the periphery
	// fixer has created its config.
	it('always emits the Periphery job, informational-only', () => {
		const yaml = renderSwiftWorkflow(pkg)
		expect(yaml).toContain('periphery scan')
		expect(yaml).toContain('continue-on-error: true')
	})

	it('builds a matrix over the declared platforms using the first product as scheme', () => {
		const yaml = renderSwiftWorkflow(pkg)
		expect(yaml).toContain('-scheme MatrixSwiftBaseCore')
		expect(yaml).toContain('          - iOS\n          - macOS\n          - tvOS\n          - watchOS')
	})

	it('skips the platform matrix when the manifest declares no platforms', () => {
		const bare = parsePackageSwift('let package = Package(name: "CLI")')
		const ids = swiftGithubJobs(bare).map((j) => j.id)
		expect(ids).toEqual(['build-test', 'lint', 'dead-code'])
	})

	it('skips the platform matrix when there is no library product to use as a scheme', () => {
		const noProducts = parsePackageSwift('platforms: [.macOS(.v13)]')
		expect(swiftGithubJobs(noProducts).map((j) => j.id)).not.toContain('platforms')
	})
})

describe('renderSwiftGitLabCI', () => {
	it('uses the Linux Swift image and stays Xcode-free', () => {
		const yaml = renderSwiftGitLabCI()
		expect(yaml).toContain('image: swift:6.0')
		expect(yaml).not.toMatch(/xcodebuild|setup-xcode|brew/)
	})

	it('builds before it tests', () => {
		expect(renderSwiftGitLabCI()).toContain('stages:\n  - build\n  - test\n')
	})
})
