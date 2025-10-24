import fs from 'fs-extra'
import path from 'node:path'
import type { ProjectConfig } from '../commands/setup.js'

export async function generateGitHubActions(config: ProjectConfig, targetDir: string) {
	const workflowsDir = path.join(targetDir, '.github', 'workflows')
	await fs.ensureDir(workflowsDir)

	const workflowPath = path.join(workflowsDir, 'ci.yml')

	const workflow = generateWorkflowYAML(config)
	await fs.writeFile(workflowPath, workflow)
}

function generateWorkflowYAML(config: ProjectConfig): string {
	const hasTests = config.testing.framework !== 'none'
	const hasTypeScript = config.typescript.enabled
	const hasBuild = config.bundler !== 'none'
	const isLibrary = config.projectType === 'library'

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
        uses: actions/checkout@v4

      - name: 📦 Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: 📦 Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: latest

      - name: 📦 Generate cache key
        id: cache-key
        run: echo "key=\${{ runner.os }}-pnpm-\${{ hashFiles('**/pnpm-lock.yaml') }}" >> $GITHUB_OUTPUT

      - name: 📦 Cache dependencies
        uses: actions/cache@v4
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
        uses: actions/checkout@v4

      - name: 📦 Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: 📦 Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: latest

      - name: 📦 Restore dependencies cache
        uses: actions/cache@v4
        with:
          path: |
            ~/.pnpm-store
            node_modules
          key: \${{ needs.dependencies.outputs.cache-key }}

      - name: 🔍 Run linting
        run: ${config.linting.tool === 'biome' || config.linting.tool === 'both' ? 'pnpm check' : 'pnpm lint'}
${
	hasTypeScript
		? `
  typecheck:
    runs-on: ubuntu-latest
    needs: [dependencies, check-skip]
    if: needs.check-skip.outputs.should-skip != 'true'
    steps:
      - name: 📦 Checkout repository
        uses: actions/checkout@v4

      - name: 📦 Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: 📦 Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: latest

      - name: 📦 Restore dependencies cache
        uses: actions/cache@v4
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
        uses: actions/checkout@v4

      - name: 📦 Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: 📦 Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: latest

      - name: 📦 Restore dependencies cache
        uses: actions/cache@v4
        with:
          path: |
            ~/.pnpm-store
            node_modules
          key: \${{ needs.dependencies.outputs.cache-key }}

      - name: 🧪 Run tests
        run: pnpm test`
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
        uses: actions/checkout@v4

      - name: 📦 Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: 📦 Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: latest

      - name: 📦 Restore dependencies cache
        uses: actions/cache@v4
        with:
          path: |
            ~/.pnpm-store
            node_modules
          key: \${{ needs.dependencies.outputs.cache-key }}

      - name: 🏗️ Build project
        run: pnpm build

      - name: 📦 Upload build artifacts
        uses: actions/upload-artifact@v4
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
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: \${{ secrets.GITHUB_TOKEN }}

      - name: 📦 Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - name: 📦 Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: latest

      - name: 📦 Restore dependencies cache
        uses: actions/cache@v4
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
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: \${{ secrets.NPM_TOKEN }}
          NODE_AUTH_TOKEN: \${{ secrets.NPM_TOKEN }}
        run: npx semantic-release`
		: ''
}
`
}
