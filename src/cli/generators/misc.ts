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
	return {
		$schema: 'https://unpkg.com/knip@6/schema.json',
		entry: multiEntry ? ['src/**/*.{ts,tsx}'] : ['src/index.{ts,tsx}'],
		project: ['src/**/*.{ts,tsx}'],
	}
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
