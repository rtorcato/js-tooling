/**
 * The fixer contract, shared by every language module (#286).
 *
 * Only the types live here — the fixers themselves belong to their language
 * module. `fix` concatenates the set for the repo's detected language.
 */
import type { Lockfile } from '../cli/utils/lockfile.js'
import type { CheckResult } from './types.js'

/** A parsed package.json, or null when the repo has none (any non-JS repo). */
export type Pkg = Record<string, unknown> | null

interface FixerContext {
	targetDir: string
	/** Always null outside the JS module — kept on the shared context so one
	 * fixer-runner drives every language. */
	pkg: Pkg
	result: CheckResult
	lock: Lockfile | null
}

export type FixRiskLevel = 'destructive' | 'safe-merge' | 'safe-add'

export interface Fixer {
	target: string
	description: string
	/** Doctor check names this fixer resolves. */
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
