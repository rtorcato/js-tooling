import path from 'node:path'
import fs from 'fs-extra'

/** The canonical dependency-update standard shared by every @rtorcato repo. */
export const DEPENDABOT_CONFIG = `version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: monthly
      time: "06:00"
      timezone: Etc/UTC
    # Let brand-new releases settle before opening a PR — keeps grouped bumps
    # from tripping pnpm's minimumReleaseAge supply-chain check (a same-day
    # release fails the frozen-lockfile install in CI).
    cooldown:
      default-days: 7
    open-pull-requests-limit: 5
    versioning-strategy: increase
    commit-message:
      prefix: chore
      include: scope
    groups:
      # Safe tier: runtime + dev minor/patch auto-merge on green (see the
      # dependabot-automerge workflow). Grouped so react/react-dom move together.
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
      # Majors batch into one PR per ecosystem — breaking by definition, so
      # never auto-merged; triaged on the monthly cadence.
      major-updates:
        update-types:
          - major

  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: monthly
    commit-message:
      prefix: ci
      include: scope
`

/**
 * Auto-merges patch + minor Dependabot PRs once CI is green. Requires branch
 * protection with required status checks on the target branch — without it,
 * \`gh pr merge --auto\` never fires. Majors are excluded (they land in the
 * major-updates group for manual triage).
 */
export const DEPENDABOT_AUTOMERGE_WORKFLOW = `name: Dependabot auto-merge

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

/** Relative paths this generator owns, in a stable order for \`filesWritten\`. */
export const DEPENDABOT_FILES = [
	'.github/dependabot.yml',
	'.github/workflows/dependabot-automerge.yml',
] as const

/**
 * Scaffold the canonical Dependabot setup: the grouped \`dependabot.yml\` **and**
 * the auto-merge workflow. They're a paired unit — the config batches updates
 * into a safe tier and a major tier, and the workflow merges the safe tier on
 * green. See \`apps/docs/docs/guides/dependabot-strategy.md\`.
 */
export async function generateDependabotConfig(targetDir: string) {
	await fs.ensureDir(path.join(targetDir, '.github', 'workflows'))
	await fs.writeFile(path.join(targetDir, '.github', 'dependabot.yml'), DEPENDABOT_CONFIG)
	await fs.writeFile(
		path.join(targetDir, '.github', 'workflows', 'dependabot-automerge.yml'),
		DEPENDABOT_AUTOMERGE_WORKFLOW
	)
	return [...DEPENDABOT_FILES]
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
