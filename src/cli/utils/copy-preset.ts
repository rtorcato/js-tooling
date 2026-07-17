import path from 'node:path'
import fs from 'fs-extra'

export type PresetName =
	| 'biome'
	| 'bun'
	| 'nx'
	| 'changesets'
	| 'release-please'
	| 'oxlint'
	| 'tsconfig'
	| 'claude-skill'
	| 'mcp-example'
	| 'docusaurus-sync-changelog'
	| 'docusaurus-theme-tokens'

export interface PresetDefinition {
	source: string
	target: string
	desc: string
}

export const PRESETS: Record<PresetName, PresetDefinition> = {
	biome: {
		source: 'tooling/biome/biome.json',
		target: 'biome.json',
		desc: 'Biome formatter and linter configuration',
	},
	bun: {
		source: 'tooling/bun/bunfig.toml',
		target: 'bunfig.toml',
		desc: 'Bun runtime/test-runner configuration',
	},
	nx: {
		source: 'tooling/nx/nx.json',
		target: 'nx.json',
		desc: 'Nx monorepo task-orchestrator configuration',
	},
	changesets: {
		source: 'tooling/changesets/config.json',
		target: '.changeset/config.json',
		desc: 'Changesets release-tool configuration',
	},
	'release-please': {
		source: 'tooling/release-please/release-please-config.json',
		target: 'release-please-config.json',
		desc: 'Release Please release-tool configuration',
	},
	oxlint: {
		source: 'tooling/oxlint/oxlintrc.json',
		target: '.oxlintrc.json',
		desc: 'Oxlint linter configuration (additive to Biome)',
	},
	tsconfig: {
		source: 'tooling/typescript/tsconfig.base.json',
		target: 'tsconfig.json',
		desc: 'TypeScript base configuration',
	},
	'claude-skill': {
		source: 'tooling/claude/js-tooling.md',
		target: '.claude/skills/js-tooling.md',
		desc: 'Claude Code skill for driving the js-tooling CLI',
	},
	'mcp-example': {
		source: 'tooling/mcp/mcp.json.example',
		target: '.mcp.json.example',
		desc: 'Commented MCP server template (copy to .mcp.json to activate)',
	},
	'docusaurus-sync-changelog': {
		source: 'tooling/docusaurus/sync-changelog.mjs',
		target: 'scripts/sync-changelog.mjs',
		desc: 'Canonical CHANGELOG → docs sync script for Docusaurus sites',
	},
	'docusaurus-theme-tokens': {
		source: 'tooling/docusaurus/theme-tokens.css',
		target: 'apps/docs/src/css/_jt-tokens.css',
		desc: 'Shared Docusaurus design tokens (Geist + navy surfaces; accent per-project)',
	},
}

export function getPackageRoot(): string {
	const cliFile = new URL(import.meta.url).pathname
	return path.dirname(path.dirname(path.dirname(path.dirname(cliFile))))
}

export interface CopyPresetResult {
	source: string
	target: string
	targetPath: string
	desc: string
}

export async function copyPreset(
	name: PresetName,
	targetDir: string = process.cwd()
): Promise<CopyPresetResult> {
	const preset = PRESETS[name]
	const packageRoot = getPackageRoot()
	const sourcePath = path.join(packageRoot, preset.source)
	const targetPath = path.join(targetDir, preset.target)

	await fs.copy(sourcePath, targetPath)

	return {
		source: preset.source,
		target: preset.target,
		targetPath,
		desc: preset.desc,
	}
}
