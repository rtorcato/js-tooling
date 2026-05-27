import chalk from 'chalk'
import fs from 'fs-extra'
import path from 'node:path'

export interface DoctorOptions {
	directory?: string
	json?: boolean
}

export type CheckStatus = 'ok' | 'drift' | 'missing' | 'optional-missing'

export interface CheckResult {
	check: string
	status: CheckStatus
	detail: string
	hint?: string
}

const PACKAGE = '@rtorcato/js-tooling'

interface FileCheck {
	check: string
	candidates: string[]
	expected: string
	matcher: RegExp
	optional?: boolean
	hint?: string
}

const FILE_CHECKS: FileCheck[] = [
	{
		check: 'TypeScript',
		candidates: ['tsconfig.json'],
		expected: `extends "${PACKAGE}/typescript/*"`,
		matcher: /@rtorcato\/js-tooling\/typescript\//,
		hint: 'Set `"extends": "@rtorcato/js-tooling/typescript/base"` in tsconfig.json',
	},
	{
		check: 'Biome',
		candidates: ['biome.json', 'biome.jsonc'],
		expected: `extends "${PACKAGE}/biome"`,
		matcher: /@rtorcato\/js-tooling\/biome/,
		optional: true,
		hint: 'Run `npx @rtorcato/js-tooling copy biome` to scaffold',
	},
	{
		check: 'ESLint',
		candidates: ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs'],
		expected: `imports "${PACKAGE}/eslint/*"`,
		matcher: /@rtorcato\/js-tooling\/eslint\//,
		optional: true,
		hint: 'Import from @rtorcato/js-tooling/eslint/base in eslint.config.mjs',
	},
	{
		check: 'Prettier',
		candidates: ['prettier.config.js', 'prettier.config.mjs', 'prettier.config.cjs'],
		expected: `imports "${PACKAGE}/prettier"`,
		matcher: /@rtorcato\/js-tooling\/prettier/,
		optional: true,
	},
	{
		check: 'Vitest',
		candidates: ['vitest.config.ts', 'vitest.config.js', 'vitest.config.mjs'],
		expected: `imports "${PACKAGE}/vitest/config"`,
		matcher: /@rtorcato\/js-tooling\/vitest\/config/,
		optional: true,
	},
	{
		check: 'Commitlint',
		candidates: ['commitlint.config.js', 'commitlint.config.mjs', 'commitlint.config.cjs'],
		expected: `exports "${PACKAGE}/commitlint/config"`,
		matcher: /@rtorcato\/js-tooling\/commitlint\/config/,
		optional: true,
	},
]

async function checkFile(dir: string, spec: FileCheck): Promise<CheckResult> {
	for (const candidate of spec.candidates) {
		const filepath = path.join(dir, candidate)
		if (!(await fs.pathExists(filepath))) continue

		const contents = await fs.readFile(filepath, 'utf-8')
		if (spec.matcher.test(contents)) {
			return {
				check: spec.check,
				status: 'ok',
				detail: `${candidate} ${spec.expected}`,
			}
		}
		return {
			check: spec.check,
			status: 'drift',
			detail: `${candidate} found but does not ${spec.expected}`,
			hint: spec.hint,
		}
	}

	return {
		check: spec.check,
		status: spec.optional ? 'optional-missing' : 'missing',
		detail: `no ${spec.candidates.join(' / ')} found`,
		hint: spec.hint,
	}
}

async function checkPackageJson(dir: string): Promise<CheckResult> {
	const filepath = path.join(dir, 'package.json')
	if (!(await fs.pathExists(filepath))) {
		return {
			check: 'package.json',
			status: 'missing',
			detail: 'no package.json found',
		}
	}

	const pkg = await fs.readJson(filepath)
	const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }

	if (deps[PACKAGE]) {
		return {
			check: 'package.json',
			status: 'ok',
			detail: `${PACKAGE}@${deps[PACKAGE]} in dependencies`,
		}
	}

	return {
		check: 'package.json',
		status: 'drift',
		detail: `${PACKAGE} not in dependencies or devDependencies`,
		hint: `Run \`pnpm add -D ${PACKAGE}\``,
	}
}

export async function runDoctor(dir: string): Promise<CheckResult[]> {
	const targetDir = path.resolve(dir)
	const results: CheckResult[] = []

	results.push(await checkPackageJson(targetDir))
	for (const spec of FILE_CHECKS) {
		results.push(await checkFile(targetDir, spec))
	}

	return results
}

const STATUS_ICONS: Record<CheckStatus, string> = {
	ok: chalk.green('✅'),
	drift: chalk.yellow('⚠️ '),
	missing: chalk.red('❌'),
	'optional-missing': chalk.gray('➖'),
}

function statusLabel(status: CheckStatus): string {
	switch (status) {
		case 'ok':
			return chalk.green('ok')
		case 'drift':
			return chalk.yellow('drift')
		case 'missing':
			return chalk.red('missing')
		case 'optional-missing':
			return chalk.gray('not configured')
	}
}

export function summarize(results: CheckResult[]): {
	ok: number
	drift: number
	missing: number
	optionalMissing: number
} {
	return {
		ok: results.filter((r) => r.status === 'ok').length,
		drift: results.filter((r) => r.status === 'drift').length,
		missing: results.filter((r) => r.status === 'missing').length,
		optionalMissing: results.filter((r) => r.status === 'optional-missing').length,
	}
}

export async function doctorCommand(options: DoctorOptions = {}) {
	const dir = options.directory ?? process.cwd()
	const results = await runDoctor(dir)

	if (options.json) {
		console.log(JSON.stringify({ directory: path.resolve(dir), results }, null, 2))
	} else {
		console.log(chalk.cyan(`\n🩺 Diagnosing ${path.resolve(dir)} against ${PACKAGE} presets...\n`))
		for (const r of results) {
			console.log(`  ${STATUS_ICONS[r.status]} ${chalk.bold(r.check)} — ${statusLabel(r.status)}`)
			console.log(`     ${chalk.gray(r.detail)}`)
			if (r.hint && (r.status === 'drift' || r.status === 'missing')) {
				console.log(`     ${chalk.dim('hint:')} ${chalk.dim(r.hint)}`)
			}
		}
		const summary = summarize(results)
		console.log()
		console.log(
			`  Summary: ${chalk.green(`${summary.ok} ok`)}, ${chalk.yellow(`${summary.drift} drift`)}, ${chalk.red(`${summary.missing} missing`)}, ${chalk.gray(`${summary.optionalMissing} not configured`)}\n`
		)
	}

	const summary = summarize(results)
	const exitCode = summary.drift > 0 || summary.missing > 0 ? 1 : 0
	process.exitCode = exitCode
}
