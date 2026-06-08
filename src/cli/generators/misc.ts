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

const KNIP_CONFIG = {
	$schema: 'https://unpkg.com/knip@5/schema.json',
	entry: ['src/index.ts'],
	project: ['src/**/*.ts'],
}

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

export async function generateKnipConfig(targetDir: string) {
	await fs.writeJson(path.join(targetDir, 'knip.json'), KNIP_CONFIG, { spaces: 2 })
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
