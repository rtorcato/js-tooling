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
	'semantic-release': 'semantic-release',
	knip: 'knip',
	'GitHub Actions': 'github-actions',
	Dependabot: 'dependabot',
	CodeQL: 'codeql',
}

export function getFixTargetForCheck(checkName: string): string | null {
	return FIX_TARGETS[checkName] ?? null
}
