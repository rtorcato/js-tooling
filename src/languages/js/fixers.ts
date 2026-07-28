import path from 'node:path'
import chalk from 'chalk'
import fs from 'fs-extra'
import type { CheckResult } from '../../base/types.js'
import { installAgentRules, installAiSetup } from '../../cli/generators/agent-rules.js'
import { buildBadgeBlock, parseRepository, upsertBadges } from '../../cli/generators/badges.js'
import {
	generateReleasePleaseConfig,
	generateRolldownConfig,
	generateRollupConfig,
	generateSemanticReleaseConfig,
} from '../../cli/generators/build.js'
import { generateCommunityHealth } from '../../cli/generators/community-health.js'
import {
	generateCommitlintConfig,
	generateHuskyConfig,
	generatePrePushHook,
} from '../../cli/generators/git.js'
import { generateGitHubActions } from '../../cli/generators/github-actions.js'
import { generateGitLabCI } from '../../cli/generators/gitlab-ci.js'
import { GH_WORKFLOWS, generateGhWorkflow } from '../../cli/generators/github-workflows.js'
import { generateESLintConfig, generatePrettierConfig } from '../../cli/generators/linting.js'
import {
	alignNodeVersion,
	ensureEnginesNode,
	generateCodeowners,
	generateEditorConfig,
	generateKnipConfig,
	generateNvmrc,
	generateSizeLimitConfig,
	generateVscodeExtensions,
} from '../../cli/generators/misc.js'
import { composeVerifyScriptFromPkg } from '../../cli/generators/package-json.js'
import { generatePostcss } from '../../cli/generators/postcss.js'
import {
	generateCodeQLWorkflow,
	generateDependabotConfig,
	generateRenovateConfig,
} from '../../cli/generators/security.js'
import { generateCypressConfig, generateVitestConfig } from '../../cli/generators/testing.js'
import { generateTreeshakeCheck, inferSubpathsFromExports } from '../../cli/generators/treeshake.js'
import { generateTailwind } from '../../cli/generators/tailwind.js'
import { generateTurborepo } from '../../cli/generators/turborepo.js'
import { generateNx } from '../../cli/generators/nx.js'
import { generateBun } from '../../cli/generators/bun.js'
import { generateDocsSite } from '../../cli/generators/docs-site.js'
import { generateTypedocConfig, generateTypedocWorkflow } from '../../cli/generators/typedoc.js'
import { copyPreset } from '../../cli/utils/copy-preset.js'
import { applyGithubSettings } from '../../cli/utils/github-settings.js'
import { type Lockfile, LOCKFILE_NAME, writeLockfile } from '../../cli/utils/lockfile.js'
import type { ProjectConfig } from '../../cli/commands/setup.js'

export type Pkg = Record<string, unknown> | null

export interface FixerContext {
	targetDir: string
	pkg: Pkg
	result: CheckResult
	lock: Lockfile | null
}

export type FixRiskLevel = 'destructive' | 'safe-merge' | 'safe-add'

export interface Fixer {
	target: string
	description: string
	appliesTo: string[]
	outputs: string[]
	/**
	 * - destructive (default): overwrites the target file
	 * - safe-merge: modifies an existing file without replacing user values
	 * - safe-add: only writes when the target file doesn't yet exist
	 */
	riskLevel?: FixRiskLevel
	canFixDrift?: boolean
	run(ctx: FixerContext): Promise<{ filesWritten: string[] }>
}

function inferProjectConfig(pkg: Pkg): ProjectConfig {
	const deps = {
		...((pkg?.dependencies as Record<string, string> | undefined) ?? {}),
		...((pkg?.devDependencies as Record<string, string> | undefined) ?? {}),
	}
	let projectType: ProjectConfig['projectType'] = 'library'
	if (deps.next) projectType = 'nextjs-app'
	else if (deps['react-dom']) projectType = 'react-app'

	return {
		projectName: (pkg?.name as string) ?? 'project',
		projectType,
		typescript: { enabled: true, config: projectType === 'nextjs-app' ? 'next' : 'base' },
		linting: {
			tool: 'biome',
			eslintConfig: projectType === 'nextjs-app' ? 'nextjs' : 'base',
		},
		formatting: { tool: 'biome' },
		testing: { framework: 'vitest', environment: 'node' },
		gitHooks: true,
		commitLint: true,
		semanticRelease: pkg?.private !== true,
		securityAutomation: true,
		bundler: 'tsup',
	}
}

export async function readPackageJson(dir: string): Promise<Pkg> {
	const filepath = path.join(dir, 'package.json')
	if (!(await fs.pathExists(filepath))) return null
	try {
		return (await fs.readJson(filepath)) as Pkg
	} catch {
		return null
	}
}

/** True when any (possibly nested) exports condition declares a `require`/CJS entry. */
function hasRequireCondition(exports: unknown): boolean {
	if (!exports || typeof exports !== 'object') return false
	for (const value of Object.values(exports as Record<string, unknown>)) {
		if (value && typeof value === 'object') {
			if ('require' in value) return true
			if (hasRequireCondition(value)) return true
		}
	}
	return false
}

/** ESM-only = `"type": "module"` and no CJS/`require` resolution in exports. */
function isEsmOnly(pkg: Record<string, unknown>): boolean {
	return pkg.type === 'module' && !hasRequireCondition(pkg.exports)
}

// Optional deploy workflows (issue #66). One flat fix target each, no doctor
// check and no setup prompt — they're opt-in and too deploy-specific to nag.
const GH_WORKFLOW_META: Record<(typeof GH_WORKFLOWS)[number], { check: string; desc: string }> = {
	'docker-publish': {
		check: 'Docker publish workflow',
		desc: 'Scaffold .github/workflows/docker-publish.yml (build + push image to GHCR on tag)',
	},
	'vercel-deploy': {
		check: 'Vercel deploy workflow',
		desc: 'Scaffold .github/workflows/vercel-deploy.yml (production deploy to Vercel on main)',
	},
	'cloudflare-pages': {
		check: 'Cloudflare Pages workflow',
		desc: 'Scaffold .github/workflows/cloudflare-pages.yml (static-site deploy to Cloudflare Pages)',
	},
	'preview-deployments': {
		check: 'Preview deployments workflow',
		desc: 'Scaffold .github/workflows/preview-deployments.yml (per-PR preview deploy)',
	},
}

const GH_WORKFLOW_FIXERS: Fixer[] = GH_WORKFLOWS.map((name) => ({
	target: name,
	description: GH_WORKFLOW_META[name].desc,
	appliesTo: [GH_WORKFLOW_META[name].check],
	outputs: [`.github/workflows/${name}.yml`],
	// safe-add: never clobber an existing workflow of the same name.
	riskLevel: 'safe-add',
	async run({ targetDir }) {
		const written = await generateGhWorkflow(name, targetDir)
		return { filesWritten: [written] }
	},
}))

export const FIXERS: Fixer[] = [
	{
		target: 'biome',
		description: 'Scaffold biome.json extending the @rtorcato/repo-tooling preset',
		appliesTo: ['Biome'],
		outputs: ['biome.json'],
		canFixDrift: true,
		async run({ targetDir }) {
			const result = await copyPreset('biome', targetDir)
			return { filesWritten: [result.target] }
		},
	},
	{
		target: 'tsconfig',
		description: 'Scaffold tsconfig.json extending the @rtorcato/repo-tooling preset',
		appliesTo: ['TypeScript'],
		outputs: ['tsconfig.json'],
		canFixDrift: true,
		async run({ targetDir }) {
			const result = await copyPreset('tsconfig', targetDir)
			return { filesWritten: [result.target] }
		},
	},
	{
		target: 'eslint',
		description: 'Scaffold eslint.config.mjs importing the @rtorcato/repo-tooling preset',
		appliesTo: ['ESLint'],
		outputs: ['eslint.config.mjs'],
		canFixDrift: true,
		async run({ targetDir, pkg }) {
			await generateESLintConfig(inferProjectConfig(pkg), targetDir)
			return { filesWritten: ['eslint.config.mjs'] }
		},
	},
	{
		target: 'prettier',
		description: 'Scaffold prettier.config.mjs re-exporting the preset',
		appliesTo: ['Prettier'],
		outputs: ['prettier.config.mjs'],
		canFixDrift: true,
		async run({ targetDir }) {
			await generatePrettierConfig(targetDir)
			return { filesWritten: ['prettier.config.mjs'] }
		},
	},
	{
		target: 'vitest',
		description: 'Scaffold vitest.config.ts (preserves vitest.setup.ts if present)',
		appliesTo: ['Vitest'],
		outputs: ['vitest.config.ts'],
		canFixDrift: true,
		async run({ targetDir, pkg }) {
			const setupPath = path.join(targetDir, 'vitest.setup.ts')
			const hadSetup = await fs.pathExists(setupPath)
			const savedSetup = hadSetup ? await fs.readFile(setupPath, 'utf-8') : null
			await generateVitestConfig(inferProjectConfig(pkg), targetDir)
			if (hadSetup && savedSetup !== null) {
				await fs.writeFile(setupPath, savedSetup)
			}
			return { filesWritten: ['vitest.config.ts'] }
		},
	},
	{
		target: 'cypress',
		description:
			'Scaffold cypress.config.ts (re-exports the preset) + tests/e2e and cypress/support boilerplate',
		// No doctor check — E2E is opt-in, so this runs only when explicitly targeted.
		appliesTo: [],
		outputs: [
			'cypress.config.ts',
			'cypress/support/e2e.ts',
			'cypress/support/commands.ts',
			'tests/e2e/example.cy.ts',
		],
		// safe-add: regenerates the config re-export but never clobbers existing specs/support.
		riskLevel: 'safe-add',
		async run({ targetDir }) {
			const filesWritten = await generateCypressConfig(targetDir)
			return { filesWritten }
		},
	},
	{
		target: 'commitlint',
		description: 'Scaffold commitlint.config.mjs exporting the preset',
		appliesTo: ['Commitlint'],
		outputs: ['commitlint.config.mjs'],
		canFixDrift: true,
		async run({ targetDir }) {
			await generateCommitlintConfig(targetDir)
			return { filesWritten: ['commitlint.config.mjs'] }
		},
	},
	{
		target: 'husky',
		description: 'Set up Husky + lint-staged (and a `pnpm verify` pre-push hook)',
		appliesTo: ['Husky', 'lint-staged', 'Husky pre-push'],
		outputs: ['.husky/pre-commit', '.husky/pre-push', 'package.json (lint-staged field)'],
		riskLevel: 'safe-merge',
		canFixDrift: true,
		async run({ targetDir, pkg }) {
			const pkgPath = path.join(targetDir, 'package.json')
			const existingLintStaged = (pkg?.['lint-staged'] as Record<string, unknown> | undefined) ?? {}
			await generateHuskyConfig(inferProjectConfig(pkg), targetDir)
			const updated = (await fs.readJson(pkgPath)) as Record<string, unknown>
			const generated = (updated['lint-staged'] as Record<string, unknown> | undefined) ?? {}
			updated['lint-staged'] = { ...generated, ...existingLintStaged }
			await fs.writeJson(pkgPath, updated, { spaces: 2 })
			const filesWritten = ['.husky/pre-commit', 'package.json']
			const scripts = (updated.scripts as Record<string, string> | undefined) ?? {}
			if (scripts.verify) {
				await generatePrePushHook(targetDir)
				filesWritten.push('.husky/pre-push')
			}
			return { filesWritten }
		},
	},
	{
		target: 'verify',
		description: 'Add a unified `verify` script (typecheck && lint && tests) to package.json',
		appliesTo: ['verify script'],
		outputs: ['package.json (scripts.verify)'],
		riskLevel: 'safe-merge',
		canFixDrift: true,
		async run({ targetDir, pkg }) {
			const pkgPath = path.join(targetDir, 'package.json')
			if (!pkg) {
				console.log(chalk.yellow('   no package.json found — skipping'))
				return { filesWritten: [] }
			}
			const includeTreeshake = await fs.pathExists(
				path.join(targetDir, 'apps', 'treeshake-check', 'check.mjs')
			)
			const verify = composeVerifyScriptFromPkg(pkg, { includeTreeshake })
			if (!verify) {
				console.log(
					chalk.gray(
						'   not enough tools enabled to compose a verify chain — skipping (need 2+ of typecheck/lint/tests)'
					)
				)
				return { filesWritten: [] }
			}
			const updated = { ...pkg }
			const scripts = { ...((updated.scripts as Record<string, string> | undefined) ?? {}) }
			scripts.verify = verify
			if (includeTreeshake && !scripts.treeshake) {
				scripts.treeshake = 'pnpm --filter=*treeshake-check run check'
				if (!scripts.pretreeshake) {
					scripts.pretreeshake = scripts.build ? 'pnpm build' : 'echo "no build step"'
				}
			}
			updated.scripts = scripts
			await fs.writeJson(pkgPath, updated, { spaces: 2 })
			return { filesWritten: ['package.json'] }
		},
	},
	{
		target: 'semantic-release',
		description:
			'Scaffold release.config.mjs + install preset plugins (skipped on private packages)',
		appliesTo: ['semantic-release'],
		outputs: ['release.config.mjs', 'package.json'],
		canFixDrift: true,
		async run({ targetDir, pkg }) {
			if (pkg?.private === true) {
				console.log(chalk.gray('   skipping — package is private'))
				return { filesWritten: [] }
			}
			const filesWritten = await generateSemanticReleaseConfig(targetDir)
			return { filesWritten }
		},
	},
	{
		target: 'changesets',
		description: 'Scaffold .changeset/config.json (alternative to semantic-release)',
		appliesTo: ['Changesets'],
		outputs: ['.changeset/config.json'],
		canFixDrift: true,
		async run({ targetDir }) {
			const result = await copyPreset('changesets', targetDir)
			return { filesWritten: [result.target] }
		},
	},
	{
		target: 'release-please',
		description:
			'Scaffold release-please-config.json + manifest + release-please.yml workflow (alternative to semantic-release)',
		appliesTo: ['Release Please'],
		outputs: [
			'release-please-config.json',
			'.release-please-manifest.json',
			'.github/workflows/release-please.yml',
		],
		canFixDrift: true,
		async run({ targetDir }) {
			const filesWritten = await generateReleasePleaseConfig(targetDir)
			return { filesWritten }
		},
	},
	{
		target: 'oxlint',
		description: 'Scaffold .oxlintrc.json (additive to Biome/ESLint)',
		appliesTo: ['Oxlint'],
		outputs: ['.oxlintrc.json'],
		canFixDrift: true,
		async run({ targetDir }) {
			const result = await copyPreset('oxlint', targetDir)
			return { filesWritten: [result.target] }
		},
	},
	{
		target: 'github-actions',
		description: 'Scaffold .github/workflows/ci.yml (+ codecov.yml when tests run)',
		appliesTo: ['GitHub Actions', 'Coverage upload', 'npm OIDC publish'],
		outputs: ['.github/workflows/ci.yml', 'codecov.yml'],
		canFixDrift: true,
		async run({ targetDir, pkg }) {
			await generateGitHubActions(inferProjectConfig(pkg), targetDir)
			const filesWritten = ['.github/workflows/ci.yml']
			if (await fs.pathExists(path.join(targetDir, 'codecov.yml'))) filesWritten.push('codecov.yml')
			return { filesWritten }
		},
	},
	{
		target: 'dependabot',
		description:
			'Scaffold the canonical .github/dependabot.yml (monthly, grouped: production-minor/dev-minor/major-updates) + the dependabot-automerge workflow',
		appliesTo: ['Dependabot'],
		outputs: ['.github/dependabot.yml', '.github/workflows/dependabot-automerge.yml'],
		canFixDrift: true,
		async run({ targetDir }) {
			const filesWritten = await generateDependabotConfig(targetDir)
			return { filesWritten }
		},
	},
	{
		target: 'renovate',
		description: 'Scaffold renovate.json (weekly schedule; alternative to Dependabot)',
		appliesTo: ['Dependabot'],
		outputs: ['renovate.json'],
		riskLevel: 'safe-add',
		async run({ targetDir }) {
			await generateRenovateConfig(targetDir)
			return { filesWritten: ['renovate.json'] }
		},
	},
	{
		target: 'codeql',
		description: 'Scaffold .github/workflows/codeql.yml (security scanning)',
		appliesTo: ['CodeQL'],
		outputs: ['.github/workflows/codeql.yml'],
		async run({ targetDir }) {
			await generateCodeQLWorkflow(targetDir)
			return { filesWritten: ['.github/workflows/codeql.yml'] }
		},
	},
	{
		target: 'github-settings',
		description:
			'Apply branch protection + auto-merge + workflow permissions + code-scanning ruleset on GitHub via gh api (mutates the remote repo, not files)',
		appliesTo: [
			'Branch protection',
			'Merge settings',
			'Workflow permissions',
			'Code-scanning gate',
		],
		outputs: ['GitHub repo settings (remote, via gh api)'],
		// safe-add is load-bearing: it exempts this fixer from the `--diff` shadow-run
		// (previewFixer copies to tmp and *executes* run(), which would fire real
		// `gh api` PUTs during a mere preview).
		riskLevel: 'safe-add',
		canFixDrift: true,
		async run({ targetDir }) {
			return { filesWritten: await applyGithubSettings(targetDir) }
		},
	},
	{
		target: 'codeowners',
		description: 'Scaffold .github/CODEOWNERS with commented examples',
		appliesTo: ['CODEOWNERS'],
		outputs: ['.github/CODEOWNERS'],
		riskLevel: 'safe-add',
		canFixDrift: false,
		async run({ targetDir }) {
			const written = await generateCodeowners(targetDir)
			return { filesWritten: [written] }
		},
	},
	{
		target: 'community-health',
		description: 'Scaffold CONTRIBUTING.md, SECURITY.md, PR + issue templates',
		appliesTo: ['Community health'],
		outputs: [
			'CONTRIBUTING.md',
			'SECURITY.md',
			'.github/PULL_REQUEST_TEMPLATE.md',
			'.github/ISSUE_TEMPLATE/bug_report.md',
			'.github/ISSUE_TEMPLATE/feature_request.md',
		],
		riskLevel: 'safe-add',
		canFixDrift: false,
		async run({ targetDir }) {
			const filesWritten = await generateCommunityHealth(targetDir)
			return { filesWritten }
		},
	},
	{
		target: 'gitlab-ci',
		description: 'Scaffold .gitlab-ci.yml (lint/typecheck/test/build mirrored from GitHub Actions)',
		appliesTo: ['GitLab CI'],
		outputs: ['.gitlab-ci.yml'],
		canFixDrift: true,
		async run({ targetDir, pkg }) {
			const written = await generateGitLabCI(inferProjectConfig(pkg), targetDir)
			return { filesWritten: [written] }
		},
	},
	...GH_WORKFLOW_FIXERS,
	{
		target: 'turborepo',
		description: 'Scaffold turbo.json task pipeline (pnpm-workspace monorepos)',
		appliesTo: ['Turborepo'],
		outputs: ['turbo.json'],
		// safe-add: never clobber a hand-tuned turbo.json.
		riskLevel: 'safe-add',
		async run({ targetDir }) {
			const written = await generateTurborepo(targetDir)
			return { filesWritten: [written] }
		},
	},
	{
		target: 'nx',
		description: 'Scaffold nx.json task orchestrator (alternative to Turborepo)',
		// No doctor check — orchestrator is opt-in and Turborepo is the default;
		// runs only when explicitly targeted. generateNx never clobbers nx.json.
		appliesTo: [],
		outputs: ['nx.json'],
		riskLevel: 'safe-add',
		async run({ targetDir }) {
			const filesWritten = await generateNx(targetDir)
			return { filesWritten }
		},
	},
	{
		target: 'tailwind',
		description: 'Scaffold Tailwind CSS v4 (postcss.config.mjs + src/styles/globals.css)',
		appliesTo: ['Tailwind'],
		outputs: ['postcss.config.mjs', 'src/styles/globals.css'],
		// safe-add: never clobber an existing PostCSS config or CSS entry.
		riskLevel: 'safe-add',
		async run({ targetDir }) {
			const written = await generateTailwind(targetDir)
			return { filesWritten: written }
		},
	},
	{
		target: 'postcss',
		description: 'Scaffold postcss.config.mjs with autoprefixer (non-Tailwind CSS pipelines)',
		appliesTo: ['PostCSS'],
		outputs: ['postcss.config.mjs'],
		// safe-add: never clobber an existing config (incl. one written by `fix tailwind`).
		riskLevel: 'safe-add',
		async run({ targetDir }) {
			const written = await generatePostcss(targetDir)
			return { filesWritten: written }
		},
	},
	{
		target: 'editorconfig',
		description: 'Scaffold .editorconfig (UTF-8, LF, tab indent)',
		appliesTo: ['EditorConfig'],
		outputs: ['.editorconfig'],
		canFixDrift: true,
		async run({ targetDir }) {
			await generateEditorConfig(targetDir)
			return { filesWritten: ['.editorconfig'] }
		},
	},
	{
		target: 'vscode-extensions',
		description:
			'Recommend the VS Code extensions matching the enabled tools (.vscode/extensions.json)',
		appliesTo: ['VS Code extensions'],
		outputs: ['.vscode/extensions.json'],
		// Preserves any recommendations already present; only appends ours.
		riskLevel: 'safe-merge',
		canFixDrift: true,
		async run({ targetDir, pkg }) {
			const written = await generateVscodeExtensions(inferProjectConfig(pkg), targetDir)
			return { filesWritten: written ? [written] : [] }
		},
	},
	{
		target: 'nvmrc',
		description: 'Scaffold .nvmrc pinned to Node 22',
		appliesTo: ['Node version pin'],
		outputs: ['.nvmrc'],
		canFixDrift: true,
		async run({ targetDir }) {
			await generateNvmrc(targetDir)
			return { filesWritten: ['.nvmrc'] }
		},
	},
	{
		target: 'node-version',
		description: 'Point CI workflows at `node-version-file: .nvmrc` (one Node source of truth)',
		appliesTo: ['Node version consistency'],
		outputs: ['.nvmrc', '.github/workflows/*.yml (node-version-file)'],
		riskLevel: 'safe-merge',
		canFixDrift: true,
		async run({ targetDir }) {
			const filesWritten = await alignNodeVersion(targetDir)
			return { filesWritten }
		},
	},
	{
		target: 'engines',
		description: 'Add engines.node to package.json',
		appliesTo: ['engines.node'],
		outputs: ['package.json (engines.node field)'],
		riskLevel: 'safe-merge',
		canFixDrift: true,
		async run({ targetDir }) {
			const result = await ensureEnginesNode(targetDir)
			return { filesWritten: result === 'added' ? ['package.json'] : [] }
		},
	},
	{
		target: 'knip',
		description: 'Scaffold knip.json (entry globs matched to the package.json build model)',
		appliesTo: ['knip'],
		outputs: ['knip.json'],
		canFixDrift: true,
		async run({ targetDir }) {
			await generateKnipConfig(targetDir)
			return { filesWritten: ['knip.json'] }
		},
	},
	{
		target: 'size-limit',
		description:
			'Scaffold a size-limit budget — exports-driven .size-limit.cjs for multi-subpath libraries, else a static .size-limit.json',
		appliesTo: ['size-limit'],
		outputs: ['.size-limit.cjs', '.size-limit.json'],
		canFixDrift: true,
		async run({ targetDir }) {
			const written = await generateSizeLimitConfig(targetDir)
			return { filesWritten: [written] }
		},
	},
	{
		target: 'rollup',
		description: 'Scaffold rollup.config.mjs re-exporting the shared library preset',
		appliesTo: [],
		outputs: ['rollup.config.mjs'],
		riskLevel: 'safe-add',
		async run({ targetDir }) {
			await generateRollupConfig(targetDir)
			return { filesWritten: ['rollup.config.mjs'] }
		},
	},
	{
		target: 'rolldown',
		description: 'Scaffold rolldown.config.mjs re-exporting the shared library preset',
		appliesTo: [],
		outputs: ['rolldown.config.mjs'],
		riskLevel: 'safe-add',
		async run({ targetDir }) {
			await generateRolldownConfig(targetDir)
			return { filesWritten: ['rolldown.config.mjs'] }
		},
	},
	{
		target: 'bun',
		description:
			'Scaffold bunfig.toml + a Bun-typed tsconfig.json (extends the bun preset) for Bun runtime/test users',
		// Opt-in toolchain — no doctor check; runs only when explicitly targeted.
		appliesTo: [],
		outputs: ['bunfig.toml', 'tsconfig.json'],
		// safe-add: never clobbers an existing bunfig.toml or tsconfig.json.
		riskLevel: 'safe-add',
		async run({ targetDir }) {
			const filesWritten = await generateBun(targetDir)
			return { filesWritten }
		},
	},
	{
		target: 'treeshake-check',
		description:
			'Scaffold apps/treeshake-check — esbuild + metafile assertion that one subpath bundles cleanly',
		appliesTo: ['Tree-shake check'],
		outputs: [
			'apps/treeshake-check/package.json',
			'apps/treeshake-check/check.mjs',
			'apps/treeshake-check/src/entry.ts',
			'pnpm-workspace.yaml',
		],
		riskLevel: 'safe-add',
		canFixDrift: false,
		async run({ targetDir, pkg }) {
			if (!pkg) {
				console.log(chalk.yellow('   no package.json found — skipping'))
				return { filesWritten: [] }
			}
			const workspaceName = (pkg.name as string | undefined) ?? null
			if (!workspaceName) {
				console.log(chalk.yellow('   package.json has no `name` — skipping'))
				return { filesWritten: [] }
			}
			const { allCandidates, defaultAllowed } = inferSubpathsFromExports(pkg)
			if (allCandidates.length < 2 || !defaultAllowed) {
				console.log(
					chalk.yellow(
						'   package.json does not expose ≥2 subpath exports — tree-shake check needs multiple subpaths to be meaningful. Skipping.'
					)
				)
				return { filesWritten: [] }
			}
			const allowedSubpath = defaultAllowed
			const forbiddenSubpaths = allCandidates.filter((s) => s !== allowedSubpath)
			const written = await generateTreeshakeCheck(targetDir, {
				workspaceName,
				allowedSubpath,
				forbiddenSubpaths,
			})
			console.log(
				chalk.dim(
					`   Wired '${allowedSubpath}' as allowed; forbidden = [${forbiddenSubpaths.join(', ')}]. Edit apps/treeshake-check/check.mjs to tune.`
				)
			)
			return { filesWritten: written }
		},
	},
	{
		target: 'typedoc',
		description:
			'Scaffold typedoc.json extending the preset + .github/workflows/docs.yml (GitHub Pages)',
		appliesTo: ['TypeDoc'],
		outputs: ['typedoc.json', '.github/workflows/docs.yml'],
		riskLevel: 'safe-add',
		canFixDrift: true,
		async run({ targetDir, pkg }) {
			await generateTypedocConfig(pkg, targetDir)
			const workflow = await generateTypedocWorkflow(targetDir)
			const pkgPath = path.join(targetDir, 'package.json')
			const filesWritten: string[] = ['typedoc.json', workflow]
			if (await fs.pathExists(pkgPath)) {
				const pkgData = (await fs.readJson(pkgPath)) as Record<string, unknown>
				const scripts = (pkgData.scripts as Record<string, string> | undefined) ?? {}
				if (!scripts.docs) {
					pkgData.scripts = { ...scripts, docs: 'typedoc' }
					await fs.writeJson(pkgPath, pkgData, { spaces: 2 })
					filesWritten.push('package.json')
				}
			}
			return { filesWritten }
		},
	},
	{
		target: 'docs-site',
		description:
			'Scaffold a Docusaurus docs site under apps/docs (config/sidebars/tokens + reusable Pages deploy), inferring name/org/repo from package.json',
		// Manual/opt-in target — the "Docs site" doctor check is opt-in (only
		// surfaces once a site exists), so this never nags a repo without one.
		appliesTo: [],
		outputs: [
			'apps/docs/**',
			'scripts/sync-changelog.mjs',
			'pnpm-workspace.yaml',
			'.github/workflows/docs.yml',
		],
		riskLevel: 'safe-add',
		async run({ targetDir, pkg }) {
			// Wire the TypeDoc API section (#229) when the repo already uses TypeDoc —
			// a typedoc config on disk or the dep installed. No new CLI flag needed.
			const deps = {
				...((pkg?.dependencies as Record<string, string> | undefined) ?? {}),
				...((pkg?.devDependencies as Record<string, string> | undefined) ?? {}),
			}
			const typedocConfigs = [
				'typedoc.json',
				'typedoc.config.js',
				'typedoc.config.mjs',
				'typedoc.config.cjs',
				'typedoc.config.ts',
			]
			let hasTypedocConfig = false
			for (const c of typedocConfigs) {
				if (await fs.pathExists(path.join(targetDir, c))) {
					hasTypedocConfig = true
					break
				}
			}
			const typedoc = hasTypedocConfig || 'typedoc' in deps
			const filesWritten = await generateDocsSite(pkg, targetDir, { typedoc })
			return { filesWritten }
		},
	},
	{
		target: 'attw',
		description:
			'Install @arethetypeswrong/cli + add an `attw` script (esm-only profile when applicable) and wire it into verify',
		appliesTo: ['are-the-types-wrong'],
		outputs: ['package.json (devDependencies + scripts.attw)'],
		riskLevel: 'safe-merge',
		canFixDrift: true,
		async run({ targetDir, pkg }) {
			const pkgPath = path.join(targetDir, 'package.json')
			if (!pkg) {
				console.log(chalk.yellow('   no package.json found — skipping'))
				return { filesWritten: [] }
			}
			const updated = { ...pkg }
			const devDeps = {
				...((updated.devDependencies as Record<string, string> | undefined) ?? {}),
			}
			if (!devDeps['@arethetypeswrong/cli']) devDeps['@arethetypeswrong/cli'] = '^0.18.2'
			updated.devDependencies = devDeps

			const scripts = { ...((updated.scripts as Record<string, string> | undefined) ?? {}) }
			scripts.attw = isEsmOnly(pkg) ? 'attw --pack --profile esm-only' : 'attw --pack'
			if (scripts.verify && !/\battw\b/.test(scripts.verify)) {
				scripts.verify = `${scripts.verify} && pnpm attw`
			}
			updated.scripts = scripts

			await fs.writeJson(pkgPath, updated, { spaces: 2 })
			return { filesWritten: ['package.json'] }
		},
	},
	{
		target: 'publint',
		description: 'Install publint + add a `publint --strict` script and wire it into verify',
		appliesTo: ['publint'],
		outputs: ['package.json (devDependencies + scripts.publint)'],
		riskLevel: 'safe-merge',
		canFixDrift: true,
		async run({ targetDir, pkg }) {
			const pkgPath = path.join(targetDir, 'package.json')
			if (!pkg) {
				console.log(chalk.yellow('   no package.json found — skipping'))
				return { filesWritten: [] }
			}
			const updated = { ...pkg }
			const devDeps = {
				...((updated.devDependencies as Record<string, string> | undefined) ?? {}),
			}
			if (!devDeps['publint']) devDeps['publint'] = '^0.3.0'
			updated.devDependencies = devDeps

			const scripts = { ...((updated.scripts as Record<string, string> | undefined) ?? {}) }
			scripts.publint = 'publint --strict'
			if (scripts.verify && !/\bpublint\b/.test(scripts.verify)) {
				scripts.verify = `${scripts.verify} && pnpm publint`
			}
			updated.scripts = scripts

			await fs.writeJson(pkgPath, updated, { spaces: 2 })
			return { filesWritten: ['package.json'] }
		},
	},
	{
		target: 'badges',
		description: 'Add or refresh the status-badge block in README.md (derived from package.json)',
		appliesTo: ['README badges'],
		outputs: ['README.md'],
		riskLevel: 'safe-merge',
		canFixDrift: true,
		async run({ targetDir, pkg }) {
			if (!pkg) {
				console.log(chalk.yellow('   no package.json found — skipping'))
				return { filesWritten: [] }
			}
			const p = pkg as Record<string, unknown>
			const name = typeof p.name === 'string' ? p.name : undefined
			const parsed = parseRepository(p.repository)
			const block = buildBadgeBlock({
				name,
				owner: parsed?.owner,
				repo: parsed?.repo,
				isPrivate: p.private === true,
			})
			if (!block) {
				console.log(
					chalk.yellow('   package.json has no name/repository to build badges from — skipping')
				)
				return { filesWritten: [] }
			}
			const readmePath = path.join(targetDir, 'README.md')
			const existing = (await fs.pathExists(readmePath))
				? await fs.readFile(readmePath, 'utf8')
				: `# ${name ?? 'project'}\n`
			await fs.writeFile(readmePath, upsertBadges(existing, block))
			return { filesWritten: ['README.md'] }
		},
	},
	{
		target: 'ai',
		description:
			'Install all AI agent files at once (AGENTS.md, CLAUDE.md, Cursor, Copilot, Claude skill, MCP example)',
		appliesTo: ['AI setup'],
		outputs: [
			'AGENTS.md',
			'CLAUDE.md',
			'.cursor/rules/repo-tooling.mdc',
			'.github/copilot-instructions.md',
			'.claude/skills/repo-tooling.md',
			'.mcp.json.example',
			// Only written when the repo ships its own skills/<name>/SKILL.md.
			'README.md',
		],
		// Every output is a delimited-block upsert or a `.example` file — existing
		// user content is never clobbered.
		riskLevel: 'safe-merge',
		canFixDrift: true,
		async run({ targetDir }) {
			const filesWritten = await installAiSetup(targetDir)
			return { filesWritten }
		},
	},
	{
		target: 'claude-skill',
		description: 'Install the repo-tooling Claude Code skill into .claude/skills/',
		appliesTo: ['Claude skill'],
		outputs: ['.claude/skills/repo-tooling.md'],
		riskLevel: 'safe-add',
		canFixDrift: true,
		async run({ targetDir }) {
			const result = await copyPreset('claude-skill', targetDir)
			return { filesWritten: [result.target] }
		},
	},
	{
		target: 'cursor-rules',
		description: 'Install the repo-tooling rules for Cursor (.cursor/rules/repo-tooling.mdc)',
		appliesTo: ['Cursor rules'],
		outputs: ['.cursor/rules/repo-tooling.mdc'],
		riskLevel: 'safe-add',
		canFixDrift: true,
		async run({ targetDir }) {
			const written = await installAgentRules(targetDir, 'cursor')
			return { filesWritten: [written] }
		},
	},
	{
		target: 'copilot-instructions',
		description:
			'Install the repo-tooling rules for GitHub Copilot (.github/copilot-instructions.md)',
		appliesTo: ['Copilot instructions'],
		outputs: ['.github/copilot-instructions.md'],
		// Upserts a delimited block — never clobbers the consumer's own instructions.
		riskLevel: 'safe-merge',
		canFixDrift: true,
		async run({ targetDir }) {
			const written = await installAgentRules(targetDir, 'copilot')
			return { filesWritten: [written] }
		},
	},
	{
		target: 'agents-md',
		description: 'Install the repo-tooling rules into AGENTS.md (universal agent instructions)',
		appliesTo: ['AGENTS.md rules'],
		outputs: ['AGENTS.md'],
		// Upserts a delimited block — never clobbers existing AGENTS.md content.
		riskLevel: 'safe-merge',
		canFixDrift: true,
		async run({ targetDir }) {
			const written = await installAgentRules(targetDir, 'agents-md')
			return { filesWritten: [written] }
		},
	},
	{
		target: 'package-json',
		description: 'Add @rtorcato/repo-tooling to devDependencies',
		appliesTo: ['package.json'],
		outputs: ['package.json (devDependencies)'],
		riskLevel: 'safe-merge',
		canFixDrift: true,
		async run({ targetDir, pkg }) {
			const pkgPath = path.join(targetDir, 'package.json')
			if (!pkg) {
				console.log(chalk.yellow('   no package.json found — skipping'))
				return { filesWritten: [] }
			}
			const updated = { ...pkg }
			const devDeps = {
				...((updated.devDependencies as Record<string, string> | undefined) ?? {}),
			}
			devDeps['@rtorcato/repo-tooling'] = 'latest'
			updated.devDependencies = devDeps
			await fs.writeJson(pkgPath, updated, { spaces: 2 })
			console.log(chalk.dim('   reminder: run `pnpm install` to install the new dep'))
			return { filesWritten: ['package.json'] }
		},
	},
	{
		target: 'lockfile',
		description: `Scaffold ${LOCKFILE_NAME} recording current tool choices`,
		appliesTo: ['lockfile'],
		outputs: [LOCKFILE_NAME],
		riskLevel: 'safe-add',
		canFixDrift: false,
		async run({ targetDir, pkg }) {
			if (!pkg) {
				console.log(chalk.yellow('   no package.json found — skipping'))
				return { filesWritten: [] }
			}
			const config = inferProjectConfig(pkg)
			await writeLockfile(targetDir, config)
			return { filesWritten: [LOCKFILE_NAME] }
		},
	},
]
