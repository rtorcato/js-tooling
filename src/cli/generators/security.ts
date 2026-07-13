import path from 'node:path'
import fs from 'fs-extra'

export async function generateDependabotConfig(targetDir: string) {
	await fs.ensureDir(path.join(targetDir, '.github'))
	const filepath = path.join(targetDir, '.github', 'dependabot.yml')

	const content = `version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    versioning-strategy: "increase"
    commit-message:
      prefix: "chore(deps)"
      include: "scope"
    # TypeScript majors remove config options (7.0 dropped baseUrl) — a deliberate
    # migration, not a dependabot bump. Take minor/patch only.
    ignore:
      - dependency-name: "typescript"
        update-types: ["version-update:semver-major"]
    groups:
      # react + react-dom must move in lockstep (React errors on mismatched versions),
      # so group them; a lone react-dom bump can never pass CI. Inert in non-React repos.
      react:
        patterns:
          - "react"
          - "react-dom"
          - "@types/react"
          - "@types/react-dom"
      # Fold every other minor/patch bump into one weekly PR to cut noise.
      # Majors stay as individual PRs so breaking changes are reviewed on their own.
      minor-and-patch:
        patterns:
          - "*"
        update-types:
          - "minor"
          - "patch"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    commit-message:
      prefix: "chore(ci)"
`

	await fs.writeFile(filepath, content)
}

export async function generateRenovateConfig(targetDir: string) {
	const filepath = path.join(targetDir, 'renovate.json')

	const content = `${JSON.stringify(
		{
			$schema: 'https://docs.renovatebot.com/renovate-schema.json',
			extends: ['config:recommended', ':semanticCommits', ':semanticCommitTypeAll(chore)'],
			schedule: ['before 4am on Monday'],
			prConcurrentLimit: 10,
			prHourlyLimit: 0,
			rangeStrategy: 'bump',
			packageRules: [
				{
					matchManagers: ['github-actions'],
					commitMessagePrefix: 'chore(ci):',
				},
				{
					matchManagers: ['npm'],
					commitMessagePrefix: 'chore(deps):',
				},
			],
		},
		null,
		2
	)}\n`

	await fs.writeFile(filepath, content)
}

export async function generateCodeQLWorkflow(targetDir: string) {
	await fs.ensureDir(path.join(targetDir, '.github', 'workflows'))
	const filepath = path.join(targetDir, '.github', 'workflows', 'codeql.yml')

	const content = `name: CodeQL

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'

jobs:
  analyze:
    name: Analyze
    runs-on: ubuntu-latest
    permissions:
      actions: read
      contents: read
      security-events: write

    strategy:
      fail-fast: false
      matrix:
        language: [javascript-typescript]

    steps:
      - name: Checkout
        uses: actions/checkout@v7

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: \${{ matrix.language }}

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
        with:
          category: "/language:\${{ matrix.language }}"
`

	await fs.writeFile(filepath, content)
}

export async function generateSecurityConfigs(targetDir: string) {
	await generateDependabotConfig(targetDir)
	await generateCodeQLWorkflow(targetDir)
}
