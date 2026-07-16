import path from 'node:path'
import fs from 'fs-extra'

// The canonical Dependabot strategy (#111): monthly, grouped into
// production-minor / dev-minor (auto-mergeable on green) and major-updates (one
// PR/ecosystem, never auto-merged), plus github-actions. See the guide:
// apps/docs/docs/guides/dependabot-strategy.md
const DEPENDABOT_CONFIG = `version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: monthly
      day: 1
      time: "06:00"
      timezone: Etc/UTC
    open-pull-requests-limit: 5
    versioning-strategy: increase
    commit-message:
      prefix: chore
      include: scope
    groups:
      # minor + patch, split prod/dev — the auto-merge tier (green-gated).
      production-minor:
        dependency-type: production
        update-types:
          - minor
          - patch
      dev-minor:
        dependency-type: development
        update-types:
          - minor
          - patch
      # one PR per ecosystem for all majors — triaged monthly, never auto-merged.
      major-updates:
        update-types:
          - major

  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: monthly
      day: 1
    commit-message:
      prefix: ci
      include: scope
`

// Auto-merges the safe tier (patch + minor, prod + dev) once CI is green.
// Requires branch protection with required checks on the default branch (#109),
// otherwise \`gh pr merge --auto\` never fires. Majors are excluded by the guard.
const DEPENDABOT_AUTOMERGE = `name: Dependabot auto-merge

on: pull_request

permissions:
  contents: write
  pull-requests: write

jobs:
  auto-merge:
    runs-on: ubuntu-latest
    if: github.actor == 'dependabot[bot]'
    steps:
      - name: Fetch Dependabot metadata
        id: metadata
        uses: dependabot/fetch-metadata@v3
        with:
          github-token: \${{ secrets.GITHUB_TOKEN }}

      - name: Auto-merge patch and minor updates
        if: |
          steps.metadata.outputs.update-type == 'version-update:semver-patch' ||
          steps.metadata.outputs.update-type == 'version-update:semver-minor'
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: \${{ github.event.pull_request.html_url }}
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`

export async function generateDependabotConfig(targetDir: string) {
	await fs.ensureDir(path.join(targetDir, '.github'))
	await fs.writeFile(path.join(targetDir, '.github', 'dependabot.yml'), DEPENDABOT_CONFIG)
}

/** Scaffold the auto-merge workflow that backs the Dependabot strategy (#111). */
export async function generateDependabotAutomerge(targetDir: string) {
	await fs.ensureDir(path.join(targetDir, '.github', 'workflows'))
	await fs.writeFile(
		path.join(targetDir, '.github', 'workflows', 'dependabot-automerge.yml'),
		DEPENDABOT_AUTOMERGE
	)
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
	await generateDependabotAutomerge(targetDir)
	await generateCodeQLWorkflow(targetDir)
}
