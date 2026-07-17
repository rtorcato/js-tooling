import path from 'node:path'
import fs from 'fs-extra'

/**
 * Scaffold a starter nx.json for a pnpm-workspace monorepo (the Turborepo
 * alternative). Copies the shipped preset — a minimal `targetDefaults` pipeline;
 * plugin generators are deferred. Never clobbers a hand-tuned nx.json (there is
 * no doctor "ok" short-circuit for the targeted `fix nx` path). Returns the
 * relative path written, or [] when nx.json already exists.
 */
export async function generateNx(targetDir: string): Promise<string[]> {
	if (await fs.pathExists(path.join(targetDir, 'nx.json'))) return []
	const { copyPreset } = await import('../utils/copy-preset.js')
	const result = await copyPreset('nx', targetDir)
	return [result.target]
}
