export const FIX_TARGETS: Record<string, string> = {
	'package.json': 'package-json',
	'engines.node': 'engines',
	EditorConfig: 'editorconfig',
	'Node version pin': 'nvmrc',
	TypeScript: 'tsconfig',
	Biome: 'biome',
	ESLint: 'eslint',
	Prettier: 'prettier',
	Vitest: 'vitest',
	Commitlint: 'commitlint',
	Husky: 'husky',
	'lint-staged': 'husky',
	'Husky pre-push': 'husky',
	'verify script': 'verify',
	'semantic-release': 'semantic-release',
	knip: 'knip',
	'size-limit': 'size-limit',
	'Tree-shake check': 'treeshake-check',
	'GitHub Actions': 'github-actions',
	Dependabot: 'dependabot',
	CodeQL: 'codeql',
}

export function getFixTargetForCheck(checkName: string): string | null {
	return FIX_TARGETS[checkName] ?? null
}
