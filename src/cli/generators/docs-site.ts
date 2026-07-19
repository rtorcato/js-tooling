import path from 'node:path'
import fs from 'fs-extra'
import { copyPreset, PRESETS } from '../utils/copy-preset.js'
import { parseRepository } from './badges.js'

type Pkg = Record<string, unknown> | null

/**
 * Docs-site (Docusaurus) generator — the Phase 2 counterpart to the shared
 * assets shipped in #54. Scaffolds a working Docusaurus site under `apps/docs`,
 * inferring name/org/repo from package.json (+ the shared design tokens and
 * sync-changelog script), matching the layout the `Docs site` doctor check
 * verifies. Every file is written only when absent, so `fix docs-site` is
 * idempotent and never clobbers a hand-edited site.
 */

const DOCS_APP = 'apps/docs'
/** Docusaurus's neutral green — the default accent, meant to be branded over. */
const DEFAULT_ACCENT = { light: '#2e8555', dark: '#25c2a0' }

export interface DocsSiteOptions {
	/** Accent colour override, e.g. Cloudflare orange. Falls back per project. */
	primaryColor?: { light: string; dark: string }
}

interface SiteMeta {
	/** Docs package name, e.g. `@rtorcato/js-tooling-docs`. */
	docsPkgName: string
	/** Site title shown in the navbar. */
	title: string
	tagline: string
	owner: string | null
	repo: string | null
}

/** Derive the docs package name from the consumer's own name (`<name>-docs`). */
function docsPackageName(pkgName: string | undefined): string {
	if (!pkgName) return 'docs'
	return `${pkgName}-docs`
}

function inferSiteMeta(pkg: Pkg): SiteMeta {
	const pkgName = pkg?.name as string | undefined
	const parsed = parseRepository(pkg?.repository)
	const base = pkgName ? (pkgName.split('/').pop() ?? pkgName) : 'docs'
	return {
		docsPkgName: docsPackageName(pkgName),
		title: parsed?.repo ?? base,
		tagline: (pkg?.description as string | undefined) ?? 'Documentation',
		owner: parsed?.owner ?? null,
		repo: parsed?.repo ?? null,
	}
}

/** Write `contents` at `rel` under targetDir only if it doesn't already exist. */
async function writeIfMissing(
	targetDir: string,
	rel: string,
	contents: string
): Promise<string | null> {
	const file = path.join(targetDir, rel)
	if (await fs.pathExists(file)) return null
	await fs.ensureDir(path.dirname(file))
	await fs.writeFile(file, contents)
	return rel
}

/** Ensure `pnpm-workspace.yaml` lists `apps/*` (idempotent). */
async function ensureWorkspace(targetDir: string): Promise<string | null> {
	const rel = 'pnpm-workspace.yaml'
	const file = path.join(targetDir, rel)
	if (await fs.pathExists(file)) {
		const body = await fs.readFile(file, 'utf8')
		// Already a workspace covering apps/* (either `apps/*` or a broader glob).
		if (/^\s*-\s*['"]?apps\/\*/m.test(body)) return null
		if (/^packages:/m.test(body)) {
			const next = body.replace(/^packages:\n/m, "packages:\n  - 'apps/*'\n")
			await fs.writeFile(file, next)
			return rel
		}
		await fs.writeFile(file, `packages:\n  - 'apps/*'\n\n${body}`)
		return rel
	}
	await fs.writeFile(file, "packages:\n  - 'apps/*'\n")
	return rel
}

/** The GitHub Pages base path Docusaurus serves under, e.g. `/js-tooling/`. */
function siteBaseUrl(meta: SiteMeta): string {
	return `/${meta.repo ?? meta.title}/`
}

function docusaurusConfig(meta: SiteMeta): string {
	const owner = meta.owner ?? 'your-org'
	const repo = meta.repo ?? meta.title
	const ghUrl = `https://github.com/${owner}/${repo}`
	return `import type * as Preset from '@docusaurus/preset-classic'
import type { Config } from '@docusaurus/types'
import { themes as prismThemes } from 'prism-react-renderer'

const config: Config = {
  title: '${meta.title}',
  tagline: ${JSON.stringify(meta.tagline)},
  favicon: 'img/favicon.ico',

  url: 'https://${owner}.github.io',
  baseUrl: '/${repo}/',

  organizationName: '${owner}',
  projectName: '${repo}',

  onBrokenLinks: 'warn',

  markdown: {
    format: 'detect',
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/docs',
          editUrl: '${ghUrl}/edit/main/apps/docs/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        indexDocs: true,
        indexBlog: false,
        docsRouteBasePath: '/docs',
        highlightSearchTermsOnTargetPage: true,
        searchBarShortcutHint: false,
      },
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: '${meta.title}',
      items: [
        { to: '/docs', position: 'left', label: 'Docs' },
        {
          href: '${ghUrl}',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [{ label: 'Getting Started', to: '/docs' }],
        },
        {
          title: 'More',
          items: [
            { label: 'GitHub', href: '${ghUrl}' },
            { label: 'Issues', href: '${ghUrl}/issues' },
          ],
        },
      ],
      copyright: \`Copyright © \${new Date().getFullYear()} ${meta.title}. Built with Docusaurus.\`,
    },
    prism: {
      theme: prismThemes.vsDark,
      darkTheme: prismThemes.vsDark,
      additionalLanguages: ['bash', 'json', 'typescript'],
    },
  } satisfies Preset.ThemeConfig,
}

export default config
`
}

const SIDEBARS = `import type { SidebarsConfig } from '@docusaurus/plugin-content-docs'

// Autogenerated from the docs/ folder structure — add markdown files and they
// appear here. Swap for an explicit list when you want to control ordering.
const sidebars: SidebarsConfig = {
  docs: [{ type: 'autogenerated', dirName: '.' }],
}

export default sidebars
`

const TSCONFIG = `// Improves IDE type-checking; not used by \`docusaurus start/build\`.
{
  "compilerOptions": {
    "baseUrl": ".",
    "ignoreDeprecations": "6.0",
    "strict": true,
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "allowJs": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "exclude": [".docusaurus", "build"]
}
`

function customCss(accent: { light: string; dark: string }): string {
	// Import the shared tokens, then override only the accent (per #54's model).
	return `/* Site theme: shared @rtorcato tokens + this project's accent. */
@import "./_jt-tokens.css";

:root {
  --ifm-color-primary: ${accent.light};
  --jt-accent: ${accent.light};
}

[data-theme="dark"] {
  --ifm-color-primary: ${accent.dark};
  --jt-accent: ${accent.dark};
}
`
}

function docsPackageJson(meta: SiteMeta): string {
	const pkg = {
		name: meta.docsPkgName,
		version: '0.0.1',
		private: true,
		scripts: {
			docusaurus: 'docusaurus',
			'sync-changelog': 'node ../../scripts/sync-changelog.mjs',
			// pnpm 8 doesn't run pre* hooks reliably — chain sync-changelog explicitly.
			start: 'pnpm run sync-changelog && docusaurus start',
			dev: 'pnpm run sync-changelog && docusaurus start',
			build: 'pnpm run sync-changelog && docusaurus build',
			serve: 'docusaurus serve',
			clear: 'docusaurus clear',
			typecheck: 'tsc --noEmit',
			// Opt-in smoke test — builds, serves, and checks the site renders. Heavy
			// browser install, so it's a manual/CI-gated run, not part of `build`.
			'test:e2e': 'playwright test',
		},
		dependencies: {
			'@docusaurus/core': '^3.10.2',
			'@docusaurus/preset-classic': '^3.8.1',
			'@easyops-cn/docusaurus-search-local': '^0.55.2',
			'@mdx-js/react': '^3.1.0',
			clsx: '^2.1.1',
			'prism-react-renderer': '^2.4.1',
			react: '^19.0.0',
			'react-dom': '^19.0.0',
		},
		devDependencies: {
			'@docusaurus/module-type-aliases': '^3.10.2',
			'@docusaurus/tsconfig': '^3.8.1',
			'@docusaurus/types': '^3.10.2',
			'@playwright/test': '^1.49.0',
			'@rtorcato/js-tooling': '^2.47.0',
			'@types/react': '^19.0.0',
			typescript: '~5.6.3',
		},
		browserslist: {
			production: ['>0.5%', 'not dead', 'not op_mini all'],
			development: ['last 3 chrome version', 'last 3 firefox version', 'last 5 safari version'],
		},
		engines: { node: '>=22.0' },
	}
	return `${JSON.stringify(pkg, null, 2)}\n`
}

function introDoc(meta: SiteMeta): string {
	return `---
title: ${meta.title}
slug: /
sidebar_position: 0
---

# ${meta.title}

${meta.tagline}

Welcome to the docs. Edit \`apps/docs/docs/intro.md\` to get started, and add
more markdown files under \`apps/docs/docs/\` — they appear in the sidebar
automatically.
`
}

/** The per-repo workflow that drives the shared reusable deploy on push to main. */
function docsWorkflow(meta: SiteMeta): string {
	return `name: 📚 Docs
on:
  push:
    branches: [main]
    paths:
      - 'apps/docs/**'
      - 'CHANGELOG.md'
      - '.github/workflows/docs.yml'
  workflow_dispatch:

jobs:
  docs:
    permissions:
      contents: read
      pages: write
      id-token: write
    uses: rtorcato/js-tooling/.github/workflows/docs-deploy.yml@main
    with:
      build-filter: '${meta.docsPkgName}'
`
}

/**
 * Playwright config for the docs smoke test. Reuses the shipped preset, then
 * builds + serves the site on :3000 and points the base URL at the site's
 * GitHub Pages base path so routes resolve exactly as in production. One
 * browser keeps the CI browser install light.
 */
function playwrightConfig(meta: SiteMeta): string {
	const url = `http://localhost:3000${siteBaseUrl(meta)}`
	return `import { defineConfig, devices } from '@playwright/test'
import base from '@rtorcato/js-tooling/playwright'

export default defineConfig({
  ...base,
  testDir: './tests',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  use: {
    ...base.use,
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? '${url}',
  },
  webServer: {
    command: 'pnpm run build && pnpm exec docusaurus serve --port 3000',
    url: process.env.PLAYWRIGHT_BASE_URL ?? '${url}',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
`
}

const SMOKE_SPEC = `import { expect, test } from '@playwright/test'

// Smoke test: assert the built site serves and its core UI renders. Deliberately
// content-agnostic — it validates "the site builds and boots", not copy.
test('homepage responds and renders the shell', async ({ page }) => {
  const res = await page.goto('./')
  expect(res?.ok()).toBeTruthy()
  await expect(page.locator('.navbar')).toBeVisible()
})

test('the starter doc renders a heading', async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('h1')).toBeVisible()
})
`

/**
 * Scaffold the Docusaurus docs site. Writes each file only when missing and
 * returns the relative paths actually written, so `fix docs-site` is safe to
 * re-run. Also drops in the shared sync-changelog script + design tokens.
 */
export async function generateDocsSite(
	pkg: Pkg,
	targetDir: string,
	options: DocsSiteOptions = {}
): Promise<string[]> {
	const meta = inferSiteMeta(pkg)
	const accent = options.primaryColor ?? DEFAULT_ACCENT
	const written: string[] = []

	// Shared assets (only-if-missing copies of the shipped presets).
	written.push(...(await copyPresetIfMissing('docusaurus-sync-changelog', targetDir)))
	written.push(...(await copyPresetIfMissing('docusaurus-theme-tokens', targetDir)))

	// Project-specific scaffold.
	const files: Array<[string, string]> = [
		[`${DOCS_APP}/package.json`, docsPackageJson(meta)],
		[`${DOCS_APP}/docusaurus.config.ts`, docusaurusConfig(meta)],
		[`${DOCS_APP}/sidebars.ts`, SIDEBARS],
		[`${DOCS_APP}/tsconfig.json`, TSCONFIG],
		[`${DOCS_APP}/src/css/custom.css`, customCss(accent)],
		[`${DOCS_APP}/docs/intro.md`, introDoc(meta)],
		[`${DOCS_APP}/playwright.config.ts`, playwrightConfig(meta)],
		[`${DOCS_APP}/tests/smoke.spec.ts`, SMOKE_SPEC],
		['.github/workflows/docs.yml', docsWorkflow(meta)],
	]
	for (const [rel, contents] of files) {
		const w = await writeIfMissing(targetDir, rel, contents)
		if (w) written.push(w)
	}

	const ws = await ensureWorkspace(targetDir)
	if (ws) written.push(ws)

	return written
}

/** Copy a shipped preset only when its target file is absent. */
async function copyPresetIfMissing(
	name: 'docusaurus-sync-changelog' | 'docusaurus-theme-tokens',
	targetDir: string
): Promise<string[]> {
	const rel = PRESETS[name].target
	if (await fs.pathExists(path.join(targetDir, rel))) return []
	const res = await copyPreset(name, targetDir)
	return [res.target]
}
