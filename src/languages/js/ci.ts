/**
 * The JavaScript/TypeScript module's CI contribution (#283): the pnpm/Node
 * steps that used to be baked into the generators' template literals.
 *
 * Everything here is Node-specific — `setup-node`, `pnpm install`, the
 * pnpm-store cache, the `pnpm <script>` commands. The shell around it lives in
 * `src/base/ci.ts` and is shared with Swift/Perl/Python (#287/#289/#290).
 */
import type { CiJob, GitLabSpec } from '../../base/ci.js'
import type { ProjectConfig } from '../../cli/commands/setup.js'

/** Coverage is uploaded when Vitest is the test runner (it emits an lcov report). */
export function usesCoverage(config: ProjectConfig): boolean {
	return config.testing.framework === 'vitest'
}

function lintCommand(config: ProjectConfig): string {
	return config.linting.tool === 'biome' || config.linting.tool === 'both'
		? 'pnpm check'
		: 'pnpm lint'
}

/**
 * Checkout → Node → pnpm → restore the cache the `dependencies` job primed.
 * Identical in every downstream job, so it's one const rather than five copies.
 */
const SETUP_STEPS = `      - name: 📦 Checkout repository
        uses: actions/checkout@v7

      - name: 📦 Setup Node.js
        uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc

      - name: 📦 Setup pnpm
        uses: pnpm/action-setup@v6

      - name: 📦 Restore dependencies cache
        uses: actions/cache@v6
        with:
          path: |
            ~/.pnpm-store
            node_modules
          key: \${{ needs.dependencies.outputs.cache-key }}`

/** Primes the pnpm store + node_modules cache every other job restores. */
const DEPENDENCIES_JOB: CiJob = {
	id: 'dependencies',
	extra: `    outputs:
      cache-key: \${{ steps.cache-key.outputs.key }}`,
	steps: `      - name: 📦 Checkout repository
        uses: actions/checkout@v7

      - name: 📦 Setup Node.js
        uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc

      - name: 📦 Setup pnpm
        uses: pnpm/action-setup@v6

      - name: 📦 Generate cache key
        id: cache-key
        run: echo "key=\${{ runner.os }}-pnpm-\${{ hashFiles('**/pnpm-lock.yaml') }}" >> $GITHUB_OUTPUT

      - name: 📦 Cache dependencies
        uses: actions/cache@v6
        with:
          path: |
            ~/.pnpm-store
            node_modules
          key: \${{ steps.cache-key.outputs.key }}
          restore-keys: |
            \${{ runner.os }}-pnpm-

      - name: 📦 Install dependencies
        run: pnpm install --frozen-lockfile`,
}

/**
 * The GitHub Actions jobs for a JS repo, in workflow order. The `release` job
 * needs the ids of everything that ran before it, so the list is assembled
 * rather than filtered from a fixed shape.
 */
export function githubJobs(config: ProjectConfig): CiJob[] {
	const hasTypeScript = config.typescript.enabled
	const hasTests = config.testing.framework !== 'none'
	const hasBuild = config.bundler !== 'none'
	const isLibrary = config.projectType === 'library'
	const hasCoverage = usesCoverage(config)

	const jobs: CiJob[] = [
		DEPENDENCIES_JOB,
		{
			id: 'lint',
			needs: ['dependencies'],
			steps: `${SETUP_STEPS}

      - name: 🔍 Run linting
        run: ${lintCommand(config)}

      - name: 🧹 Check for unused files, exports, and dependencies
        run: pnpm knip`,
		},
	]

	if (hasTypeScript) {
		jobs.push({
			id: 'typecheck',
			needs: ['dependencies'],
			steps: `${SETUP_STEPS}

      - name: 🔍 Type check
        run: pnpm typecheck`,
		})
	}

	if (hasTests) {
		const coverageUpload = hasCoverage
			? `

      - name: 📊 Upload coverage to Codecov
        uses: codecov/codecov-action@v5
        with:
          token: \${{ secrets.CODECOV_TOKEN }}
          fail_ci_if_error: false`
			: ''
		jobs.push({
			id: 'test',
			needs: ['dependencies'],
			steps: `${SETUP_STEPS}

      - name: 🧪 Run tests
        run: ${hasCoverage ? 'pnpm coverage' : 'pnpm test'}${coverageUpload}`,
		})
	}

	if (hasBuild) {
		// attw and publint validate what's about to be published — libraries only.
		const attw = isLibrary
			? '\n      - name: 🔍 Validate type resolution (are-the-types-wrong)\n        run: pnpm attw\n'
			: ''
		const publint = config.publint
			? '\n      - name: 🔍 Validate package with publint\n        run: pnpm exec publint --strict\n'
			: ''
		jobs.push({
			id: 'build',
			needs: ['dependencies'],
			steps: `${SETUP_STEPS}

      - name: 🏗️ Build project
        run: pnpm build
${attw}${publint}
      - name: 📦 Upload build artifacts
        uses: actions/upload-artifact@v7
        with:
          name: build-artifacts
          path: |
            dist/
            package.json
            README.md
          retention-days: 7`,
		})
	}

	if (isLibrary && config.semanticRelease) {
		jobs.push({
			id: 'release',
			// Gate the publish on everything that ran before it.
			needs: jobs.map((job) => job.id),
			if: "github.ref == 'refs/heads/main'",
			extra: `    permissions:
      contents: write
      issues: write
      pull-requests: write
      id-token: write`,
			steps: `      - name: 📦 Checkout repository
        uses: actions/checkout@v7
        with:
          fetch-depth: 0
          # RELEASE_TOKEN (admin PAT) lets semantic-release push the version
          # commit + tag to a protected main; GITHUB_TOKEN can't bypass branch
          # protection. Falls back to GITHUB_TOKEN when no PAT is set.
          token: \${{ secrets.RELEASE_TOKEN || secrets.GITHUB_TOKEN }}

      - name: 📦 Setup Node.js
        uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          registry-url: 'https://registry.npmjs.org'

      - name: 📦 Setup pnpm
        uses: pnpm/action-setup@v6

      - name: 📦 Restore dependencies cache
        uses: actions/cache@v6
        with:
          path: |
            ~/.pnpm-store
            node_modules
          key: \${{ needs.dependencies.outputs.cache-key }}

      - name: 🔧 Configure Git
        run: |
          git config --global user.name "github-actions[bot]"
          git config --global user.email "github-actions[bot]@users.noreply.github.com"

      - name: 🚀 Run semantic-release
        # Publishes to npm via OIDC trusted publishing — no NPM_TOKEN. Requires
        # the \`id-token: write\` permission above + a trusted publisher configured
        # for the package on npmjs.com (Settings → Trusted Publisher).
        env:
          GITHUB_TOKEN: \${{ secrets.RELEASE_TOKEN || secrets.GITHUB_TOKEN }}
        run: npx semantic-release`,
		})
	}

	return jobs
}

/** The `.gitlab-ci.yml` spec for a JS repo — node image, pnpm store cache, pnpm scripts. */
export function gitlabSpec(config: ProjectConfig): GitLabSpec {
	const hasTypeScript = config.typescript.enabled
	const hasTests = config.testing.framework !== 'none'
	const hasLint = config.linting.tool !== 'none'
	const hasBuild = config.bundler !== 'none'

	const jobs: GitLabSpec['jobs'] = [
		...(hasLint ? [{ id: 'lint', stage: 'test', script: [lintCommand(config)] }] : []),
		...(hasTypeScript ? [{ id: 'typecheck', stage: 'test', script: ['pnpm typecheck'] }] : []),
		...(hasTests ? [{ id: 'test', stage: 'test', script: [gitlabTestCommand(config)] }] : []),
		...(hasBuild
			? [
					{
						id: 'build',
						stage: 'build',
						script: ['pnpm build'],
						extra: `  artifacts:
    paths:
      - dist/
    expire_in: 1 week`,
					},
				]
			: []),
	]

	return {
		image: 'node:22',
		preamble: `variables:
  PNPM_CACHE_FOLDER: .pnpm-store

cache:
  key:
    files:
      - pnpm-lock.yaml
  paths:
    - .pnpm-store
    - node_modules

default:
  before_script:
    - corepack enable
    - corepack prepare pnpm@latest --activate
    - pnpm config set store-dir "$PNPM_CACHE_FOLDER"
    - pnpm install --frozen-lockfile`,
		jobs,
	}
}

function gitlabTestCommand(config: ProjectConfig): string {
	if (config.testing.framework === 'vitest') return 'pnpm exec vitest run'
	if (config.testing.framework === 'playwright' || config.testing.framework === 'cypress')
		return 'pnpm test:e2e'
	return 'pnpm test'
}
