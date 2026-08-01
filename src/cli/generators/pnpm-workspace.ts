import path from 'node:path'
import fs from 'fs-extra'

/**
 * Since pnpm 10, repo-wide settings live in `pnpm-workspace.yaml` rather than
 * `.npmrc` — for single-package repos too, not just workspaces. These are the
 * family-wide settings that otherwise get hand-copied and drift (#314).
 *
 * Every write here is a merge: `pnpm-workspace.yaml` also carries the repo's own
 * `packages:` globs and hand-vetted `allowBuilds` entries, so nothing is
 * rewritten and no existing value is overridden.
 */
export const WORKSPACE_FILE = 'pnpm-workspace.yaml'

/**
 * pnpm's `minimumReleaseAge` cutoff holds back freshly published versions —
 * good against a typosquat-hijack, but it also stalls every consumer of a
 * same-day `@rtorcato/*` fix for 24h. One glob covers the whole family: pnpm
 * matches these entries with `@pnpm/config.matcher`, so there's no package list
 * to keep in sync with `@rtorcato/shared-docs`'s `FAMILY`.
 */
const FAMILY_GLOB = '@rtorcato/*'

/** Bundlers that pull in esbuild, whose install script pnpm 11 refuses to run unapproved. */
const ESBUILD_BUNDLERS = ['esbuild', 'tsup', 'vite']

/** True when the repo depends on a bundler that drags esbuild in. */
export function dependsOnEsbuild(deps: Record<string, string>): boolean {
	return ESBUILD_BUNDLERS.some((name) => name in deps)
}

/**
 * The lines of a top-level YAML block, e.g. everything indented under
 * `allowBuilds:`. Returns null when the key isn't present at all. Hand-rolled
 * because adding a YAML parser to a 5-dependency CLI to read three keys isn't
 * worth it — and the same shape is already parsed this way in `misc.ts`.
 */
function section(yaml: string, key: string): string[] | null {
	const lines = yaml.split('\n')
	const start = lines.findIndex((line) => line.startsWith(`${key}:`))
	if (start === -1) return null
	const body: string[] = []
	for (const line of lines.slice(start + 1)) {
		if (/^\S/.test(line)) break // a new top-level key ends the block
		body.push(line)
	}
	return body
}

interface Setting {
	/** How doctor names this setting when it's missing. */
	label: string
	/** Only managed when this returns true for the repo. */
	applies: (needsEsbuild: boolean) => boolean
	satisfied: (yaml: string) => boolean
	/** Merged in when absent: appended as a new block, or inserted under an existing key. */
	key: string
	block: string
	item: string
}

const SETTINGS: Setting[] = [
	{
		label: 'verifyDepsBeforeRun: false',
		applies: () => true,
		// Any explicit value counts — a repo that deliberately opted into
		// verification shouldn't be nagged back to the family default.
		satisfied: (yaml) => /^verifyDepsBeforeRun:/m.test(yaml),
		key: 'verifyDepsBeforeRun',
		block: `# Don't re-verify node_modules on every script run — the check costs a
# second per invocation and CI installs with --frozen-lockfile anyway.
verifyDepsBeforeRun: false
`,
		item: '',
	},
	{
		label: `minimumReleaseAgeExclude: ${FAMILY_GLOB}`,
		applies: () => true,
		satisfied: (yaml) => (section(yaml, 'minimumReleaseAgeExclude') ?? []).some(hasFamilyGlob),
		key: 'minimumReleaseAgeExclude',
		block: `# Exempt the @rtorcato family from pnpm's minimumReleaseAge cutoff, so a
# same-day fix in a sibling package is installable today rather than tomorrow.
minimumReleaseAgeExclude:
  - '${FAMILY_GLOB}'
`,
		item: `  - '${FAMILY_GLOB}'`,
	},
	{
		label: 'allowBuilds: esbuild',
		applies: (needsEsbuild) => needsEsbuild,
		satisfied: (yaml) => (section(yaml, 'allowBuilds') ?? []).some((l) => /^\s*esbuild:/.test(l)),
		key: 'allowBuilds',
		block: `# pnpm 11 reads build-script approvals from this map, not the older
# onlyBuiltDependencies list, and fails the install outright without them.
allowBuilds:
  esbuild: true
`,
		item: '  esbuild: true',
	},
]

function hasFamilyGlob(line: string): boolean {
	return line.includes(FAMILY_GLOB)
}

/** Managed settings absent from `yaml`, named as doctor reports them. */
export function missingPnpmSettings(yaml: string, needsEsbuild: boolean): string[] {
	return SETTINGS.filter((s) => s.applies(needsEsbuild) && !s.satisfied(yaml)).map((s) => s.label)
}

/** Insert `item` directly under an existing `key:` line, keeping the rest untouched. */
function insertUnder(yaml: string, key: string, item: string): string {
	const lines = yaml.split('\n')
	const at = lines.findIndex((line) => line.startsWith(`${key}:`))
	lines.splice(at + 1, 0, item)
	return lines.join('\n')
}

/** Merge every missing managed setting into `yaml` and return the new contents. */
export function upsertPnpmSettings(yaml: string, needsEsbuild: boolean): string {
	let next = yaml
	for (const setting of SETTINGS) {
		if (!setting.applies(needsEsbuild) || setting.satisfied(next)) continue
		if (setting.item && section(next, setting.key)) {
			next = insertUnder(next, setting.key, setting.item)
		} else {
			next = `${next.replace(/\n*$/, '\n')}\n${setting.block}`
		}
	}
	return next
}

/**
 * Merge the managed pnpm settings into `pnpm-workspace.yaml`, creating it when
 * absent. Returns the relative path if anything changed, else null.
 */
export async function ensurePnpmSettings(
	targetDir: string,
	needsEsbuild: boolean
): Promise<string | null> {
	const file = path.join(targetDir, WORKSPACE_FILE)
	const current = (await fs.pathExists(file)) ? await fs.readFile(file, 'utf-8') : ''
	const next = upsertPnpmSettings(current, needsEsbuild)
	if (next === current) return null
	await fs.writeFile(file, next.replace(/^\n+/, ''))
	return WORKSPACE_FILE
}
