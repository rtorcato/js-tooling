import Link from '@docusaurus/Link'
import Layout from '@theme/Layout'
import clsx from 'clsx'
import type { ReactElement } from 'react'
import InstallTabs from '@site/src/components/InstallTabs'
import styles from './index.module.css'

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

type IconKey = 'spark' | 'wand' | 'stethoscope' | 'bot'

type IconProps = {
	icon: IconKey
	title: string
	className?: string
	size?: number
}

function Icon({ icon, title, className, size = 22 }: IconProps): ReactElement {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.6}
			strokeLinecap="round"
			strokeLinejoin="round"
			role="img"
		>
			<title>{title}</title>
			{ICONS[icon]}
		</svg>
	)
}

const ICONS: Record<IconKey, ReactElement> = {
	spark: (
		<>
			<path d="M12 3v3" />
			<path d="M12 18v3" />
			<path d="m5.6 5.6 2.1 2.1" />
			<path d="m16.3 16.3 2.1 2.1" />
			<path d="M3 12h3" />
			<path d="M18 12h3" />
			<path d="m5.6 18.4 2.1-2.1" />
			<path d="m16.3 7.7 2.1-2.1" />
		</>
	),
	wand: (
		<>
			<path d="m3 21 9-9" />
			<path d="M15 6h.01" />
			<path d="M20 12h.01" />
			<path d="M15 18h.01" />
			<path d="m12 3 2 2-2 2-2-2z" />
		</>
	),
	stethoscope: (
		<>
			<path d="M6 4v6a5 5 0 0 0 10 0V4" />
			<path d="M4 4h4" />
			<path d="M14 4h4" />
			<circle cx="11" cy="19" r="2" />
			<path d="M11 17v-2" />
		</>
	),
	bot: (
		<>
			<rect x="4" y="8" width="16" height="12" rx="2" />
			<path d="M12 4v4" />
			<circle cx="9" cy="13" r="1" />
			<circle cx="15" cy="13" r="1" />
			<path d="M9 17h6" />
		</>
	),
}

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

type Pillar = {
	title: string
	desc: string
	icon: IconKey
}

const PILLARS: Pillar[] = [
	{
		title: 'Full dev lifecycle',
		desc: 'TypeScript, Biome/ESLint, Vitest/Jest, commitlint, Husky, semantic-release, CI, and security — wired together and validated against each other.',
		icon: 'spark',
	},
	{
		title: 'Setup wizard',
		desc: 'One `npx` command scaffolds a complete project. Interactive prompts pick the right stack for libraries, Next.js apps, Node APIs, and more.',
		icon: 'wand',
	},
	{
		title: 'Doctor + fix',
		desc: 'Audit existing repos for drift; apply missing pieces incrementally with `fix` — your customisations are preserved unless you opt in.',
		icon: 'stethoscope',
	},
	{
		title: 'AI-agent ready',
		desc: 'Every command emits structured JSON via `--json` and accepts `--yes` for non-interactive runs. Built for autonomous coding agents and CI bots.',
		icon: 'bot',
	},
]

type Category = {
	name: string
	desc: string
	chips: string[]
	href: string
}

const CATEGORIES: Category[] = [
	{
		name: 'TypeScript',
		desc: 'Base configs for library, React, Next.js, Node and Express projects.',
		chips: ['base', 'react', 'next', 'node', 'express'],
		href: '/docs/reference/typescript',
	},
	{
		name: 'Linting & formatting',
		desc: 'Biome (recommended) replaces ESLint + Prettier in one fast tool. ESLint config still available for edge cases.',
		chips: ['biome', 'eslint', 'prettier'],
		href: '/docs/reference/biome',
	},
	{
		name: 'Testing',
		desc: 'Vitest config + presets, plus Jest browser/node presets for legacy projects.',
		chips: ['vitest', 'jest', 'playwright'],
		href: '/docs/reference/vitest',
	},
	{
		name: 'Commits & releases',
		desc: 'Conventional commits via commitlint + Husky, automated versioning and npm publish via semantic-release.',
		chips: ['commitlint', 'husky', 'semantic-release'],
		href: '/docs/reference/commitlint',
	},
	{
		name: 'Build & bundle',
		desc: 'tsup for TypeScript libraries, esbuild helpers for custom pipelines.',
		chips: ['tsup', 'esbuild'],
		href: '/docs/reference/tsup',
	},
	{
		name: 'CI workflows',
		desc: 'GitHub Actions templates for CI, docs deploy and dependency review — scaffolded on demand.',
		chips: ['github-actions', 'gitlab-ci', 'docs'],
		href: '/docs/guides/cli',
	},
	{
		name: 'Supply-chain security',
		desc: 'Opt-in Dependabot and CodeQL workflows. Renovate available as an alternative.',
		chips: ['dependabot', 'codeql', 'renovate'],
		href: '/docs/guides/cli',
	},
	{
		name: 'Repo baseline',
		desc: '.editorconfig, .nvmrc, knip, lint-staged, CODEOWNERS — the boring-but-important defaults every repo needs.',
		chips: ['editorconfig', 'nvmrc', 'knip', 'lint-staged'],
		href: '/docs/guides/getting-started',
	},
]

const HERO_CODE = `$ npx @rtorcato/js-tooling setup

🛠️  Welcome to JS Tooling Setup!
? Project type:    📚 Library/Package
? TypeScript:      ✅ Yes
? Linter:          ⚡ Biome
? Test framework:  ⚡ Vitest
? Git hooks:       ✅ Husky + lint-staged
? Releases:        🚀 semantic-release

✅ Setup complete.`

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function Hero(): ReactElement {
	return (
		<header className={styles.hero}>
			<div className={styles.heroGlow} aria-hidden />
			<div className={styles.heroInner}>
				<div className={styles.wordmark}>
					<span className={styles.wmJs}>js</span>
					<span className={styles.wmDash}>-</span>
					<span className={styles.wmTooling}>tooling</span>
				</div>
				<p className={styles.tagline}>
					One package, full dev toolchain. TypeScript, linting, testing, commits, releases — wired
					together and validated against each other.
				</p>

				<div className={styles.heroBody}>
					<CodeWindow />
				</div>

				<div className={styles.heroActions}>
					<div className={styles.heroButtons}>
						<Link
							className={clsx('button button--primary button--lg', styles.cta)}
							to="/docs/guides/getting-started"
						>
							Get started →
						</Link>
						<Link className={clsx('button button--lg', styles.ctaSecondary)} to="/docs/guides/cli">
							CLI reference
						</Link>
					</div>
					<InstallTabs pkg="@rtorcato/js-tooling" />
				</div>
			</div>
		</header>
	)
}

function CodeWindow(): ReactElement {
	return (
		<div className={styles.codeWindow}>
			<div className={styles.codeBar}>
				<span className={styles.dot} style={{ background: '#ff5f57' }} />
				<span className={styles.dot} style={{ background: '#febc2e' }} />
				<span className={styles.dot} style={{ background: '#28c840' }} />
				<span className={styles.codeFile}>terminal</span>
			</div>
			<pre className={styles.codePre}>{HERO_CODE}</pre>
		</div>
	)
}

function Pillars(): ReactElement {
	return (
		<section className={styles.section}>
			<div className={styles.pillarGrid}>
				{PILLARS.map((p) => (
					<div key={p.title} className={styles.pillar}>
						<div className={styles.pillarIcon}>
							<Icon icon={p.icon} title={p.title} size={20} className={styles.pillarIconSvg} />
						</div>
						<div className={styles.pillarTitle}>{p.title}</div>
						<div className={styles.pillarDesc}>{p.desc}</div>
					</div>
				))}
			</div>
		</section>
	)
}

function Categories(): ReactElement {
	return (
		<section className={styles.section}>
			<div className={styles.sectionHead}>
				<div>
					<h2 className={styles.h2}>What's in the box</h2>
					<p className={styles.sub}>
						Eight focused areas. Pick what you need with the wizard, audit drift with{' '}
						<code>doctor</code>, scaffold individual configs with <code>fix</code>.
					</p>
				</div>
				<Link className={styles.viewAll} to="/docs/guides/cli">
					CLI reference →
				</Link>
			</div>
			<div className={styles.catGrid}>
				{CATEGORIES.map((c) => (
					<Link key={c.name} to={c.href} className={styles.card}>
						<div className={styles.cardHead}>
							<div className={styles.cardName}>{c.name}</div>
						</div>
						<p className={styles.cardDesc}>{c.desc}</p>
						<div className={styles.chips}>
							{c.chips.map((ch) => (
								<span key={ch} className={styles.chip}>
									{ch}
								</span>
							))}
						</div>
					</Link>
				))}
			</div>
		</section>
	)
}

type Sibling = {
	name: string
	tagline: string
	/** Prefer the published docs site; fall back to the GitHub repo when there isn't one yet. */
	href: string
	/** Short label rendered in the card's top-right indicating where the link goes. */
	dest: 'Docs' | 'GitHub'
}

const SIBLINGS: Sibling[] = [
	{
		name: '@rtorcato/js-common',
		tagline: 'Tree-shakeable TypeScript utilities — tiny bundles, full type safety, CLI included.',
		href: 'https://rtorcato.github.io/js-common/',
		dest: 'Docs',
	},
	{
		name: '@rtorcato/browser-common',
		tagline:
			'Small, tree-shakeable TypeScript wrappers around 40+ browser Web APIs — one subpath per API.',
		href: 'https://rtorcato.github.io/browser-common/',
		dest: 'Docs',
	},
	{
		name: 'rtorcato/swift-common',
		tagline: 'Common Swift utilities — the Apple-platform sibling of js-common and browser-common.',
		href: 'https://github.com/rtorcato/swift-common',
		dest: 'GitHub',
	},
]

function Siblings(): ReactElement {
	return (
		<section className={styles.section}>
			<div className={styles.sectionHead}>
				<div>
					<h2 className={styles.h2}>Sibling projects</h2>
					<p className={styles.sub}>
						More from <code>@rtorcato</code> — same conventions, same release pipeline.
					</p>
				</div>
			</div>
			<div className={styles.siblingGrid}>
				{SIBLINGS.map((s) => (
					<Link key={s.name} href={s.href} className={styles.card}>
						<div className={styles.cardHead}>
							<div className={styles.cardName}>{s.name}</div>
							<div className={styles.cardCount}>{s.dest} ↗</div>
						</div>
						<p className={styles.cardDesc}>{s.tagline}</p>
					</Link>
				))}
			</div>
		</section>
	)
}

export default function Home(): ReactElement {
	return (
		<Layout
			title="js-tooling"
			description="One package, full dev toolchain. TypeScript, linting, testing, commits, releases — wired together and validated against each other."
		>
			<main>
				<Hero />
				<Pillars />
				<Categories />
				<Siblings />
			</main>
		</Layout>
	)
}
