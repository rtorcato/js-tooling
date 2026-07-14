import fs from 'fs-extra'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
	evaluateNodeVersion,
	nextStepSuggestions,
	runDoctor,
	summarize,
} from '../../../src/cli/commands/doctor.js'
import { useTmpDir } from '../../helpers/tmp-dir.js'

const newTmpDir = useTmpDir()

async function seedPackageJson(dir: string, withDep = true) {
	await fs.writeJson(join(dir, 'package.json'), {
		name: 'demo',
		version: '0.0.0',
		devDependencies: withDep ? { '@rtorcato/js-tooling': '^2.0.0' } : {},
	})
}

describe('doctor', () => {
	it('reports drift when nothing is configured', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir, false)

		const results = await runDoctor(dir)
		const byCheck = new Map(results.map((r) => [r.check, r]))

		expect(byCheck.get('package.json')?.status).toBe('drift')
		expect(byCheck.get('TypeScript')?.status).toBe('missing')
		expect(byCheck.get('Biome')?.status).toBe('optional-missing')
	})

	it('reports ok when tsconfig extends our preset', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.writeJson(join(dir, 'tsconfig.json'), {
			extends: '@rtorcato/js-tooling/typescript/base',
		})

		const results = await runDoctor(dir)
		const ts = results.find((r) => r.check === 'TypeScript')
		expect(ts?.status).toBe('ok')
	})

	it('reports drift when tsconfig exists but does not extend our preset', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.writeJson(join(dir, 'tsconfig.json'), {
			compilerOptions: { strict: true },
		})

		const results = await runDoctor(dir)
		const ts = results.find((r) => r.check === 'TypeScript')
		expect(ts?.status).toBe('drift')
		expect(ts?.hint).toMatch(/tsconfig/)
	})

	it('detects biome.jsonc and eslint configs that import our presets', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.writeFile(join(dir, 'biome.jsonc'), '{ "extends": ["@rtorcato/js-tooling/biome"] }\n')
		await fs.writeFile(
			join(dir, 'eslint.config.mjs'),
			"export { default } from '@rtorcato/js-tooling/eslint/base'\n"
		)

		const results = await runDoctor(dir)
		const biome = results.find((r) => r.check === 'Biome')
		const eslint = results.find((r) => r.check === 'ESLint')
		expect(biome?.status).toBe('ok')
		expect(eslint?.status).toBe('ok')
	})

	it('summarize tallies statuses correctly', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.writeJson(join(dir, 'tsconfig.json'), {
			extends: '@rtorcato/js-tooling/typescript/base',
		})

		const results = await runDoctor(dir)
		const summary = summarize(results)
		expect(summary.ok).toBeGreaterThanOrEqual(2) // package.json + tsconfig
		expect(summary.missing).toBe(0)
	})

	it('exits with non-zero when drift or missing present', async () => {
		const dir = newTmpDir()
		// no package.json at all
		const results = await runDoctor(dir)
		const summary = summarize(results)
		expect(summary.missing + summary.drift).toBeGreaterThan(0)
	})
})

describe('evaluateNodeVersion', () => {
	it('reports missing when Node major is below the minimum', () => {
		const result = evaluateNodeVersion('v20.10.0')
		expect(result.status).toBe('missing')
		expect(result.hint).toMatch(/nodejs\.org/)
	})

	it('reports drift on Node 22 below the LTS patch', () => {
		const result = evaluateNodeVersion('v22.10.0')
		expect(result.status).toBe('drift')
		expect(result.hint).toMatch(/22\.22\.2/)
	})

	it('reports drift on Node 24 below the LTS patch', () => {
		const result = evaluateNodeVersion('v24.14.1')
		expect(result.status).toBe('drift')
		expect(result.hint).toMatch(/24\.15\.0/)
	})

	it('reports ok on Node 22.22.2 and 24.15.0+', () => {
		expect(evaluateNodeVersion('v22.22.2').status).toBe('ok')
		expect(evaluateNodeVersion('v24.15.0').status).toBe('ok')
		expect(evaluateNodeVersion('v24.20.0').status).toBe('ok')
	})

	it('reports ok on Node 26+ without LTS patch requirements', () => {
		expect(evaluateNodeVersion('v26.0.0').status).toBe('ok')
		expect(evaluateNodeVersion('v28.5.1').status).toBe('ok')
	})

	it('tolerates pre-release suffixes', () => {
		const result = evaluateNodeVersion('v22.22.2-rc.1')
		expect(result.status).toBe('ok')
	})
})

describe('doctor extended checks', () => {
	it('reports drift when engines.node is missing', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		const results = await runDoctor(dir)
		const engines = results.find((r) => r.check === 'engines.node')
		expect(engines?.status).toBe('drift')
		expect(engines?.hint).toMatch(/engines/)
	})

	it('reports ok when engines.node is set', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			engines: { node: '>=22' },
		})
		const results = await runDoctor(dir)
		const engines = results.find((r) => r.check === 'engines.node')
		expect(engines?.status).toBe('ok')
	})

	it('detects .editorconfig and .nvmrc presence', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.writeFile(join(dir, '.editorconfig'), 'root = true\n')
		await fs.writeFile(join(dir, '.nvmrc'), '22\n')
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'EditorConfig')?.status).toBe('ok')
		expect(results.find((r) => r.check === 'Node version pin')?.status).toBe('ok')
	})

	it('Node version consistency: ok when .nvmrc, engines, and workflow all agree', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			engines: { node: '>=22' },
		})
		await fs.writeFile(join(dir, '.nvmrc'), '22\n')
		await fs.outputFile(
			join(dir, '.github', 'workflows', 'ci.yml'),
			'jobs:\n  build:\n    steps:\n      - uses: actions/setup-node@v6\n        with:\n          node-version: "22"\n'
		)
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'Node version consistency')?.status).toBe('ok')
	})

	it('Node version consistency: drift when a workflow hardcodes a different major', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			engines: { node: '>=22' },
		})
		await fs.writeFile(join(dir, '.nvmrc'), '22\n')
		await fs.outputFile(
			join(dir, '.github', 'workflows', 'ci.yml'),
			'jobs:\n  build:\n    steps:\n      - uses: actions/setup-node@v6\n        with:\n          node-version: 20\n'
		)
		const results = await runDoctor(dir)
		const c = results.find((r) => r.check === 'Node version consistency')
		expect(c?.status).toBe('drift')
		expect(c?.hint).toMatch(/fix node-version/)
	})

	it('Node version consistency: a matrix array is not flagged as drift', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			engines: { node: '>=22' },
		})
		await fs.writeFile(join(dir, '.nvmrc'), '22\n')
		await fs.outputFile(
			join(dir, '.github', 'workflows', 'ci.yml'),
			'jobs:\n  test:\n    strategy:\n      matrix:\n        node-version: ["22", "24"]\n    steps:\n      - uses: actions/setup-node@v6\n        with:\n          node-version: ${{ matrix.node-version }}\n'
		)
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'Node version consistency')?.status).toBe('ok')
	})

	it('reports husky drift when .husky/ exists without prepare script', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.ensureDir(join(dir, '.husky'))
		const results = await runDoctor(dir)
		const husky = results.find((r) => r.check === 'Husky')
		expect(husky?.status).toBe('drift')
	})

	it('reports husky ok when both .husky/ and prepare script exist', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			scripts: { prepare: 'husky' },
		})
		await fs.ensureDir(join(dir, '.husky'))
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'Husky')?.status).toBe('ok')
	})

	it('AI setup: optional-missing on a bare project, ok once AGENTS.md has the block', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		let results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'AI setup')?.status).toBe('optional-missing')

		await fs.writeFile(
			join(dir, 'AGENTS.md'),
			'<!-- js-tooling:start -->\nx\n<!-- js-tooling:end -->\n'
		)
		results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'AI setup')?.status).toBe('ok')
	})

	it('AI setup: ok when the Claude skill is present without AGENTS.md', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.outputFile(join(dir, '.claude', 'skills', 'js-tooling.md'), '# skill\n')
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'AI setup')?.status).toBe('ok')
	})

	it('detects lint-staged in package.json', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			'lint-staged': { '*.ts': 'biome check' },
		})
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'lint-staged')?.status).toBe('ok')
	})

	it('reports lint-staged ok when a husky hook actually calls it', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			'lint-staged': { '*.ts': 'biome check' },
		})
		await fs.ensureDir(join(dir, '.husky'))
		await fs.writeFile(join(dir, '.husky', 'pre-commit'), 'npx lint-staged\n')
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'lint-staged')?.status).toBe('ok')
	})

	it('reports lint-staged drift when configured but the husky hook only comments it out', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			'lint-staged': { '*.ts': 'biome check' },
		})
		await fs.ensureDir(join(dir, '.husky'))
		await fs.writeFile(join(dir, '.husky', 'pre-commit'), '# npx lint-staged\npnpm check\n')
		const results = await runDoctor(dir)
		const ls = results.find((r) => r.check === 'lint-staged')
		expect(ls?.status).toBe('drift')
		expect(ls?.hint).toMatch(/fix husky/)
	})

	it('detects knip config field', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			knip: { entry: ['src/index.ts'] },
		})
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'knip')?.status).toBe('ok')
	})

	it('skips semantic-release on private packages', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			private: true,
		})
		const results = await runDoctor(dir)
		const sr = results.find((r) => r.check === 'semantic-release')
		expect(sr?.status).toBe('optional-missing')
	})

	it('flags semantic-release drift on publishable packages without config', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		const results = await runDoctor(dir)
		const sr = results.find((r) => r.check === 'semantic-release')
		expect(sr?.status).toBe('drift')
		expect(sr?.hint).toMatch(/semantic-release/)
	})

	it('reports semantic-release ok when release config extends our preset', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.writeFile(
			join(dir, 'release.config.mjs'),
			"export { default } from '@rtorcato/js-tooling/semantic-release/github'\n"
		)
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'semantic-release')?.status).toBe('ok')
	})

	it('detects GitHub Actions workflows', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.ensureDir(join(dir, '.github', 'workflows'))
		await fs.writeFile(join(dir, '.github', 'workflows', 'ci.yml'), 'name: ci\n')
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'GitHub Actions')?.status).toBe('ok')
	})

	it('reports verify script optional-missing when not in package.json', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		const results = await runDoctor(dir)
		const verify = results.find((r) => r.check === 'verify script')
		expect(verify?.status).toBe('optional-missing')
		expect(verify?.hint).toMatch(/fix verify/)
	})

	it('reports verify script ok when a canonical chain is present', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			scripts: {
				typecheck: 'tsc --noEmit',
				check: 'biome check .',
				verify: 'pnpm typecheck && pnpm check && pnpm exec vitest run',
			},
			devDependencies: { '@rtorcato/js-tooling': '^2.0.0', vitest: '^4.0.0' },
		})
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'verify script')?.status).toBe('ok')
	})

	it('treats user-added steps in the verify chain as ok (lenient)', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			scripts: {
				typecheck: 'tsc --noEmit',
				check: 'biome check .',
				verify: 'pnpm typecheck && pnpm check && pnpm exec vitest run && pnpm treeshake',
			},
			devDependencies: { '@rtorcato/js-tooling': '^2.0.0', vitest: '^4.0.0' },
		})
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'verify script')?.status).toBe('ok')
	})

	it('reports verify script drift when a tool is enabled but missing from the chain', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			scripts: {
				typecheck: 'tsc --noEmit',
				check: 'biome check .',
				verify: 'pnpm check',
			},
			devDependencies: { '@rtorcato/js-tooling': '^2.0.0' },
		})
		const results = await runDoctor(dir)
		const verify = results.find((r) => r.check === 'verify script')
		expect(verify?.status).toBe('drift')
		expect(verify?.detail).toMatch(/typecheck/)
	})

	it('reports Husky pre-push ok when the hook calls pnpm verify', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.ensureDir(join(dir, '.husky'))
		await fs.writeFile(join(dir, '.husky', 'pre-push'), 'pnpm verify\n')
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'Husky pre-push')?.status).toBe('ok')
	})

	it('reports Husky pre-push drift when the hook does not call pnpm verify', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			devDependencies: { '@rtorcato/js-tooling': '^2.0.0' },
			scripts: { verify: 'pnpm typecheck && pnpm check' },
		})
		await fs.ensureDir(join(dir, '.husky'))
		await fs.writeFile(join(dir, '.husky', 'pre-push'), 'pnpm test\n')
		const results = await runDoctor(dir)
		const prePush = results.find((r) => r.check === 'Husky pre-push')
		expect(prePush?.status).toBe('drift')
		expect(prePush?.hint).toMatch(/fix husky/)
	})

	it('reports Husky pre-push drift when the verify call is commented out', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			devDependencies: { '@rtorcato/js-tooling': '^2.0.0' },
			scripts: { verify: 'pnpm typecheck && pnpm check' },
		})
		await fs.ensureDir(join(dir, '.husky'))
		await fs.writeFile(join(dir, '.husky', 'pre-push'), '#!/usr/bin/env sh\n# pnpm verify\n')
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'Husky pre-push')?.status).toBe('drift')
	})

	it('reports Husky pre-push optional-missing when husky is present but the hook is absent', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.ensureDir(join(dir, '.husky'))
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'Husky pre-push')?.status).toBe('optional-missing')
	})

	it('reports tree-shake check optional-missing on multi-subpath sideEffects-free libraries', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: '@my-org/my-lib',
			version: '0.0.0',
			sideEffects: false,
			exports: {
				'.': './dist/index.js',
				'./a': './dist/a.js',
				'./b': './dist/b.js',
			},
			devDependencies: { '@rtorcato/js-tooling': '^2.0.0' },
		})
		const results = await runDoctor(dir)
		const ts = results.find((r) => r.check === 'Tree-shake check')
		expect(ts?.status).toBe('optional-missing')
		expect(ts?.hint).toMatch(/fix treeshake-check/)
	})

	it('reports tree-shake check ok (not applicable) for single-export packages', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			exports: { '.': './dist/index.js' },
			devDependencies: { '@rtorcato/js-tooling': '^2.0.0' },
		})
		const results = await runDoctor(dir)
		const ts = results.find((r) => r.check === 'Tree-shake check')
		expect(ts?.status).toBe('ok')
		expect(ts?.detail).toMatch(/not applicable/)
	})

	it('reports verify script drift when apps/treeshake-check exists but verify omits treeshake', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			scripts: {
				typecheck: 'tsc --noEmit',
				check: 'biome check .',
				verify: 'pnpm typecheck && pnpm check',
			},
			devDependencies: { '@rtorcato/js-tooling': '^2.0.0' },
		})
		await fs.ensureDir(join(dir, 'apps', 'treeshake-check'))
		await fs.writeFile(join(dir, 'apps', 'treeshake-check', 'check.mjs'), '// stub\n')
		const results = await runDoctor(dir)
		const verify = results.find((r) => r.check === 'verify script')
		expect(verify?.status).toBe('drift')
		expect(verify?.detail).toMatch(/treeshake/)
	})

	it('reports tree-shake check ok when apps/treeshake-check is present', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: '@my-org/my-lib',
			version: '0.0.0',
			sideEffects: false,
			exports: {
				'.': './dist/index.js',
				'./a': './dist/a.js',
				'./b': './dist/b.js',
			},
			devDependencies: { '@rtorcato/js-tooling': '^2.0.0' },
		})
		await fs.ensureDir(join(dir, 'apps', 'treeshake-check'))
		await fs.writeFile(join(dir, 'apps', 'treeshake-check', 'check.mjs'), '// stub\n')
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'Tree-shake check')?.status).toBe('ok')
	})

	it('detects GitLab CI configuration', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.writeFile(join(dir, '.gitlab-ci.yml'), 'stages: []\n')
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'GitLab CI')?.status).toBe('ok')
	})
})

describe('doctor security checks', () => {
	it('reports Dependabot optional-missing on empty repo', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		const results = await runDoctor(dir)
		const dep = results.find((r) => r.check === 'Dependabot')
		expect(dep?.status).toBe('optional-missing')
		expect(dep?.hint).toMatch(/fix dependabot/)
	})

	it('reports Dependabot drift when dependabot.yml exists but has no grouping', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.ensureDir(join(dir, '.github'))
		await fs.writeFile(join(dir, '.github', 'dependabot.yml'), 'version: 2\n')
		const results = await runDoctor(dir)
		const dep = results.find((r) => r.check === 'Dependabot')
		expect(dep?.status).toBe('drift')
		expect(dep?.hint).toMatch(/fix dependabot/)
	})

	it('reports Dependabot ok when dependabot.yml has a groups block', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.ensureDir(join(dir, '.github'))
		await fs.writeFile(
			join(dir, '.github', 'dependabot.yml'),
			'version: 2\nupdates:\n  - package-ecosystem: "npm"\n    groups:\n      all:\n        patterns: ["*"]\n'
		)
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'Dependabot')?.status).toBe('ok')
	})

	it('reports Dependabot ok when renovate.json exists (Renovate is an accepted alternative)', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.writeJson(join(dir, 'renovate.json'), { extends: ['config:recommended'] })
		const results = await runDoctor(dir)
		const dep = results.find((r) => r.check === 'Dependabot')
		expect(dep?.status).toBe('ok')
		expect(dep?.detail).toMatch(/Renovate/)
	})

	it('reports CodeQL ok when .github/workflows/codeql.yml exists', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.ensureDir(join(dir, '.github', 'workflows'))
		await fs.writeFile(join(dir, '.github', 'workflows', 'codeql.yml'), 'name: CodeQL\n')
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'CodeQL')?.status).toBe('ok')
	})

	it('detects CodeQL via codeql-action reference in any workflow', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.ensureDir(join(dir, '.github', 'workflows'))
		await fs.writeFile(
			join(dir, '.github', 'workflows', 'security.yml'),
			'name: Security\nuses: github/codeql-action/init@v3\n'
		)
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'CodeQL')?.status).toBe('ok')
	})

	it('reports CodeQL optional-missing when no workflows reference it', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.ensureDir(join(dir, '.github', 'workflows'))
		await fs.writeFile(join(dir, '.github', 'workflows', 'ci.yml'), 'name: CI\n')
		const results = await runDoctor(dir)
		const codeql = results.find((r) => r.check === 'CodeQL')
		expect(codeql?.status).toBe('optional-missing')
		expect(codeql?.hint).toMatch(/fix codeql/)
	})
})

describe('doctor CODEOWNERS', () => {
	it('reports optional-missing when no CODEOWNERS exists', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		const results = await runDoctor(dir)
		const co = results.find((r) => r.check === 'CODEOWNERS')
		expect(co?.status).toBe('optional-missing')
		expect(co?.hint).toMatch(/fix codeowners/)
	})

	it('reports ok when CODEOWNERS lives at .github/CODEOWNERS', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.ensureDir(join(dir, '.github'))
		await fs.writeFile(join(dir, '.github', 'CODEOWNERS'), '* @owner\n')
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'CODEOWNERS')?.status).toBe('ok')
	})

	it('reports ok when CODEOWNERS lives at repo root', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.writeFile(join(dir, 'CODEOWNERS'), '* @owner\n')
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'CODEOWNERS')?.status).toBe('ok')
	})
})

describe('doctor + lockfile', () => {
	async function writeLock(dir: string, configPatch: Record<string, unknown> = {}): Promise<void> {
		const config = {
			projectName: 'demo',
			projectType: 'library',
			typescript: { enabled: true, config: 'base' },
			linting: { tool: 'biome' },
			formatting: { tool: 'biome' },
			testing: { framework: 'vitest', environment: 'node' },
			gitHooks: true,
			commitLint: true,
			semanticRelease: true,
			securityAutomation: true,
			bundler: 'tsup',
			...configPatch,
		}
		await fs.writeJson(join(dir, '.js-tooling.json'), {
			version: 1,
			config,
			writtenBy: '@rtorcato/js-tooling@test',
			writtenAt: new Date().toISOString(),
		})
	}

	it('reports the lockfile check ok when present', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await writeLock(dir)
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'lockfile')?.status).toBe('ok')
	})

	it('reports the lockfile check optional-missing when absent', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		const results = await runDoctor(dir)
		const lock = results.find((r) => r.check === 'lockfile')
		expect(lock?.status).toBe('optional-missing')
		expect(lock?.hint).toMatch(/fix lockfile/)
	})

	it('reports lockfile drift when version is from a newer CLI', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.writeJson(join(dir, '.js-tooling.json'), {
			version: 99,
			config: {
				projectName: 'demo',
				projectType: 'library',
				typescript: { enabled: true, config: 'base' },
				linting: { tool: 'biome' },
				formatting: { tool: 'biome' },
				testing: { framework: 'vitest' },
				gitHooks: true,
				commitLint: true,
				semanticRelease: true,
				securityAutomation: true,
				bundler: 'tsup',
			},
			writtenBy: 'future',
			writtenAt: new Date().toISOString(),
		})
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'lockfile')?.status).toBe('drift')
	})

	it('demotes Vitest to ok when the lock records testing.framework=jest', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await writeLock(dir, { testing: { framework: 'jest', environment: 'node' } })
		const results = await runDoctor(dir)
		const vitest = results.find((r) => r.check === 'Vitest')
		expect(vitest?.status).toBe('ok')
		expect(vitest?.detail).toMatch(/intentionally declined/)
	})

	it('demotes Biome to ok when the lock records linting.tool=eslint', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await writeLock(dir, {
			linting: { tool: 'eslint', eslintConfig: 'base' },
			formatting: { tool: 'prettier' },
		})
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'Biome')?.status).toBe('ok')
	})

	it('demotes Husky, lint-staged, and Husky pre-push when gitHooks=false in lock', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await writeLock(dir, { gitHooks: false, commitLint: false })
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'Husky')?.status).toBe('ok')
		expect(results.find((r) => r.check === 'lint-staged')?.status).toBe('ok')
		expect(results.find((r) => r.check === 'Husky pre-push')?.status).toBe('ok')
		expect(results.find((r) => r.check === 'Commitlint')?.status).toBe('ok')
	})

	it('demotes Dependabot and CodeQL when securityAutomation=false in lock', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await writeLock(dir, { securityAutomation: false })
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'Dependabot')?.status).toBe('ok')
		expect(results.find((r) => r.check === 'CodeQL')?.status).toBe('ok')
	})

	it('demotes AI setup to ok when the lock records aiSetup=false', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await writeLock(dir, { aiSetup: false })
		const results = await runDoctor(dir)
		expect(results.find((r) => r.check === 'AI setup')?.status).toBe('ok')
	})

	it('only ever demotes optional-missing to ok, never makes anything worse', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		const before = await runDoctor(dir)
		const beforeStatuses = new Map(before.map((r) => [r.check, r.status]))

		await writeLock(dir)
		const after = await runDoctor(dir)
		for (const r of after) {
			if (r.check === 'lockfile') continue
			const previous = beforeStatuses.get(r.check)
			if (previous === r.status) continue
			// The only allowed transition is optional-missing → ok (lockfile-driven demotion).
			expect(previous).toBe('optional-missing')
			expect(r.status).toBe('ok')
		}
	})
})

describe('nextStepSuggestions', () => {
	it('returns empty when there is nothing to fix', () => {
		expect(nextStepSuggestions([{ check: 'Biome', status: 'ok', detail: '' }])).toEqual([])
	})

	it('emits fix commands for drift, missing, and optional-missing', () => {
		const suggestions = nextStepSuggestions([
			{ check: 'Biome', status: 'drift', detail: '' },
			{ check: 'ESLint', status: 'optional-missing', detail: '' },
			{ check: 'TypeScript', status: 'missing', detail: '' },
		])
		expect(suggestions).toContain('Run `npx @rtorcato/js-tooling fix biome` to align Biome')
		expect(suggestions).toContain('Run `npx @rtorcato/js-tooling fix eslint` to scaffold ESLint')
		expect(suggestions).toContain(
			'Run `npx @rtorcato/js-tooling fix tsconfig` to scaffold TypeScript'
		)
	})

	it('appends a closing line that points at the no-target fix walk', () => {
		const suggestions = nextStepSuggestions([
			{ check: 'EditorConfig', status: 'optional-missing', detail: '' },
		])
		expect(suggestions.at(-1)).toMatch(/walk all findings/)
	})

	it('caps specific suggestions at 8 and emits an overflow line', () => {
		const checks = [
			'Biome',
			'ESLint',
			'Prettier',
			'Vitest',
			'Commitlint',
			'Husky',
			'knip',
			'EditorConfig',
			'Node version pin',
			'engines.node',
		]
		const suggestions = nextStepSuggestions(
			checks.map((c) => ({ check: c, status: 'optional-missing' as const, detail: '' }))
		)
		// 8 specific + 1 overflow
		expect(suggestions).toHaveLength(9)
		expect(suggestions.at(-1)).toMatch(/and \d+ more/)
	})

	it('skips checks with no registered fix target', () => {
		const suggestions = nextStepSuggestions([{ check: 'Node', status: 'drift', detail: '' }])
		expect(suggestions).toEqual([])
	})

	it('flags a release workflow that runs semantic-release with bare GITHUB_TOKEN', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.ensureDir(join(dir, '.github', 'workflows'))
		await fs.writeFile(
			join(dir, '.github', 'workflows', 'ci.yml'),
			'jobs:\n  release:\n    steps:\n      - run: npx semantic-release\n        env:\n          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n'
		)

		const results = await runDoctor(dir)
		const rt = results.find((r) => r.check === 'Release token')
		expect(rt?.status).toBe('drift')
		expect(rt?.hint).toMatch(/RELEASE_TOKEN/)
	})

	it('reports ok when the release workflow uses the RELEASE_TOKEN fallback', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.ensureDir(join(dir, '.github', 'workflows'))
		await fs.writeFile(
			join(dir, '.github', 'workflows', 'ci.yml'),
			'jobs:\n  release:\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          token: ${{ secrets.RELEASE_TOKEN || secrets.GITHUB_TOKEN }}\n      - run: npx semantic-release\n        env:\n          GITHUB_TOKEN: ${{ secrets.RELEASE_TOKEN || secrets.GITHUB_TOKEN }}\n'
		)

		const results = await runDoctor(dir)
		const rt = results.find((r) => r.check === 'Release token')
		expect(rt?.status).toBe('ok')
	})
})

describe('doctor publint check', () => {
	it('flags a publishable library with no publint as not configured', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			exports: { '.': './dist/index.js' },
		})
		const results = await runDoctor(dir)
		const p = results.find((r) => r.check === 'publint')
		expect(p?.status).toBe('optional-missing')
	})

	it('reports ok when publint is installed and wired into a script', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			exports: { '.': './dist/index.js' },
			scripts: { publint: 'publint --strict' },
			devDependencies: { publint: '^0.3.0' },
		})
		const results = await runDoctor(dir)
		const p = results.find((r) => r.check === 'publint')
		expect(p?.status).toBe('ok')
	})

	it('flags drift when publint is installed but no script runs it', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			exports: { '.': './dist/index.js' },
			devDependencies: { publint: '^0.3.0' },
		})
		const results = await runDoctor(dir)
		const p = results.find((r) => r.check === 'publint')
		expect(p?.status).toBe('drift')
	})

	it('is not applicable for a private package', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			private: true,
			exports: { '.': './dist/index.js' },
		})
		const results = await runDoctor(dir)
		const p = results.find((r) => r.check === 'publint')
		expect(p?.status).toBe('ok')
		expect(p?.detail).toMatch(/not applicable/)
	})
})

describe('doctor README badges check', () => {
	it('flags a public library with no badges as not configured', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			exports: { '.': './dist/index.js' },
		})
		await fs.writeFile(join(dir, 'README.md'), '# demo\n\nNo badges here.\n')
		const results = await runDoctor(dir)
		const b = results.find((r) => r.check === 'README badges')
		expect(b?.status).toBe('optional-missing')
	})

	it('reports ok when the README already carries badges', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			exports: { '.': './dist/index.js' },
		})
		await fs.writeFile(
			join(dir, 'README.md'),
			'# demo\n\n![npm](https://img.shields.io/npm/v/demo)\n'
		)
		const results = await runDoctor(dir)
		const b = results.find((r) => r.check === 'README badges')
		expect(b?.status).toBe('ok')
	})

	it('flags drift when a private package carries npm/coverage badges', async () => {
		const dir = newTmpDir()
		await fs.writeJson(join(dir, 'package.json'), {
			name: 'demo',
			version: '0.0.0',
			private: true,
		})
		await fs.writeFile(
			join(dir, 'README.md'),
			'# demo\n\n![npm](https://img.shields.io/npm/v/demo)\n'
		)
		const results = await runDoctor(dir)
		const b = results.find((r) => r.check === 'README badges')
		expect(b?.status).toBe('drift')
	})

	it('flags a Codecov badge with no CI coverage upload', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.writeFile(
			join(dir, 'README.md'),
			'# demo\n\n![Coverage](https://codecov.io/gh/o/r/branch/main/graph/badge.svg)\n'
		)
		await fs.ensureDir(join(dir, '.github', 'workflows'))
		await fs.writeFile(join(dir, '.github', 'workflows', 'ci.yml'), 'name: CI\n')
		const results = await runDoctor(dir)
		const r = results.find((c) => c.check === 'Coverage upload')
		expect(r?.status).toBe('drift')
	})

	it('passes coverage upload when ci.yml uses codecov-action', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.writeFile(
			join(dir, 'README.md'),
			'# demo\n\n![Coverage](https://codecov.io/gh/o/r/branch/main/graph/badge.svg)\n'
		)
		await fs.ensureDir(join(dir, '.github', 'workflows'))
		await fs.writeFile(
			join(dir, '.github', 'workflows', 'ci.yml'),
			'name: CI\njobs:\n  test:\n    steps:\n      - uses: codecov/codecov-action@v5\n'
		)
		const results = await runDoctor(dir)
		const r = results.find((c) => c.check === 'Coverage upload')
		expect(r?.status).toBe('ok')
	})

	it('coverage upload not applicable without a Codecov badge', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.writeFile(join(dir, 'README.md'), '# demo\n')
		const results = await runDoctor(dir)
		const r = results.find((c) => c.check === 'Coverage upload')
		expect(r?.status).toBe('ok')
	})

	it('nudges when a tool config lacks its recommended VS Code extension', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.writeJson(join(dir, 'biome.json'), { $schema: 'x' })
		const results = await runDoctor(dir)
		const r = results.find((c) => c.check === 'VS Code extensions')
		expect(r?.status).toBe('optional-missing')
		expect(r?.detail).toMatch(/biomejs\.biome/)
	})

	it('passes when .vscode/extensions.json recommends the matching extension', async () => {
		const dir = newTmpDir()
		await seedPackageJson(dir)
		await fs.writeJson(join(dir, 'biome.json'), { $schema: 'x' })
		await fs.ensureDir(join(dir, '.vscode'))
		await fs.writeJson(join(dir, '.vscode', 'extensions.json'), {
			recommendations: ['biomejs.biome'],
		})
		const results = await runDoctor(dir)
		const r = results.find((c) => c.check === 'VS Code extensions')
		expect(r?.status).toBe('ok')
	})
})
