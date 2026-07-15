import path from 'node:path'
import fs from 'fs-extra'

export type DetectedLanguage = 'js' | 'swift' | 'perl' | 'python' | 'unknown'

/**
 * Marker files that identify a repo's language, checked in order — first match
 * wins. One language per repo root; multi-language monorepos are out of scope
 * for v1 (see #139). A dir with no marker → 'unknown' (base checks only).
 */
const MARKERS: ReadonlyArray<[DetectedLanguage, readonly string[]]> = [
	['js', ['package.json']],
	['swift', ['Package.swift']],
	['perl', ['cpanfile', 'Makefile.PL', 'dist.ini']],
	['python', ['pyproject.toml', 'setup.py']],
]

export async function detectLanguage(dir: string): Promise<DetectedLanguage> {
	for (const [language, candidates] of MARKERS) {
		for (const candidate of candidates) {
			if (await fs.pathExists(path.join(dir, candidate))) return language
		}
	}
	return 'unknown'
}
