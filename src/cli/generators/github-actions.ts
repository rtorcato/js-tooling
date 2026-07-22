import fs from 'fs-extra'
import path from 'node:path'
import type { ProjectConfig } from '../commands/setup.js'

// Minimal Codecov config — auto targets keep it from failing a fresh repo that
// has no baseline yet, while the 1% threshold tolerates rounding noise.
// https://docs.codecov.com/docs/codecov-yaml
const CODECOV_YML = `coverage:
  status:
    project:
      default:
        target: auto
        threshold: 1%
    patch:
      default:
        target: auto
        threshold: 1%
`

/** Coverage is uploaded when Vitest is the test runner (it emits an lcov report). */
function usesCoverage(config: ProjectConfig): boolean {
	return config.testing.framework === 'vitest'
}

export async function generateGitHubActions(config: ProjectConfig, targetDir: string) {
	const workflowsDir = path.join(targetDir, '.github', 'workflows')
	await fs.ensureDir(workflowsDir)

	const workflowPath = path.join(workflowsDir, 'ci.yml')

	const workflow = generateWorkflowYAML(config)
	await fs.writeFile(workflowPath, workflow)

	// codecov.yml is the CI's coverage-upload companion — emit it alongside ci.yml
	// whenever the workflow uploads coverage, so the codecov badge isn't red.
	if (usesCoverage(config)) {
		await fs.writeFile(path.join(targetDir, 'codecov.yml'), CODECOV_YML)
	}
}

function generateWorkflowYAML(config: ProjectConfig): string {
	const hasTests = config.testing.framework !== 'none'
	const hasTypeScript = config.typescript.enabled
	const hasBuild = config.bundler !== 'none'
	const isLibrary = config.projectType === 'library'
	const hasCoverage = usesCoverage(config)

	return `name: 🚀 CI/CD Pipeline

on:
  push:
    branches: [main, release, develop]
  pull_request:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  check-skip:
    runs-on: ubuntu-latest
    outputs:
      should-skip: \${{ steps.skip-check.outputs.should-skip }}
    steps:
      - name: Check for skip CI
        id: skip-check
        run: |
          if [[ "\${{ github.event.head_commit.message }}" =~ \\[(ci skip|skip ci)\\] ]]; then
            echo "should-skip=true" >> $GITHUB_OUTPUT
          else
            echo "should-skip=false" >> $GITHUB_OUTPUT
          fi

  dependencies:
    runs-on: ubuntu-latest
    needs: check-skip
    if: needs.check-skip.outputs.should-skip != 'true'
    outputs:
      cache-key: \${{ steps.cache-key.outputs.key }}
    steps:
      - name: 📦 Checkout repository
        uses: actions/checkout@v7

      - name: 📦 Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc

      - name: 📦 Setup pnpm
        uses: pnpm/action-setup@v6

      - name: 📦 Generate cache key
        id: cache-key
        run: echo "key=\${{ runner.os }}-pnpm-\${{ hashFiles('**/pnpm-lock.yaml') }}" >> $GITHUB_OUTPUT

      - name: 📦 Cache dependencies
        uses: actions/cache@v5
        with:
          path: |
            ~/.pnpm-store
            node_modules
          key: \${{ steps.cache-key.outputs.key }}
          restore-keys: |
            \${{ runner.os }}-pnpm-

      - name: 📦 Install dependencies
        run: pnpm install --frozen-lockfile

  lint:
    runs-on: ubuntu-latest
    needs: [dependencies, check-skip]
    if: needs.check-skip.outputs.should-skip != 'true'
    steps:
      - name: 📦 Checkout repository
        uses: actions/checkout@v7

      - name: 📦 Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc

      - name: 📦 Setup pnpm
        uses: pnpm/action-setup@v6

      - name: 📦 Restore dependencies cache
        uses: actions/cache@v5
        with:
          path: |
            ~/.pnpm-store
            node_modules
          key: \${{ needs.dependencies.outputs.cache-key }}

      - name: 🔍 Run linting
        run: ${config.linting.tool === 'biome' || config.linting.tool === 'both' ? 'pnpm check' : 'pnpm lint'}

      - name: 🧹 Check for unused files, exports, and dependencies
        run: pnpm knip
${
	hasTypeScript
		? `
  typecheck:
    runs-on: ubuntu-latest
    needs: [dependencies, check-skip]
    if: needs.check-skip.outputs.should-skip != 'true'
    steps:
      - name: 📦 Checkout repository
        uses: actions/checkout@v7

      - name: 📦 Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc

      - name: 📦 Setup pnpm
        uses: pnpm/action-setup@v6

      - name: 📦 Restore dependencies cache
        uses: actions/cache@v5
        with:
          path: |
            ~/.pnpm-store
            node_modules
          key: \${{ needs.dependencies.outputs.cache-key }}

      - name: 🔍 Type check
        run: pnpm typecheck`
		: ''
}
${
	hasTests
		? `
  test:
    runs-on: ubuntu-latest
    needs: [dependencies, check-skip]
    if: needs.check-skip.outputs.should-skip != 'true'
    steps:
      - name: 📦 Checkout repository
        uses: actions/checkout@v7

      - name: 📦 Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc

      - name: 📦 Setup pnpm
        uses: pnpm/action-setup@v6

      - name: 📦 Restore dependencies cache
        uses: actions/cache@v5
        with:
          path: |
            ~/.pnpm-store
            node_modules
          key: \${{ needs.dependencies.outputs.cache-key }}

      - name: 🧪 Run tests
        run: ${hasCoverage ? 'pnpm coverage' : 'pnpm test'}
${
	hasCoverage
		? `
      - name: 📊 Upload coverage to Codecov
        uses: codecov/codecov-action@v5
        with:
          token: \${{ secrets.CODECOV_TOKEN }}
          fail_ci_if_error: false`
		: ''
}`
		: ''
}
${
	hasBuild
		? `
  build:
    runs-on: ubuntu-latest
    needs: [dependencies, check-skip]
    if: needs.check-skip.outputs.should-skip != 'true'
    steps:
      - name: 📦 Checkout repository
        uses: actions/checkout@v7

      - name: 📦 Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc

      - name: 📦 Setup pnpm
        uses: pnpm/action-setup@v6

      - name: 📦 Restore dependencies cache
        uses: actions/cache@v5
        with:
          path: |
            ~/.pnpm-store
            node_modules
          key: \${{ needs.dependencies.outputs.cache-key }}

      - name: 🏗️ Build project
        run: pnpm build
${isLibrary ? '\n      - name: 🔍 Validate type resolution (are-the-types-wrong)\n        run: pnpm attw\n' : ''}${config.publint ? '\n      - name: 🔍 Validate package with publint\n        run: pnpm exec publint --strict\n' : ''}
      - name: 📦 Upload build artifacts
        uses: actions/upload-artifact@v7
        with:
          name: build-artifacts
          path: |
            dist/
            package.json
            README.md
          retention-days: 7`
		: ''
}
${
	isLibrary && config.semanticRelease
		? `
  release:
    runs-on: ubuntu-latest
    needs: [dependencies, lint${hasTypeScript ? ', typecheck' : ''}${hasTests ? ', test' : ''}${hasBuild ? ', build' : ''}, check-skip]
    if: needs.check-skip.outputs.should-skip != 'true' && github.ref == 'refs/heads/main'
    permissions:
      contents: write
      issues: write
      pull-requests: write
      id-token: write
    steps:
      - name: 📦 Checkout repository
        uses: actions/checkout@v7
        with:
          fetch-depth: 0
          # RELEASE_TOKEN (admin PAT) lets semantic-release push the version
          # commit + tag to a protected main; GITHUB_TOKEN can't bypass branch
          # protection. Falls back to GITHUB_TOKEN when no PAT is set.
          token: \${{ secrets.RELEASE_TOKEN || secrets.GITHUB_TOKEN }}

      - name: 📦 Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
          registry-url: 'https://registry.npmjs.org'

      - name: 📦 Setup pnpm
        uses: pnpm/action-setup@v6

      - name: 📦 Restore dependencies cache
        uses: actions/cache@v5
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
        run: npx semantic-release`
		: ''
}
`
}
