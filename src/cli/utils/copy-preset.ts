import path from 'node:path'
import fs from 'fs-extra'

export type PresetName = 'biome' | 'tsconfig'

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
	tsconfig: {
		source: 'tooling/typescript/tsconfig.base.json',
		target: 'tsconfig.json',
		desc: 'TypeScript base configuration',
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
