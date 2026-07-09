import path from 'node:path'
import fs from 'fs-extra'

const EDITORCONFIG_CONTENT = `root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = tab
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false

[*.{json,yml,yaml}]
indent_style = space
indent_size = 2
`

const NVMRC_CONTENT = '22\n'

const SIZE_LIMIT_CONFIG = [
	{
		name: 'package (default entry)',
		path: 'dist/index.js',
		limit: '10 kB',
	},
]

const CODEOWNERS_CONTENT = `# .github/CODEOWNERS
# Each line is a file pattern followed by one or more owners.
# Owners can be GitHub usernames (@user) or team names (@org/team).
# Order matters — the last matching pattern wins.
# See https://docs.github.com/articles/about-code-owners/
#
# Examples:
#   *              @your-username
#   /src/api/      @backend-team
#   /docs/         @docs-team @your-username
#   *.md           @docs-team

* @TODO-owner
`

export async function generateEditorConfig(targetDir: string) {
	await fs.writeFile(path.join(targetDir, '.editorconfig'), EDITORCONFIG_CONTENT)
}

export async function generateNvmrc(targetDir: string) {
	await fs.writeFile(path.join(targetDir, '.nvmrc'), NVMRC_CONTENT)
}

const DEFAULT_NODE_MAJOR = 22

/**
 * Resolve the authoritative Node major: an existing .nvmrc/.node-version wins,
 * else the `engines.node` floor, else the default. Used to seed .nvmrc when a
 * repo has no pin yet before pointing workflows at it.
 */
async function resolveNodeMajor(targetDir: string): Promise<number> {
	for (const candidate of ['.nvmrc', '.node-version']) {
		const p = path.join(targetDir, candidate)
		if (await fs.pathExists(p)) {
			const m = (await fs.readFile(p, 'utf-8')).trim().match(/\d+/)
			if (m) return Number.parseInt(m[0], 10)
		}
	}
	const pkgPath = path.join(targetDir, 'package.json')
	if (await fs.pathExists(pkgPath)) {
		const pkg = (await fs.readJson(pkgPath)) as Record<string, unknown>
		const node = (pkg.engines as Record<string, string> | undefined)?.node
		const m = node?.match(/\d+/)
		if (m) return Number.parseInt(m[0], 10)
	}
	return DEFAULT_NODE_MAJOR
}

// A hardcoded scalar `node-version: <major>` line (leading digit after an
// optional quote). Deliberately does NOT match matrix arrays (`[22, 24]`),
// `${{ }}` expressions, or bare `node-version:` input keys — those are left as-is.
const NODE_VERSION_LINE = /^([ \t]*)node-version:[ \t]*['"]?\d[\w.-]*['"]?[ \t]*$/gm

/**
 * Make .nvmrc the single Node source of truth: ensure it exists (pinned to the
 * resolved major) and rewrite hardcoded scalar `node-version:` lines in CI
 * workflows to `node-version-file: .nvmrc`. Returns the files changed.
 */
export async function alignNodeVersion(targetDir: string): Promise<string[]> {
	const written: string[] = []
	const nvmrcPath = path.join(targetDir, '.nvmrc')
	if (!(await fs.pathExists(nvmrcPath))) {
		const major = await resolveNodeMajor(targetDir)
		await fs.writeFile(nvmrcPath, `${major}\n`)
		written.push('.nvmrc')
	}

	const workflowsDir = path.join(targetDir, '.github', 'workflows')
	if (await fs.pathExists(workflowsDir)) {
		const files = (await fs.readdir(workflowsDir)).filter(
			(f) => f.endsWith('.yml') || f.endsWith('.yaml')
		)
		for (const file of files) {
			const p = path.join(workflowsDir, file)
			const contents = await fs.readFile(p, 'utf-8')
			const next = contents.replace(NODE_VERSION_LINE, '$1node-version-file: .nvmrc')
			if (next !== contents) {
				await fs.writeFile(p, next)
				written.push(`.github/workflows/${file}`)
			}
		}
	}
	return written
}

export type EnsureEnginesResult = 'added' | 'already-set' | 'no-package-json'

export async function ensureEnginesNode(
	targetDir: string,
	version = '>=22'
): Promise<EnsureEnginesResult> {
	const pkgPath = path.join(targetDir, 'package.json')
	if (!(await fs.pathExists(pkgPath))) return 'no-package-json'

	const pkg = (await fs.readJson(pkgPath)) as Record<string, unknown>
	const engines = (pkg.engines as Record<string, string> | undefined) ?? {}

	if (engines.node) return 'already-set'

	pkg.engines = { ...engines, node: version }
	await fs.writeJson(pkgPath, pkg, { spaces: 2 })
	return 'added'
}

/**
 * Build a knip config whose `entry` matches the project's build model, read
 * from package.json `exports`:
 *   - >1 public subpath export  → per-file/multi-entry lib (e.g. react-common,
 *     whose build makes every src module its own entry). Every file is a public
 *     entry, so `entry` covers all of src — flagging none as "unused files"
 *     while still catching unused exports and dependencies.
 *   - single root barrel / no exports → narrow `src/index` entry so knip can
 *     trace and flag genuinely unreachable modules.
 * `.tsx` is included so React libraries aren't silently skipped.
 */
/**
 * Extract package globs from a pnpm-workspace.yaml `packages:` list without a
 * YAML dependency. Matches `- 'apps/*'` / `- "apps/*"` / `- apps/*` entries
 * under the `packages:` key, stopping at the next top-level key.
 */
function parseWorkspacePackages(yaml: string): string[] {
	const globs: string[] = []
	let inPackages = false
	for (const line of yaml.split('\n')) {
		if (/^packages:\s*$/.test(line)) {
			inPackages = true
			continue
		}
		if (!inPackages) continue
		const item = line.match(/^\s*-\s*['"]?([^'"#]+?)['"]?\s*$/)
		if (item) {
			globs.push(item[1].trim())
			continue
		}
		if (/^\S/.test(line)) break // a new top-level key ends the list
	}
	return globs
}

export async function buildKnipConfig(targetDir: string) {
	const pkgPath = path.join(targetDir, 'package.json')
	let multiEntry = false
	if (await fs.pathExists(pkgPath)) {
		const pkg = (await fs.readJson(pkgPath)) as { exports?: unknown }
		if (pkg.exports && typeof pkg.exports === 'object') {
			const subpaths = Object.keys(pkg.exports).filter(
				(k) => k.startsWith('.') && k !== './package.json'
			)
			multiEntry = subpaths.length > 1
		}
	}

	const $schema = 'https://unpkg.com/knip@6/schema.json'
	const entry = multiEntry ? ['src/**/*.{ts,tsx}'] : ['src/index.{ts,tsx}']
	const project = ['src/**/*.{ts,tsx}']

	// In a pnpm workspace, the flat entry/project form makes `knip` mis-analyze
	// the sub-packages (it treats the whole repo as one package). Emit the
	// `workspaces` form instead: the root keeps the build-model globs, and each
	// declared package glob gets `{}` so knip auto-detects its entries.
	const wsPath = path.join(targetDir, 'pnpm-workspace.yaml')
	if (await fs.pathExists(wsPath)) {
		const workspaces: Record<string, unknown> = { '.': { entry, project } }
		for (const glob of parseWorkspacePackages(await fs.readFile(wsPath, 'utf-8'))) {
			workspaces[glob] = {}
		}
		return { $schema, workspaces }
	}

	return { $schema, entry, project }
}

export async function generateKnipConfig(targetDir: string) {
	const config = await buildKnipConfig(targetDir)
	await fs.writeJson(path.join(targetDir, 'knip.json'), config, { spaces: 2 })
}

export async function generateSizeLimitConfig(targetDir: string) {
	await fs.writeJson(path.join(targetDir, '.size-limit.json'), SIZE_LIMIT_CONFIG, { spaces: 2 })
}

export async function generateCodeowners(targetDir: string): Promise<string> {
	const filepath = path.join(targetDir, '.github', 'CODEOWNERS')
	await fs.ensureDir(path.dirname(filepath))
	await fs.writeFile(filepath, CODEOWNERS_CONTENT)
	return '.github/CODEOWNERS'
}

export async function generateMiscBaseline(targetDir: string) {
	await generateEditorConfig(targetDir)
	await generateNvmrc(targetDir)
	await ensureEnginesNode(targetDir)
	await generateKnipConfig(targetDir)
}
