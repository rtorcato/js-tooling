import path from 'node:path'
import fs from 'fs-extra'
import { parseRepository } from './badges.js'

/**
 * Scaffold a minimal, buildable Docusaurus docs site under apps/docs, wired into
 * a pnpm workspace and a GitHub Pages deploy workflow (#100/#106). Identity
 * (title, org, repo, url/baseUrl) is inferred from package.json — no hardcoded
 * owner/repo. Neutral theme by default; brand it afterwards.
 *
 * Every file is safe-add — an existing one is never clobbered — so re-running is
 * idempotent and won't overwrite a hand-tuned site. Deferred to follow-ups: the
 * Playwright smoke test, TypeDoc API section, shared CSS tokens, and extracting
 * sync-changelog.mjs / the workflow into `copy` targets.
 */
export interface DocsSiteIdentity {
	/** Docs package name, e.g. `@rtorcato/js-tooling-docs`. */
	docsName: string
	title: string
	tagline: string
	owner: string
	repo: string
}

export function inferDocsIdentity(pkg: Record<string, unknown> | null): DocsSiteIdentity {
	const name = (pkg?.name as string | undefined) ?? 'project'
	const parsed = parseRepository(pkg?.repository)
	const owner = parsed?.owner ?? 'your-org'
	const repo = parsed?.repo ?? name.replace(/^@[^/]+\//, '')
	return {
		docsName: `${name}-docs`,
		title: repo,
		tagline: (pkg?.description as string | undefined) ?? `Documentation for ${name}`,
		owner,
		repo,
	}
}

export async function generateDocsSite(
	targetDir: string,
	pkg: Record<string, unknown> | null
): Promise<string[]> {
	const id = inferDocsIdentity(pkg)
	const written: string[] = []

	const files: Array<[string, string]> = [
		[path.join('apps', 'docs', 'package.json'), docsPackageJson(id)],
		[path.join('apps', 'docs', 'docusaurus.config.ts'), docusaurusConfig(id)],
		[path.join('apps', 'docs', 'sidebars.ts'), SIDEBARS],
		[path.join('apps', 'docs', 'tsconfig.json'), DOCS_TSCONFIG],
		[path.join('apps', 'docs', 'docs', 'intro.md'), introDoc(id)],
		[path.join('apps', 'docs', 'static', '.nojekyll'), ''],
		[path.join('.github', 'workflows', 'docs.yml'), DOCS_WORKFLOW],
	]

	for (const [rel, content] of files) {
		const dest = path.join(targetDir, rel)
		if (await fs.pathExists(dest)) continue
		await fs.ensureDir(path.dirname(dest))
		await fs.writeFile(dest, content)
		written.push(rel)
	}

	if (await ensureWorkspaceApps(targetDir)) written.push('pnpm-workspace.yaml')

	return written
}

/** Add `apps/*` to pnpm-workspace.yaml (create it if absent). Returns true when changed. */
async function ensureWorkspaceApps(targetDir: string): Promise<boolean> {
	const wsPath = path.join(targetDir, 'pnpm-workspace.yaml')
	if (!(await fs.pathExists(wsPath))) {
		await fs.writeFile(wsPath, "packages:\n  - 'apps/*'\n")
		return true
	}
	const content = await fs.readFile(wsPath, 'utf8')
	if (/apps\/\*/.test(content)) return false
	if (/^packages:/m.test(content)) {
		// Insert the glob right after the `packages:` key.
		await fs.writeFile(wsPath, content.replace(/^packages:\s*\n/m, "packages:\n  - 'apps/*'\n"))
	} else {
		await fs.writeFile(wsPath, `${content.trimEnd()}\npackages:\n  - 'apps/*'\n`)
	}
	return true
}

function docsPackageJson(id: DocsSiteIdentity): string {
	return `${JSON.stringify(
		{
			name: id.docsName,
			version: '0.0.0',
			private: true,
			scripts: {
				docusaurus: 'docusaurus',
				start: 'docusaurus start',
				build: 'docusaurus build',
				serve: 'docusaurus serve',
				clear: 'docusaurus clear',
				typecheck: 'tsc --noEmit',
			},
			dependencies: {
				'@docusaurus/core': '^3.8.1',
				'@docusaurus/preset-classic': '^3.8.1',
				'@mdx-js/react': '^3.1.0',
				clsx: '^2.1.1',
				'prism-react-renderer': '^2.4.1',
				react: '^19.0.0',
				'react-dom': '^19.0.0',
			},
			devDependencies: {
				'@docusaurus/module-type-aliases': '^3.8.1',
				'@docusaurus/tsconfig': '^3.8.1',
				'@docusaurus/types': '^3.8.1',
				'@types/react': '^19.0.0',
				typescript: '~5.6.3',
			},
			engines: { node: '>=22.0' },
		},
		null,
		2
	)}\n`
}

function docusaurusConfig(id: DocsSiteIdentity): string {
	return `import type { Config } from '@docusaurus/types'
import { themes as prismThemes } from 'prism-react-renderer'

// Identity inferred from package.json at scaffold time. Edit freely.
const config: Config = {
  title: ${JSON.stringify(id.title)},
  tagline: ${JSON.stringify(id.tagline)},
  url: 'https://${id.owner}.github.io',
  baseUrl: '/${id.repo}/',
  organizationName: ${JSON.stringify(id.owner)},
  projectName: ${JSON.stringify(id.repo)},
  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',
  i18n: { defaultLocale: 'en', locales: ['en'] },
  presets: [
    [
      'classic',
      {
        docs: { routeBasePath: '/', sidebarPath: './sidebars.ts' },
        blog: false,
      },
    ],
  ],
  themeConfig: {
    navbar: {
      title: ${JSON.stringify(id.title)},
      items: [
        { type: 'docSidebar', sidebarId: 'docs', position: 'left', label: 'Docs' },
        { href: 'https://github.com/${id.owner}/${id.repo}', label: 'GitHub', position: 'right' },
      ],
    },
    footer: {
      style: 'dark',
      copyright: \`© \${new Date().getFullYear()} ${id.owner}\`,
    },
    prism: { theme: prismThemes.github, darkTheme: prismThemes.dracula },
  },
}

export default config
`
}

function introDoc(id: DocsSiteIdentity): string {
	return `---
sidebar_position: 1
slug: /
---

# ${id.title}

${id.tagline}

Start writing docs in \`apps/docs/docs/\`. This page is \`intro.md\`.
`
}

const SIDEBARS = `import type { SidebarsConfig } from '@docusaurus/plugin-content-docs'

const sidebars: SidebarsConfig = {
  docs: [{ type: 'autogenerated', dirName: '.' }],
}

export default sidebars
`

const DOCS_TSCONFIG = `{
  "extends": "@docusaurus/tsconfig",
  "compilerOptions": {
    "baseUrl": "."
  },
  "exclude": [".docusaurus", "build"]
}
`

const DOCS_WORKFLOW = `name: Deploy docs

on:
  push:
    branches: [main]
    paths:
      - 'apps/docs/**'
      - '.github/workflows/docs.yml'
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter './apps/docs' build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: apps/docs/build

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
`
